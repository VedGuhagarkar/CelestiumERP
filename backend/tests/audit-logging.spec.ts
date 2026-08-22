import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { auditLogRepository } from '../src/modules/audit/audit-log.repository.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Audit Logging & Compliance Subsystem', () => {
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

  describe('State Difference Calculation (computeDiff)', () => {
    it('should accurately compute field changes between before and after snapshots', () => {
      const beforeState = {
        recipeName: 'Carburizing Low Alloy Steel',
        austenitizingTempC: 930,
        soakTimeMinutes: 120,
        atmosphereCp: 0.85
      };

      const afterState = {
        recipeName: 'Carburizing Low Alloy Steel',
        austenitizingTempC: 950, // Modified
        soakTimeMinutes: 140, // Modified
        atmosphereCp: 0.85 // Unchanged
      };

      const diff = auditService.computeDiff(beforeState, afterState);

      expect(diff).toBeDefined();
      expect(diff!.austenitizingTempC).toEqual({ old: 930, new: 950 });
      expect(diff!.soakTimeMinutes).toEqual({ old: 120, new: 140 });
      expect(diff!.atmosphereCp).toBeUndefined();
    });

    it('should return undefined when before and after states are identical', () => {
      const state = { temp: 850, cycle: 'Annealing' };
      const diff = auditService.computeDiff(state, { ...state });
      expect(diff).toBeUndefined();
    });

    it('should handle newly added and removed fields', () => {
      const before = { gasQuenchPressureBar: 5 };
      const after = { gasQuenchPressureBar: 5, fanSpeedRpm: 1800 };

      const diff = auditService.computeDiff(before, after);
      expect(diff).toBeDefined();
      expect(diff!.fanSpeedRpm).toEqual({ old: null, new: 1800 });
    });
  });

  describe('Audit Service Recording (auditService.record)', () => {
    it('should sanitize sensitive data before persisting audit log entry', async () => {
      const createSpy = jest.spyOn(auditLogRepository, 'create').mockImplementation(async (_tenant, doc: any) => {
        return { ...doc, id: 'audit_001', tenantId: testTenant } as any;
      });

      const auditRecord = await auditService.record(testTenant, {
        actorId: 'usr_met_01',
        actorEmail: 'lead_met@factory.com',
        actorRole: 'METALLURGIST',
        action: 'RECIPE_OVERRIDE',
        entityType: 'Recipe',
        entityId: 'rec_4140_ht',
        beforeState: {
          targetHardnessHRC: 32,
          jwtSecret: 'internal_secret_do_not_leak'
        },
        afterState: {
          targetHardnessHRC: 36,
          jwtSecret: 'internal_secret_do_not_leak'
        }
      });

      expect(createSpy).toHaveBeenCalled();
      expect(auditRecord.beforeState.jwtSecret).toBe('***MASKED***');
      expect(auditRecord.afterState.jwtSecret).toBe('***MASKED***');
      expect(auditRecord.diff).toEqual({
        targetHardnessHRC: { old: 32, new: 36 }
      });
    });
  });

  describe('Audit API Endpoints', () => {
    it('should query audit logs with pagination and filters', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(auditLogRepository, 'queryAuditLogs').mockResolvedValue({
        items: [
          {
            id: 'audit_001',
            tenantId: testTenant,
            actorId: 'usr_met_01',
            action: 'RECIPE_OVERRIDE',
            entityType: 'Recipe',
            entityId: 'rec_001',
            status: 'SUCCESS',
            occurredAt: new Date()
          } as any
        ],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/audit/logs?entityType=Recipe&action=RECIPE_OVERRIDE')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('RECIPE_OVERRIDE');
    });

    it('should retrieve chronological audit history for a specific entity', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(auditLogRepository, 'findEntityHistory').mockResolvedValue([
        {
          id: 'audit_002',
          tenantId: testTenant,
          actorId: 'usr_met_01',
          action: 'RECIPE_CREATED',
          entityType: 'Recipe',
          entityId: 'rec_4140_01',
          occurredAt: new Date()
        } as any
      ]);

      const res = await request(app)
        .get('/api/v1/audit/entities/Recipe/rec_4140_01')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].entityId).toBe('rec_4140_01');
    });
  });
});
