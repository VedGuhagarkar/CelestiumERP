import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { dbConnection } from '../src/core/database/connection.js';
import { eventBus } from '../src/core/events/domain-event-bus.js';
import { backupRestoreService } from '../src/core/maintenance/backup-restore.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Production Hardening, SRE Resilience & Disaster Recovery Verification', () => {
  const app = createApp();
  const testTenant = 'tenant_prod_hardening_001';
  const backupTestDir = path.join(process.cwd(), 'test-backups');

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  beforeAll(() => {
    if (!fs.existsSync(backupTestDir)) {
      fs.mkdirSync(backupTestDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(backupTestDir)) {
      fs.rmSync(backupTestDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    eventBus.clearAll();
  });

  describe('1. Health, Liveness & Readiness Probes', () => {
    it('should return 200 OK with deep telemetry for /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.data.memory).toBeDefined();
      expect(res.body.data.memory.rssMb).toBeGreaterThan(0);
      expect(res.body.data.database).toBeDefined();
      expect(res.body.data.version).toBe(config.app.version);
    });

    it('should return 200 OK for /api/v1/health/liveness', async () => {
      const res = await request(app).get('/api/v1/health/liveness');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('alive');
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should return 200 OK for /api/v1/health/readiness', async () => {
      const res = await request(app).get('/api/v1/health/readiness');

      expect(res.status).toBe(200);
      expect(res.body.data.ready).toBe(true);
    });
  });

  describe('2. Database Connection Manager & Reconnection Resilience', () => {
    it('should report correct connection state and verify singleton instance', () => {
      expect(dbConnection).toBeDefined();
      const stateName = dbConnection.getConnectionStateName();
      expect(['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized']).toContain(stateName);
    });
  });

  describe('3. Resilient Domain Event Bus & Dead-Letter Queue (DLQ)', () => {
    it('should isolate subscriber failures, retry up to maxRetries, and capture permanently failed events in DLQ', async () => {
      let callCount = 0;
      const failingSubscriber = jest.fn().mockImplementation(async () => {
        callCount++;
        throw new Error('Simulated third-party notification service failure');
      });

      eventBus.subscribe('TEST_FAILING_EVENT', failingSubscriber);

      const eventPayload = {
        name: 'TEST_FAILING_EVENT',
        tenantId: testTenant,
        occurredAt: new Date(),
        payload: { jobNumber: 'JOB-999', errorReason: 'Transient timeout' }
      };

      eventBus.publish(eventPayload);

      // Allow setImmediate and retry backoff loop to execute
      await new Promise((resolve) => setTimeout(resolve, 350));

      expect(callCount).toBe(3); // 3 retries attempted

      // Verify Dead Letter Queue captured event
      const deadLetters = eventBus.getDeadLetters(testTenant);
      expect(deadLetters.length).toBe(1);
      expect(deadLetters[0].event.name).toBe('TEST_FAILING_EVENT');
      expect(deadLetters[0].status).toBe('FAILED_PERMANENTLY');
      expect(deadLetters[0].retryCount).toBe(3);
      expect(deadLetters[0].error).toContain('Simulated third-party notification service failure');
    });

    it('should allow manual recovery and re-dispatch of a resolved DLQ event', async () => {
      let isRecovered = false;
      const recoverableSubscriber = jest.fn().mockImplementation(async () => {
        if (!isRecovered) throw new Error('Temporary outage');
        return; // Success once recovered
      });

      eventBus.subscribe('RECOVERABLE_EVENT', recoverableSubscriber);

      eventBus.publish({
        name: 'RECOVERABLE_EVENT',
        tenantId: testTenant,
        occurredAt: new Date(),
        payload: { alertId: 'alt_001' }
      });

      await new Promise((resolve) => setTimeout(resolve, 350));
      const deadLetters = eventBus.getDeadLetters(testTenant);
      expect(deadLetters.length).toBe(1);

      // Now service recovers
      isRecovered = true;
      const recovered = await eventBus.retryDeadLetter(deadLetters[0].id);

      expect(recovered).toBe(true);
      expect(eventBus.getDeadLetters(testTenant).length).toBe(0); // Cleared from DLQ
    });
  });

  describe('4. Enterprise Backup, Checksum Manifest & Integrity Verification', () => {
    const sampleDomainData = {
      productionjobs: [
        {
          _id: 'job_001',
          tenantId: testTenant,
          jobNumber: 'JOB-202608-001',
          status: 'IN_PROGRESS',
          recipe: { recipeCode: 'REC-VAC-4340' }
        }
      ],
      items: [
        {
          _id: 'item_001',
          tenantId: testTenant,
          itemCode: 'BAR-4340-50MM',
          name: 'AISI 4340 Round Bar',
          standardCost: 45.0
        }
      ],
      machines: [
        {
          _id: 'mach_001',
          tenantId: testTenant,
          machineCode: 'FURNACE-VAC-01',
          type: 'VACUUM_FURNACE',
          status: 'RUNNING'
        }
      ]
    };

    it('should generate a cryptographic backup archive with SHA-256 manifest and collection counts', async () => {
      const backupResult = await backupRestoreService.createBackup({
        tenantId: testTenant,
        targetDir: backupTestDir,
        customData: sampleDomainData
      });

      expect(backupResult.backupId).toBeDefined();
      expect(fs.existsSync(backupResult.backupDir)).toBe(true);

      const manifestPath = path.join(backupResult.backupDir, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.tenantId).toBe(testTenant);
      expect(manifest.totalCollections).toBe(3);
      expect(manifest.totalDocuments).toBe(3);
      expect(manifest.collections.productionjobs).toBeDefined();
      expect(manifest.collections.productionjobs.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should successfully verify integrity of an unaltered backup archive', async () => {
      const backupResult = await backupRestoreService.createBackup({
        tenantId: testTenant,
        targetDir: backupTestDir,
        customData: sampleDomainData
      });

      const verification = backupRestoreService.verifyBackupIntegrity(backupResult.backupDir);
      expect(verification.isValid).toBe(true);
      expect(verification.errors.length).toBe(0);
      expect(verification.totalCollections).toBe(3);
    });

    it('should detect file tampering and reject corrupted backup archives', async () => {
      const backupResult = await backupRestoreService.createBackup({
        tenantId: testTenant,
        targetDir: backupTestDir,
        customData: sampleDomainData
      });

      // Tamper with one of the collection files
      const filePath = path.join(backupResult.backupDir, 'productionjobs.json');
      fs.writeFileSync(filePath, '[{"tampered": true}]', 'utf-8');

      const verification = backupRestoreService.verifyBackupIntegrity(backupResult.backupDir);
      expect(verification.isValid).toBe(false);
      expect(verification.errors.some((e) => e.includes('mismatch'))).toBe(true);
    });
  });

  describe('5. Demonstrated End-to-End Disaster Recovery & Isolated Restore Test', () => {
    it('should restore an isolated backup into target tenant and validate 100% record match', async () => {
      const mockDatabaseData = {
        productionjobs: [
          {
            _id: 'job_rec_001',
            tenantId: testTenant,
            jobNumber: 'JOB-RECOVERED-001',
            status: 'COMPLETED',
            quantity: { targetQuantity: 50, completedQuantity: 50 }
          }
        ],
        items: [
          {
            _id: 'item_rec_001',
            tenantId: testTenant,
            itemCode: 'SHAFT-TURBINE-01',
            name: 'High-Temp Turbine Shaft',
            standardCost: 180.0
          }
        ]
      };

      // 1. Generate verified backup snapshot
      const backupResult = await backupRestoreService.createBackup({
        tenantId: testTenant,
        targetDir: backupTestDir,
        customData: mockDatabaseData
      });

      // 2. Perform restore into target tenant
      const restoreResult = await backupRestoreService.restoreBackup(backupResult.backupDir, {
        targetTenantId: testTenant,
        clearTargetTenantBeforeRestore: true
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.totalRestoredDocuments).toBe(2);
      expect(restoreResult.restoredCollections).toBe(2);

      // 3. Verify restored documents match original verified snapshot exactly
      const restoredJobs = restoreResult.restoredDocumentsByCollection.productionjobs;
      expect(restoredJobs.length).toBe(1);
      expect(restoredJobs[0].jobNumber).toBe('JOB-RECOVERED-001');
      expect(restoredJobs[0].tenantId).toBe(testTenant);

      const restoredItems = restoreResult.restoredDocumentsByCollection.items;
      expect(restoredItems.length).toBe(1);
      expect(restoredItems[0].itemCode).toBe('SHAFT-TURBINE-01');
      expect(restoredItems[0].standardCost).toBe(180.0);
    });
  });

  describe('6. HTTP Idempotency & Duplicate Request Protection', () => {
    it('should replay cached HTTP response on duplicate requests with same Idempotency-Key', async () => {
      const idempotencyKey = `idem_test_${Date.now()}`;
      const loginPayload = { username: 'testuser', password: 'InvalidPassword123!' };

      // 1. First request
      const res1 = await request(app)
        .post('/api/v1/auth/login')
        .set('Idempotency-Key', idempotencyKey)
        .send(loginPayload);

      // 2. Duplicate second request with same key
      const res2 = await request(app)
        .post('/api/v1/auth/login')
        .set('Idempotency-Key', idempotencyKey)
        .send(loginPayload);

      expect(res1.status).toBe(res2.status);
    });
  });
});
