import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { refreshTokenRepository } from '../src/modules/auth/refresh-token.repository.js';

describe('Auth & Identity Subsystem (End-to-End API Integration & Token Lifecycle)', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';
  const otherTenant = 'tenant_heat_treat_999';

  const mockUser: any = {
    id: 'usr_mock_123',
    tenantId: testTenant,
    email: 'metallurgist@astralis.factory',
    username: 'met_lead',
    passwordHash: '',
    firstName: 'Elena',
    lastName: 'Vance',
    roles: ['metallurgist'],
    status: 'active',
    failedLoginAttempts: 0
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('SecureHeatP@ss123', 10);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new user under a tenant', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
      jest.spyOn(userRepository, 'create').mockResolvedValue({
        ...mockUser,
        id: 'usr_new_001',
        email: 'operator1@astralis.factory',
        username: 'operator1',
        roles: ['operator']
      });
      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('x-tenant-id', testTenant)
        .send({
          email: 'operator1@astralis.factory',
          username: 'operator1',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Smith'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('operator1@astralis.factory');
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should reject registration with duplicate email under the tenant', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('x-tenant-id', testTenant)
        .send({
          email: 'metallurgist@astralis.factory',
          username: 'new_username',
          password: 'Password123',
          firstName: 'Duplicate',
          lastName: 'User'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered');
    });

    it('should reject registration with invalid password format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('x-tenant-id', testTenant)
        .send({
          email: 'test@factory.com',
          username: 'testuser',
          password: 'weak',
          firstName: 'A',
          lastName: 'B'
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Request validation failed');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      jest.spyOn(userRepository, 'findByIdentifier').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'recordLoginSuccess').mockResolvedValue();
      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-tenant-id', testTenant)
        .send({
          identifier: 'metallurgist@astralis.factory',
          password: 'SecureHeatP@ss123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe(mockUser.email);
    });

    it('should reject login with incorrect password', async () => {
      jest.spyOn(userRepository, 'findByIdentifier').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'recordFailedAttempt').mockResolvedValue();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-tenant-id', testTenant)
        .send({
          identifier: 'metallurgist@astralis.factory',
          password: 'WrongPassword123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid credentials');
    });

    it('should reject login for non-existent user', async () => {
      jest.spyOn(userRepository, 'findByIdentifier').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-tenant-id', testTenant)
        .send({
          identifier: 'ghost@astralis.factory',
          password: 'Password123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Access Token Validation (authenticateJwt Middleware)', () => {
    it('1. should accept a valid access token and populate user profile', async () => {
      const validAccessToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, email: mockUser.email, roles: mockUser.roles, type: 'access' },
        config.auth.jwtSecret,
        { expiresIn: '15m' }
      );

      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(mockUser.email);
    });

    it('2. should reject an expired access token with explicit session expired message', async () => {
      const expiredAccessToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, email: mockUser.email, roles: mockUser.roles, type: 'access' },
        config.auth.jwtSecret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredAccessToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Session expired: Access token has expired');
    });

    it('3. should reject an invalid signature (tampered access token)', async () => {
      const tamperedToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, email: mockUser.email, roles: mockUser.roles, type: 'access' },
        'wrong_tampered_secret_key_12345678901234567890'
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid access token');
    });

    it('4. should reject request when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Missing Bearer token');
    });

    it('5. should reject request when wrong token type is used (e.g. Refresh Token sent as Bearer)', async () => {
      const signedRefreshTokenAsBearer = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, familyId: 'fam_001', type: 'refresh' },
        config.auth.jwtSecret
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${signedRefreshTokenAsBearer}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid token type: Access token required');
    });
  });

  describe('Refresh Token Lifecycle & Rotation (POST /api/v1/auth/refresh-token)', () => {
    it('6. should rotate valid refresh token, persist new token pair, and revoke old token', async () => {
      const familyId = 'fam_001';
      const signedRefreshToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, familyId, type: 'refresh' },
        config.auth.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValue({
        id: 'tok_001',
        tenantId: testTenant,
        userId: mockUser.id,
        familyId,
        expiresAt: new Date(Date.now() + 1000000),
        isRevoked: false
      } as any);

      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);
      const createTokenSpy = jest.spyOn(refreshTokenRepository, 'create').mockResolvedValue({} as any);
      const revokeTokenSpy = jest.spyOn(refreshTokenRepository, 'revokeToken').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: signedRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(createTokenSpy).toHaveBeenCalled();
      expect(revokeTokenSpy).toHaveBeenCalledWith(testTenant, 'tok_001', expect.any(String));
    });

    it('7. should also support alias route POST /api/v1/auth/refresh', async () => {
      const familyId = 'fam_alias_001';
      const signedRefreshToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, familyId, type: 'refresh' },
        config.auth.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValue({
        id: 'tok_alias_001',
        tenantId: testTenant,
        userId: mockUser.id,
        familyId,
        expiresAt: new Date(Date.now() + 1000000),
        isRevoked: false
      } as any);

      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValue({} as any);
      jest.spyOn(refreshTokenRepository, 'revokeToken').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: signedRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('8. should reject an expired refresh token', async () => {
      const familyId = 'fam_expired';
      const expiredRefreshToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, familyId, type: 'refresh' },
        config.auth.jwtRefreshSecret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: expiredRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Refresh token has expired');
    });

    it('9. should detect reuse of a revoked refresh token and invalidate the entire token family', async () => {
      const familyId = 'fam_compromised';
      const signedRefreshToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, familyId, type: 'refresh' },
        config.auth.jwtRefreshSecret
      );

      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValue({
        id: 'tok_revoked_001',
        tenantId: testTenant,
        userId: mockUser.id,
        familyId,
        expiresAt: new Date(Date.now() + 100000),
        isRevoked: true
      } as any);

      const revokeFamilySpy = jest.spyOn(refreshTokenRepository, 'revokeFamily').mockResolvedValue();

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: signedRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Refresh token reuse detected');
      expect(revokeFamilySpy).toHaveBeenCalledWith(testTenant, familyId);
    });

    it('10. should reject refresh when wrong token type is supplied (e.g. Access Token passed to refresh endpoint)', async () => {
      const signedAccessToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, email: mockUser.email, roles: mockUser.roles, type: 'access' },
        config.auth.jwtRefreshSecret
      );

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: signedAccessToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid token type: Refresh token required');
    });

    it('11. should reject refresh when user account is inactive or missing', async () => {
      const familyId = 'fam_inactive';
      const signedRefreshToken = jwt.sign(
        { userId: 'usr_inactive_001', tenantId: testTenant, familyId, type: 'refresh' },
        config.auth.jwtRefreshSecret
      );

      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValue({
        id: 'tok_002',
        tenantId: testTenant,
        userId: 'usr_inactive_001',
        familyId,
        expiresAt: new Date(Date.now() + 100000),
        isRevoked: false
      } as any);

      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        ...mockUser,
        status: 'inactive'
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: signedRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('User account is inactive');
    });

    it('12. should reject cross-tenant spoofing when tenant header does not match token claim', async () => {
      const familyId = 'fam_tenant_mismatch';
      const signedRefreshToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, familyId, type: 'refresh' },
        config.auth.jwtRefreshSecret
      );

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('x-tenant-id', otherTenant)
        .send({ refreshToken: signedRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Tenant header does not match');
    });
  });

  describe('Session Termination & Logout (POST /api/v1/auth/logout)', () => {
    it('should revoke specific refresh token on logout', async () => {
      const validAccessToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, email: mockUser.email, roles: mockUser.roles, type: 'access' },
        config.auth.jwtSecret
      );

      const rawRefreshToken = 'tok_refresh_to_logout';
      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValue({
        id: 'tok_db_123',
        tenantId: testTenant
      } as any);
      const revokeTokenSpy = jest.spyOn(refreshTokenRepository, 'revokeToken').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ refreshToken: rawRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(revokeTokenSpy).toHaveBeenCalledWith(testTenant, 'tok_db_123');
    });
  });

  describe('Password Reset Lifecycle & Security Model', () => {
    it('should generate password reset token via forgot-password endpoint', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'setResetToken').mockResolvedValue();

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .set('x-tenant-id', testTenant)
        .send({ email: mockUser.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('password reset link has been dispatched');
    });

    it('should reset password and revoke ALL active user sessions for security', async () => {
      jest.spyOn(userRepository, 'findByResetToken').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'updatePassword').mockResolvedValue(mockUser);
      const revokeAllSpy = jest.spyOn(refreshTokenRepository, 'revokeAllForUser').mockResolvedValue();

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'valid_reset_token_hex_12345',
          newPassword: 'BrandNewPassword123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(revokeAllSpy).toHaveBeenCalledWith(testTenant, mockUser.id);
    });
  });
});
