import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { refreshTokenRepository } from '../src/modules/auth/refresh-token.repository.js';
import { PERMISSIONS, DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Enterprise RBAC & Factory Authorization Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Permissions Catalog & Default Factory Roles', () => {
    it('should retrieve full heat-treatment factory permissions catalog', async () => {
      const token = generateToken('usr_operator', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .get('/api/v1/rbac/permissions')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toContain(PERMISSIONS.PRODUCTION_JOB_CREATE);
      expect(res.body.data).toContain(PERMISSIONS.QUALITY_PYROMETRY_APPROVE_TUS);
      expect(res.body.data).toContain(PERMISSIONS.QUALITY_RECIPE_OVERRIDE);
    });

    it('should retrieve all factory roles for tenant', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue(
        DEFAULT_FACTORY_ROLES.map((r, idx) => ({ ...r, id: `role_${idx}`, tenantId: testTenant } as any))
      );

      const res = await request(app)
        .get('/api/v1/rbac/roles')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(8);
      const roleCodes = res.body.data.map((r: any) => r.code);
      expect(roleCodes).toContain('ADMIN');
      expect(roleCodes).toContain('METALLURGIST');
      expect(roleCodes).toContain('FURNACE_OPERATOR');
      expect(roleCodes).toContain('QC_INSPECTOR');
    });
  });

  describe('GET /api/v1/rbac/me/permissions', () => {
    it('should compute effective permissions for Metallurgist user', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
      jest.spyOn(roleRepository, 'findRolesByCodes').mockResolvedValue([
        DEFAULT_FACTORY_ROLES.find((r) => r.code === 'METALLURGIST') as any
      ]);

      const res = await request(app)
        .get('/api/v1/rbac/me/permissions')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuperAdmin).toBe(false);
      expect(res.body.data.permissions).toContain(PERMISSIONS.QUALITY_RECIPE_OVERRIDE);
      expect(res.body.data.permissions).toContain(PERMISSIONS.QUALITY_PYROMETRY_APPROVE_SAT);
    });

    it('should return super-admin status and all permissions for ADMIN user', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      const res = await request(app)
        .get('/api/v1/rbac/me/permissions')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuperAdmin).toBe(true);
      expect(res.body.data.permissions.length).toBe(Object.keys(PERMISSIONS).length);
    });
  });

  describe('Authorization Middleware Enforcement (requirePermission)', () => {
    it('should block non-admin user without required permission from accessing admin endpoint', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
      jest.spyOn(roleRepository, 'findRolesByCodes').mockResolvedValue([
        DEFAULT_FACTORY_ROLES.find((r) => r.code === 'FURNACE_OPERATOR') as any
      ]);

      // Attempting to access /api/v1/rbac/roles which requires admin:role:view
      const res = await request(app)
        .get('/api/v1/rbac/roles')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });

    it('should allow user with required permission to access endpoint', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);

      const res = await request(app)
        .get('/api/v1/rbac/roles')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Custom Role Creation & Modification', () => {
    it('should create a custom factory role with valid permissions', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(roleRepository, 'findByCode').mockResolvedValue(null);
      jest.spyOn(roleRepository, 'create').mockResolvedValue({
        id: 'role_custom_001',
        tenantId: testTenant,
        code: 'SHIFT_SUPERVISOR',
        name: 'Shift Production Supervisor',
        permissions: [PERMISSIONS.PRODUCTION_JOB_VIEW, PERMISSIONS.PRODUCTION_JOB_START],
        isSystemRole: false
      } as any);

      const res = await request(app)
        .post('/api/v1/rbac/roles')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SHIFT_SUPERVISOR',
          name: 'Shift Production Supervisor',
          permissions: [PERMISSIONS.PRODUCTION_JOB_VIEW, PERMISSIONS.PRODUCTION_JOB_START]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('SHIFT_SUPERVISOR');
    });

    it('should reject custom role creation with invalid permission keys', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(roleRepository, 'findByCode').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/rbac/roles')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'INVALID_ROLE',
          name: 'Invalid Role',
          permissions: ['fake:permission:action']
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid permissions specified');
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('should block non-admin user from assigning a role with permissions they do not possess', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        id: 'usr_target_001',
        tenantId: testTenant,
        email: 'target@factory.com'
      } as any);

      jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
      jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
        return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)) as any;
      });

      // Metallurgist attempts to grant ADMIN role to another user
      const res = await request(app)
        .post('/api/v1/rbac/users/usr_target_001/roles')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          roles: ['ADMIN']
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });

    it('should allow ADMIN to assign roles to user and invalidate existing sessions', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        id: 'usr_target_001',
        tenantId: testTenant,
        email: 'target@factory.com',
        roles: ['FURNACE_OPERATOR']
      } as any);

      jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
      jest.spyOn(roleRepository, 'findRolesByCodes').mockResolvedValue([
        DEFAULT_FACTORY_ROLES.find((r) => r.code === 'QC_INSPECTOR') as any
      ]);
      jest.spyOn(userRepository, 'updateById').mockResolvedValue({} as any);
      const revokeSpy = jest.spyOn(refreshTokenRepository, 'revokeAllForUser').mockResolvedValue();

      const res = await request(app)
        .post('/api/v1/rbac/users/usr_target_001/roles')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roles: ['QC_INSPECTOR']
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(revokeSpy).toHaveBeenCalledWith(testTenant, 'usr_target_001');
    });
  });
});
