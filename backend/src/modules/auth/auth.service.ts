import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { BaseService } from '../../core/services/base.service.js';
import { config } from '../../config/app.config.js';
import { IUserRepository, userRepository } from './user.repository.js';
import { IRefreshTokenRepository, refreshTokenRepository } from './refresh-token.repository.js';
import {
  RegisterUserDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponseData,
  AuthTokens,
  JwtUserPayload,
  UserDocument
} from './auth.types.js';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../core/errors/app-error.js';

export class AuthService extends BaseService {
  constructor(
    private readonly userRepo: IUserRepository = userRepository,
    private readonly tokenRepo: IRefreshTokenRepository = refreshTokenRepository
  ) {
    super('AuthService');
  }

  /**
   * Hashes a raw token with SHA-256 for secure database storage
   */
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Issues JWT Access Token and Refresh Token pair
   */
  private async issueTokens(
    tenantId: string,
    user: UserDocument,
    familyId?: string,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthTokens> {
    const payload: JwtUserPayload = {
      userId: user.id,
      tenantId,
      email: user.email,
      roles: user.roles
    };

    // 1. Generate short-lived Access Token
    const accessToken = jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: config.auth.jwtExpiresIn as any
    });

    const resolvedFamilyId = familyId || crypto.randomUUID();

    // 2. Generate signed Refresh Token
    const rawRefreshToken = jwt.sign(
      {
        userId: user.id,
        tenantId,
        familyId: resolvedFamilyId
      },
      config.auth.jwtRefreshSecret,
      { expiresIn: config.auth.jwtRefreshExpiresIn as any }
    );

    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 3. Persist Refresh Token / Session record
    await this.tokenRepo.create(tenantId, {
      userId: user.id,
      tokenHash,
      familyId: resolvedFamilyId,
      expiresAt,
      isRevoked: false,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: config.auth.jwtExpiresIn,
      tokenType: 'Bearer'
    };
  }

  /**
   * Register a new user under the tenant
   */
  public async register(tenantId: string, dto: RegisterUserDto): Promise<AuthResponseData> {
    const existingEmail = await this.userRepo.findByEmail(tenantId, dto.email);
    if (existingEmail) {
      throw new ConflictError(`Email '${dto.email}' is already registered`);
    }

    const existingUsername = await this.userRepo.findByUsername(tenantId, dto.username);
    if (existingUsername) {
      throw new ConflictError(`Username '${dto.username}' is already taken`);
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(dto.password, config.auth.bcryptSaltRounds);

    const user = await this.userRepo.create(tenantId, {
      email: dto.email.toLowerCase(),
      username: dto.username.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      status: 'active',
      roles: dto.roles && dto.roles.length > 0 ? dto.roles : ['operator'],
      failedLoginAttempts: 0
    });

    this.logger.info(`👤 User registered: [${user.email}] under tenant [${tenantId}]`);

    const tokens = await this.issueTokens(tenantId, user);

    this.publishEvent('USER_REGISTERED', tenantId, {
      userId: user.id,
      email: user.email,
      username: user.username,
      roles: user.roles
    });

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        status: user.status,
        lastLoginAt: user.lastLoginAt
      },
      tokens
    };
  }

  /**
   * Authenticate credentials and issue tokens
   */
  public async login(
    tenantId: string,
    dto: LoginDto,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthResponseData> {
    const user = await this.userRepo.findByIdentifier(tenantId, dto.identifier);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Account lock check
    if (user.lockUntil && user.lockUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedError(`Account is temporarily locked. Try again in ${waitMinutes} minutes.`);
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError(`Account is ${user.status}. Contact your administrator.`);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.userRepo.recordFailedAttempt(tenantId, user.id);
      throw new UnauthorizedError('Invalid credentials');
    }

    // Record login success and clear lock
    await this.userRepo.recordLoginSuccess(tenantId, user.id);

    const tokens = await this.issueTokens(tenantId, user, undefined, meta);

    this.logger.info(`🔓 User logged in: [${user.email}] on tenant [${tenantId}]`);

    this.publishEvent('USER_LOGGED_IN', tenantId, {
      userId: user.id,
      email: user.email,
      ipAddress: meta?.ipAddress
    });

    return {
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        status: user.status,
        lastLoginAt: new Date()
      },
      tokens
    };
  }

  /**
   * Refresh Token rotation with automatic theft / reuse detection
   */
  public async refreshToken(
    rawRefreshToken: string,
    meta?: { userAgent?: string; ipAddress?: string }
  ): Promise<AuthTokens> {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(rawRefreshToken, config.auth.jwtRefreshSecret);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tenantId = decoded.tenantId;
    const tokenHash = this.hashToken(rawRefreshToken);

    const tokenRecord = await this.tokenRepo.findByTokenHash(tenantId, tokenHash);

    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Check expiration
    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired. Please log in again.');
    }

    // REUSE DETECTION: If this token was already revoked, an attacker or compromised client is reusing it!
    if (tokenRecord.isRevoked) {
      this.logger.error(
        `🚨 SECURITY ALERT: Refresh token reuse detected for user [${tokenRecord.userId}]! Invalidating entire token family [${tokenRecord.familyId}].`
      );
      await this.tokenRepo.revokeFamily(tenantId, tokenRecord.familyId);
      throw new UnauthorizedError('Security violation: Refresh token reuse detected. All sessions revoked.');
    }

    const user = await this.userRepo.findById(tenantId, tokenRecord.userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('User account is inactive or no longer exists');
    }

    // Rotate: Issue new pair within the same token family
    const newTokens = await this.issueTokens(tenantId, user, tokenRecord.familyId, meta);
    await this.tokenRepo.revokeToken(tenantId, tokenRecord.id, newTokens.refreshToken);

    return newTokens;
  }

  /**
   * Logout user by revoking active refresh token
   */
  public async logout(tenantId: string, rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      const tokenRecord = await this.tokenRepo.findByTokenHash(tenantId, tokenHash);
      if (tokenRecord) {
        await this.tokenRepo.revokeToken(tenantId, tokenRecord.id);
      }
    }
  }

  /**
   * Initiates forgot-password flow and generates reset token
   */
  public async forgotPassword(tenantId: string, dto: ForgotPasswordDto): Promise<{ message: string; resetToken?: string }> {
    const user = await this.userRepo.findByEmail(tenantId, dto.email);

    // Always return success message to prevent user enumeration
    if (!user || user.status !== 'active') {
      return { message: 'If an active account exists for that email, a password reset link has been dispatched.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.auth.passwordResetTokenExpiresInMs);

    await this.userRepo.setResetToken(tenantId, user.id, tokenHash, expiresAt);

    this.logger.info(`🔑 Password reset token generated for user [${user.email}]`);

    this.publishEvent('PASSWORD_RESET_REQUESTED', tenantId, {
      userId: user.id,
      email: user.email
    });

    return {
      message: 'If an active account exists for that email, a password reset link has been dispatched.',
      resetToken: config.app.isDevelopment || config.app.isTest ? rawToken : undefined
    };
  }

  /**
   * Resets password using valid token and revokes all existing sessions
   */
  public async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.userRepo.findByResetToken(tokenHash);

    if (!user) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, config.auth.bcryptSaltRounds);
    await this.userRepo.updatePassword(user.tenantId, user.id, passwordHash);

    // Revoke all active sessions for security
    await this.tokenRepo.revokeAllForUser(user.tenantId, user.id);

    this.logger.info(`✅ Password successfully reset for user [${user.email}]`);

    this.publishEvent('PASSWORD_RESET_COMPLETED', user.tenantId, {
      userId: user.id,
      email: user.email
    });

    return { message: 'Password has been successfully reset. Please log in with your new credentials.' };
  }

  /**
   * Retrieves current authenticated user profile
   */
  public async getCurrentUser(tenantId: string, userId: string): Promise<UserDocument> {
    const user = await this.userRepo.findById(tenantId, userId);
    if (!user) {
      throw new NotFoundError('User profile not found');
    }
    return user;
  }

  /**
   * Revokes all active sessions for a user
   */
  public async revokeAllSessions(tenantId: string, userId: string): Promise<void> {
    await this.tokenRepo.revokeAllForUser(tenantId, userId);
    this.logger.info(`🔒 Revoked all sessions for user [${userId}] on tenant [${tenantId}]`);
  }
}

export const authService = new AuthService();
