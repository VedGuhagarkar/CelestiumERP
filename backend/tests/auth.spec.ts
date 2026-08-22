import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { refreshTokenRepository } from '../src/modules/auth/refresh-token.repository.js';

describe('Auth & Identity Subsystem (End-to-End API Integration)', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

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
          password: 'weak', // too short, no uppercase/numbers
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

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should rotate refresh token and issue new token pair', async () => {
      const familyId = 'fam_001';
      const signedRefreshToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, familyId },
        config.auth.jwtRefreshSecret
      );

      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValue({
        id: 'tok_001',
        tenantId: testTenant,
        userId: mockUser.id,
        familyId,
        expiresAt: new Date(Date.now() + 100000),
        isRevoked: false
      } as any);

      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValue({} as any);
      jest.spyOn(refreshTokenRepository, 'revokeToken').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: signedRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should detect reuse of a revoked refresh token and invalidate the entire token family', async () => {
      const familyId = 'fam_compromised';
      const signedRefreshToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, familyId },
        config.auth.jwtRefreshSecret
      );

      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValue({
        id: 'tok_revoked_001',
        tenantId: testTenant,
        userId: mockUser.id,
        familyId,
        expiresAt: new Date(Date.now() + 100000),
        isRevoked: true // ALREADY REVOKED!
      } as any);

      const revokeFamilySpy = jest.spyOn(refreshTokenRepository, 'revokeFamily').mockResolvedValue();

      const res = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({ refreshToken: signedRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Refresh token reuse detected');
      expect(revokeFamilySpy).toHaveBeenCalledWith(testTenant, familyId);
    });
  });

  describe('GET /api/v1/auth/me (Protected Route)', () => {
    it('should return authenticated user profile when valid Bearer token is provided', async () => {
      const validAccessToken = jwt.sign(
        { userId: mockUser.id, tenantId: testTenant, email: mockUser.email, roles: mockUser.roles },
        config.auth.jwtSecret
      );

      jest.spyOn(userRepository, 'findById').mockResolvedValue(mockUser);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(mockUser.email);
    });

    it('should reject request when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request when token is expired or invalid', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_signature_token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Password Reset Lifecycle', () => {
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

    it('should reset password and revoke active sessions when valid reset token is provided', async () => {
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
