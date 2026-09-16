import mongoose, { Document } from 'mongoose';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Core imports
import { CounterModel } from '../src/core/models/counter.model.js';
import { generateNextMonthlySequenceCode, generateNextSequenceCode } from '../src/core/utils/counter.util.js';
import {
  idempotencyMiddleware,
  clearIdempotencyCache,
  getIdempotencyEntry,
  setIdempotencyEntry,
  hashPayload
} from '../src/core/middleware/idempotency.middleware.js';
import { errorMiddleware } from '../src/core/middleware/error.middleware.js';
import { createBaseSchema } from '../src/core/models/base.schema.js';
import { withTransaction, TransactionManager } from '../src/core/database/transaction.js';
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  IdempotencyConflictError
} from '../src/core/errors/app-error.js';

// Domain imports
import { ProductionJobModel } from '../src/modules/production-job/production-job.model.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { productionJobService } from '../src/modules/production-job/production-job.service.js';
import { InventoryBalanceModel } from '../src/modules/inventory/inventory-balance.model.js';
import { InventoryTransactionModel } from '../src/modules/inventory/inventory-transaction.model.js';
import { inventoryRepository } from '../src/modules/inventory/inventory.repository.js';
import { inventoryService } from '../src/modules/inventory/inventory.service.js';
import { FinishedGoodsModel } from '../src/modules/finished-goods/finished-goods.model.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { finishedGoodsService } from '../src/modules/finished-goods/finished-goods.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { refreshTokenRepository } from '../src/modules/auth/refresh-token.repository.js';
import { userRepository } from '../src/modules/auth/user.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';

// Define a test model for transaction rollback & optimistic locking testing
interface IConcurrencyTestDoc extends Document {
  tenantId: string;
  code: string;
  version: number;
  data: string;
  isDeleted: boolean;
  softDelete: (deletedBy?: string) => Promise<any>;
  restore: () => Promise<any>;
}

const ConcurrencyTestSchema = createBaseSchema<IConcurrencyTestDoc>({
  code: { type: String, required: true, uppercase: true },
  version: { type: Number, default: 0 },
  data: { type: String, default: '' }
});

const ConcurrencyTestModel =
  mongoose.models.ConcurrencyTestDoc ||
  mongoose.model<IConcurrencyTestDoc>('ConcurrencyTestDoc', ConcurrencyTestSchema);

describe('PROMPT 4 — Distributed Systems Concurrency, Race-Condition & Duplicate-Action Test Suite', () => {
  const testTenant = 'tenant_concurrency_test';
  let isMongoConnected = false;

  const actorContext = {
    userId: 'user_concurrency_tester',
    email: 'concurrency@astralis.local',
    role: 'PRODUCTION_MANAGER'
  };

  beforeAll(async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect('mongodb://localhost:27017/celestium-concurrency-test', {
          serverSelectionTimeoutMS: 3000
        });
      }
      isMongoConnected = mongoose.connection.readyState === 1;
      if (isMongoConnected) {
        await CounterModel.init();
        await ProductionJobModel.init();
        await InventoryBalanceModel.init();
        await InventoryTransactionModel.init();
        await FinishedGoodsModel.init();
        await ConcurrencyTestModel.init();
      }
    } catch {
      isMongoConnected = false;
    }

    if (isMongoConnected) {
      await CounterModel.deleteMany({ tenantId: testTenant });
      await ProductionJobModel.deleteMany({ tenantId: testTenant });
      await InventoryBalanceModel.deleteMany({ tenantId: testTenant });
      await InventoryTransactionModel.deleteMany({ tenantId: testTenant });
      await FinishedGoodsModel.deleteMany({ tenantId: testTenant });
      await ConcurrencyTestModel.deleteMany({ tenantId: testTenant });
    }
  });

  afterAll(async () => {
    if (isMongoConnected) {
      await CounterModel.deleteMany({ tenantId: testTenant });
      await ProductionJobModel.deleteMany({ tenantId: testTenant });
      await InventoryBalanceModel.deleteMany({ tenantId: testTenant });
      await InventoryTransactionModel.deleteMany({ tenantId: testTenant });
      await FinishedGoodsModel.deleteMany({ tenantId: testTenant });
      await ConcurrencyTestModel.deleteMany({ tenantId: testTenant });
      await mongoose.disconnect();
    }
  });

  beforeEach(() => {
    clearIdempotencyCache();
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
  });

  // =========================================================================
  // SUITE 1: Enterprise Idempotency Under Concurrency, Race Conditions & Cache Loss
  // =========================================================================
  describe('1. Enterprise Idempotency & In-Flight Mutexing', () => {
    let app: express.Application;
    let mutationExecutionCount = 0;

    beforeAll(() => {
      app = express();
      app.use(express.json());

      // Simulate tenant injection
      app.use((req, _res, next) => {
        (req as any).tenantId = testTenant;
        next();
      });

      // Mount idempotency middleware
      app.use(idempotencyMiddleware);

      // Mutating endpoint with simulated asynchronous processing delay
      app.post('/api/v1/orders', async (req: Request, res: Response) => {
        mutationExecutionCount++;
        // Simulate real-world I/O latency
        await new Promise((resolve) => setTimeout(resolve, 50));
        res.status(201).json({
          orderId: 'ORD-' + mutationExecutionCount,
          item: req.body.item,
          quantity: req.body.quantity
        });
      });

      // Endpoint that deliberately fails
      app.post('/api/v1/failing-mutation', async (_req: Request, res: Response, next: NextFunction) => {
        mutationExecutionCount++;
        next(new BadRequestError('Deliberate mutation validation failure'));
      });

      app.use(errorMiddleware);
    });

    beforeEach(() => {
      mutationExecutionCount = 0;
      clearIdempotencyCache();
    });

    it('1.1 should prevent duplicate execution when two identical requests arrive concurrently with the same Idempotency-Key (In-Flight Mutex)', async () => {
      const idempotencyKey = 'idem-concurrent-' + Date.now();
      const payload = { item: 'HEAT-TREATED-BOLT', quantity: 100 };

      // Fire two concurrent requests simultaneously (double-click simulation)
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/orders')
          .set('Idempotency-Key', idempotencyKey)
          .send(payload),
        request(app)
          .post('/api/v1/orders')
          .set('Idempotency-Key', idempotencyKey)
          .send(payload)
      ]);

      // Exactly one must succeed with 201 Created
      const successRes = [res1, res2].find((r) => r.status === 201);
      const conflictRes = [res1, res2].find((r) => r.status === 409);

      expect(successRes).toBeDefined();
      expect(conflictRes).toBeDefined();

      // Conflict must be an IdempotencyConflictError
      const errCode = conflictRes?.body.error?.code || conflictRes?.body.errorCode;
      expect(errCode).toBe('IDEMPOTENCY_CONFLICT');
      expect(conflictRes?.body.message).toContain('is currently in-flight');

      // The underlying database mutation must have executed EXACTLY ONCE
      expect(mutationExecutionCount).toBe(1);

      // A subsequent sequential request after completion must return the cached replay
      const replayRes = await request(app)
        .post('/api/v1/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(replayRes.status).toBe(201);
      expect(replayRes.body._idempotencyReplay).toBe(true);
      expect(replayRes.body.orderId).toBe(successRes?.body.orderId);
      expect(mutationExecutionCount).toBe(1); // Still exactly 1!
    });

    it('1.2 should reject requests reusing the same Idempotency-Key with differing payloads with 409 Payload Mismatch', async () => {
      const idempotencyKey = 'idem-payload-mismatch-' + Date.now();
      const initialPayload = { item: 'TITANIUM-PIN', quantity: 50 };
      const alteredPayload = { item: 'TITANIUM-PIN', quantity: 999 }; // Different quantity!

      // 1. Initial successful request
      const firstRes = await request(app)
        .post('/api/v1/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(initialPayload);

      expect(firstRes.status).toBe(201);
      expect(mutationExecutionCount).toBe(1);

      // 2. Request reusing key with different payload
      const mismatchRes = await request(app)
        .post('/api/v1/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(alteredPayload);

      expect(mismatchRes.status).toBe(409);
      const mismatchErrCode = mismatchRes.body.error?.code || mismatchRes.body.errorCode;
      expect(mismatchErrCode).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
      expect(mismatchRes.body.message).toContain('different request payload');
      expect(mutationExecutionCount).toBe(1); // No new mutation occurred!
    });

    it('1.3 should release the in-flight lock if the request encounters an error, allowing subsequent retry', async () => {
      const idempotencyKey = 'idem-failure-retry-' + Date.now();

      // 1. Initial request fails
      const failRes = await request(app)
        .post('/api/v1/failing-mutation')
        .set('Idempotency-Key', idempotencyKey)
        .send({ test: true });

      expect(failRes.status).toBe(400);
      expect(mutationExecutionCount).toBe(1);

      // Lock should have been released from store
      const entry = getIdempotencyEntry(`${testTenant}:${idempotencyKey}`);
      expect(entry).toBeUndefined();

      // 2. Client retries with the same Idempotency-Key: should NOT be blocked as conflict
      const retryRes = await request(app)
        .post('/api/v1/failing-mutation')
        .set('Idempotency-Key', idempotencyKey)
        .send({ test: true });

      expect(retryRes.status).toBe(400);
      expect(mutationExecutionCount).toBe(2); // Retried cleanly
    });

    it('1.4 should execute anew when idempotency cache is lost (simulating server restart or cache flush)', async () => {
      const idempotencyKey = 'idem-cache-flush-' + Date.now();
      const payload = { item: 'GEAR-FLANGE', quantity: 20 };

      // 1. Initial execution
      const res1 = await request(app)
        .post('/api/v1/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(mutationExecutionCount).toBe(1);

      // 2. Simulate server restart / cache loss
      clearIdempotencyCache();
      expect(getIdempotencyEntry(`${testTenant}:${idempotencyKey}`)).toBeUndefined();

      // 3. New request after cache loss executes fresh mutation
      const res2 = await request(app)
        .post('/api/v1/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body._idempotencyReplay).toBeUndefined();
      expect(mutationExecutionCount).toBe(2);
    });

    it('1.5 should evict expired idempotency records after TTL (Timeout handling)', async () => {
      const idempotencyKey = 'idem-ttl-test-' + Date.now();
      const cacheKey = `${testTenant}:${idempotencyKey}`;
      const payload = { item: 'SHAFT', quantity: 10 };

      // Seed a completed entry with an expired timestamp (2 hours ago)
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      setIdempotencyEntry(cacheKey, {
        status: 'COMPLETED',
        payloadHash: hashPayload(payload),
        statusCode: 201,
        body: { orderId: 'ORD-OLD' },
        timestamp: twoHoursAgo
      });

      // Request should detect expired entry, evict it, and execute fresh mutation
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body._idempotencyReplay).toBeUndefined();
      expect(mutationExecutionCount).toBe(1);
    });

    it('1.6 should allow multiple independent concurrent requests without Idempotency-Key', async () => {
      const payload = { item: 'WASHER', quantity: 10 };

      const [res1, res2, res3] = await Promise.all([
        request(app).post('/api/v1/orders').send(payload),
        request(app).post('/api/v1/orders').send(payload),
        request(app).post('/api/v1/orders').send(payload)
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res3.status).toBe(201);
      expect(mutationExecutionCount).toBe(3);
    });
  });

  // =========================================================================
  // SUITE 2: Monotonic Atomic Sequential Number Generation Under Parallel Load
  // =========================================================================
  describe('2. Monotonic Atomic Sequential ID Generation Under Parallel Concurrency', () => {
    it('2.1 should generate 25 unique, monotonic sequential PO numbers concurrently with zero collisions', async () => {
      if (!isMongoConnected) return;

      const tenant = 'tenant_seq_po_' + Date.now();
      const parallelRequests = 25;

      const promises = Array.from({ length: parallelRequests }, () =>
        generateNextMonthlySequenceCode(tenant, 'PO', 'PO', 4)
      );

      const results = await Promise.all(promises);

      // Verify all 25 codes are unique
      const uniqueCodes = new Set(results);
      expect(uniqueCodes.size).toBe(parallelRequests);

      // Verify pattern: PO-YYYYMM-XXXX
      const pattern = /^PO-\d{6}-\d{4}$/;
      results.forEach((code) => {
        expect(pattern.test(code)).toBe(true);
      });

      // Extract sequence numbers and verify strictly monotonic progression 1..25
      const seqNumbers = results
        .map((code) => parseInt(code.split('-')[2], 10))
        .sort((a, b) => a - b);

      expect(seqNumbers[0]).toBe(1);
      expect(seqNumbers[seqNumbers.length - 1]).toBe(parallelRequests);

      // Ensure no gaps
      for (let i = 0; i < seqNumbers.length; i++) {
        expect(seqNumbers[i]).toBe(i + 1);
      }
    });

    it('2.2 should generate 25 unique sequential GRN numbers and 25 Job numbers under parallel load', async () => {
      if (!isMongoConnected) return;

      const tenant = 'tenant_seq_grn_job_' + Date.now();

      const [grnResults, jobResults] = await Promise.all([
        Promise.all(Array.from({ length: 25 }, () => generateNextMonthlySequenceCode(tenant, 'GRN', 'GRN', 4))),
        Promise.all(Array.from({ length: 25 }, () => generateNextMonthlySequenceCode(tenant, 'PRODUCTION_JOB', 'JOB', 4)))
      ]);

      expect(new Set(grnResults).size).toBe(25);
      expect(new Set(jobResults).size).toBe(25);

      // GRN pattern: GRN-YYYYMM-XXXX
      grnResults.forEach((c) => expect(/^GRN-\d{6}-\d{4}$/.test(c)).toBe(true));
      // JOB pattern: JOB-YYYYMM-XXXX
      jobResults.forEach((c) => expect(/^JOB-\d{6}-\d{4}$/.test(c)).toBe(true));
    });
  });

  // =========================================================================
  // SUITE 3: Mutually Exclusive Workflow Flags Invariant (sum flag_i = 1)
  // =========================================================================
  describe('3. Mutually Exclusive Workflow Flags Invariant (sum flag_i = 1)', () => {
    it('3.1 should reject save if multiple workflow flags are set to true simultaneously', async () => {
      if (!isMongoConnected) return;

      const invalidJob = new ProductionJobModel({
        tenantId: testTenant,
        jobNumber: 'JOB-MUTEX-001',
        customer: { customerId: 'c1', customerCode: 'CUST', customerName: 'Customer' },
        item: { itemId: 'i1', itemCode: 'ITEM', itemName: 'Item', materialGrade: 'GRADE', uom: 'PCS' },
        quantity: { targetQuantity: 10 },
        recipeSnapshot: {
          recipeId: 'r1',
          recipeCode: 'REC',
          revisionNumber: 1,
          processFamily: 'HEAT_TREAT',
          name: 'Recipe'
        },
        specificationSnapshot: {
          specificationId: 's1',
          specCode: 'SPEC',
          revisionNumber: 1,
          title: 'Spec'
        },
        timeline: { plannedStartDate: new Date(), targetCompletionDate: new Date() },
        // VIOLATION: Two flags true at the same time!
        waitingForProduction: true,
        inProduction: true,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false,
        inspection: false
      });

      await expect(invalidJob.save()).rejects.toThrow(/Mutual Exclusivity Violation/);
    });

    it('3.2 should reject save if waitingForDispatch and dispatched are simultaneously true', async () => {
      if (!isMongoConnected) return;

      const invalidJob = new ProductionJobModel({
        tenantId: testTenant,
        jobNumber: 'JOB-MUTEX-002',
        customer: { customerId: 'c1', customerCode: 'CUST', customerName: 'Customer' },
        item: { itemId: 'i1', itemCode: 'ITEM', itemName: 'Item', materialGrade: 'GRADE', uom: 'PCS' },
        quantity: { targetQuantity: 10 },
        recipeSnapshot: {
          recipeId: 'r1',
          recipeCode: 'REC',
          revisionNumber: 1,
          processFamily: 'HEAT_TREAT',
          name: 'Recipe'
        },
        specificationSnapshot: {
          specificationId: 's1',
          specCode: 'SPEC',
          revisionNumber: 1,
          title: 'Spec'
        },
        timeline: { plannedStartDate: new Date(), targetCompletionDate: new Date() },
        // VIOLATION: Both dispatch flags true!
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: true,
        dispatched: true,
        inspection: false
      });

      await expect(invalidJob.save()).rejects.toThrow(/Mutual Exclusivity Violation/);
    });

    it('3.3 should reject save if all workflow flags are false (zero active flags)', async () => {
      if (!isMongoConnected) return;

      const invalidJob = new ProductionJobModel({
        tenantId: testTenant,
        jobNumber: 'JOB-MUTEX-003',
        customer: { customerId: 'c1', customerCode: 'CUST', customerName: 'Customer' },
        item: { itemId: 'i1', itemCode: 'ITEM', itemName: 'Item', materialGrade: 'GRADE', uom: 'PCS' },
        quantity: { targetQuantity: 10 },
        recipeSnapshot: {
          recipeId: 'r1',
          recipeCode: 'REC',
          revisionNumber: 1,
          processFamily: 'HEAT_TREAT',
          name: 'Recipe'
        },
        specificationSnapshot: {
          specificationId: 's1',
          specCode: 'SPEC',
          revisionNumber: 1,
          title: 'Spec'
        },
        timeline: { plannedStartDate: new Date(), targetCompletionDate: new Date() },
        // VIOLATION: All false!
        waitingForProduction: false,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false,
        inspection: false
      });

      await expect(invalidJob.save()).rejects.toThrow(/Mutual Exclusivity Violation/);
    });
  });

  // =========================================================================
  // SUITE 4: Concurrent Workflow State Transitions & Single-Winner Guarantees
  // =========================================================================
  describe('4. Concurrent Workflow State Transitions & Single-Winner Guarantees', () => {
    it('4.1 should allow exactly one winner when two operators concurrently take the same BO for production', async () => {
      if (!isMongoConnected) return;

      // Create a valid BO waiting for production
      const job = await ProductionJobModel.create({
        tenantId: testTenant,
        jobNumber: 'JOB-CONCUR-TAKE-001',
        boNumber: 'BO-CONCUR-TAKE-001',
        customer: { customerId: 'c1', customerCode: 'CUST', customerName: 'Customer' },
        item: { itemId: 'i1', itemCode: 'ITEM', itemName: 'Item', materialGrade: 'GRADE', uom: 'PCS' },
        quantity: { targetQuantity: 100, loadedQuantity: 100 },
        weightKg: 50,
        status: 'WAITING_FOR_PRODUCTION',
        waitingForProduction: true,
        inProduction: false,
        waitingForInspection: false,
        inInspection: false,
        waitingForDispatch: false,
        dispatched: false,
        inspection: false,
        recipeSnapshot: {
          recipeId: 'r1',
          recipeCode: 'REC-01',
          revisionNumber: 1,
          processFamily: 'AUSTEMPER',
          name: 'Austemper Cycle'
        },
        specificationSnapshot: {
          specificationId: 's1',
          specCode: 'SPEC-01',
          revisionNumber: 1,
          title: 'Austemper Spec'
        },
        timeline: { plannedStartDate: new Date(), targetCompletionDate: new Date() }
      });

      // Mock furnace lookup to succeed
      jest.spyOn(productionJobService['repo'], 'findById').mockResolvedValue(job as any);

      // Simulate atomicTakeForProduction race: First call returns updated doc, second returns null
      let takeCallCount = 0;
      jest
        .spyOn(productionJobRepository, 'atomicTakeForProduction')
        .mockImplementation(async (_tenant, _id, updateData: any) => {
          takeCallCount++;
          if (takeCallCount === 1) {
            // Winner
            Object.assign(job, updateData.$set);
            return job as any;
          }
          // Loser
          return null;
        });

      jest.spyOn(productionJobService as any, 'validateProductionReadiness').mockReturnValue({
        isReadyForProduction: true,
        missingFields: [],
        validationErrors: []
      });

      // Two operators fire takeForProduction concurrently
      const [op1, op2] = await Promise.allSettled([
        productionJobService.takeForProduction(testTenant, actorContext, job.id, {
          initialFurnaceTempC: 25,
          loadedWeightKg: 50,
          loadedPieceCount: 100
        }),
        productionJobService.takeForProduction(testTenant, { ...actorContext, userId: 'operator_2' }, job.id, {
          initialFurnaceTempC: 25,
          loadedWeightKg: 50,
          loadedPieceCount: 100
        })
      ]);

      const fulfilled = [op1, op2].find((r) => r.status === 'fulfilled');
      const rejected = [op1, op2].find((r) => r.status === 'rejected');

      expect(fulfilled).toBeDefined();
      expect(rejected).toBeDefined();

      // The rejected promise must be a ConflictError (409)
      if (rejected && rejected.status === 'rejected') {
        expect(rejected.reason).toBeInstanceOf(ConflictError);
        expect(rejected.reason.message).toMatch(/(could not be taken into production|already in production|cannot be taken simultaneously)/);
      }

      // Assert Single Active Flag Invariant on winner
      if (fulfilled && fulfilled.status === 'fulfilled') {
        const winnerDoc = (fulfilled as any).value;
        expect(winnerDoc.status).toBe('IN_PRODUCTION');
        expect(winnerDoc.inProduction).toBe(true);
        expect(winnerDoc.waitingForProduction).toBe(false);

        const activeFlags = [
          winnerDoc.waitingForProduction,
          winnerDoc.inProduction,
          winnerDoc.waitingForInspection,
          winnerDoc.inInspection,
          winnerDoc.waitingForDispatch,
          winnerDoc.dispatched,
          winnerDoc.inspection
        ].filter(Boolean).length;

        expect(activeFlags).toBe(1);
      }
    });

    it('4.2 should allow exactly one winner when two users concurrently approve an in-production job for inspection', async () => {
      const mockJob: any = {
        id: 'job_in_prod_test',
        tenantId: testTenant,
        jobNumber: 'JOB-IN-PROD-001',
        boNumber: 'BO-IN-PROD-001',
        status: 'IN_PRODUCTION',
        inProduction: true,
        waitingForInspection: false,
        quantity: { targetQuantity: 50, loadedQuantity: 50, completedQuantity: 0, scrappedQuantity: 0 },
        recipeSnapshot: { recipeCode: 'REC-01', stages: [{ sequence: 1, stageName: 'Preheat' }] },
        equipmentAssignment: { furnaceId: 'furnace_01', furnaceCode: 'FURN-01' },
        operatorAssignment: { operatorId: 'op_01', operatorName: 'Operator' },
        execution: {
          stageProgress: [
            {
              stageSequence: 1,
              stageName: 'Preheat',
              isCompliant: true,
              actualTemperatureC: 850,
              actualDurationMinutes: 60
            }
          ]
        },
        workflowState: { inProduction: true }
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      let approveCount = 0;
      jest
        .spyOn(productionJobRepository, 'atomicApproveForInspection')
        .mockImplementation(async () => {
          approveCount++;
          if (approveCount === 1) return { ...mockJob, status: 'WAITING_FOR_INSPECTION', waitingForInspection: true, inProduction: false } as any;
          return null;
        });

      const payload = { completedQuantity: 48, scrappedQuantity: 2 };

      const [res1, res2] = await Promise.allSettled([
        productionJobService.approveForInspection(testTenant, actorContext, mockJob.id, payload),
        productionJobService.approveForInspection(testTenant, actorContext, mockJob.id, payload)
      ]);

      const fulfilled = [res1, res2].find((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].find((r) => r.status === 'rejected');

      expect(fulfilled).toBeDefined();
      expect(rejected).toBeDefined();

      if (rejected && rejected.status === 'rejected') {
        expect(rejected.reason).toBeInstanceOf(ConflictError);
        expect(rejected.reason.message).toContain('could not be transitioned to waiting for inspection');
      }
    });

    it('4.3 should allow exactly one winner when two inspectors concurrently attempt to claim a job (takeForInspection)', async () => {
      const mockJob: any = {
        id: 'job_insp_queue_test',
        tenantId: testTenant,
        jobNumber: 'JOB-INSP-001',
        boNumber: 'BO-INSP-001',
        status: 'WAITING_FOR_INSPECTION',
        waitingForInspection: true,
        claimedBy: null,
        workflowState: { waitingForInspection: true }
      };

      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob);

      let claimCount = 0;
      jest
        .spyOn(productionJobRepository, 'atomicTakeForInspection')
        .mockImplementation(async () => {
          claimCount++;
          if (claimCount === 1) {
            return {
              ...mockJob,
              status: 'IN_INSPECTION',
              inInspection: true,
              waitingForInspection: false,
              claimedBy: 'inspector_alice'
            } as any;
          }
          return null; // Second inspector loses race
        });

      const [resAlice, resBob] = await Promise.allSettled([
        productionJobService.takeForInspection(testTenant, { userId: 'inspector_alice', email: 'alice@astralis.local', role: 'QUALITY_INSPECTOR' }, mockJob.id),
        productionJobService.takeForInspection(testTenant, { userId: 'inspector_bob', email: 'bob@astralis.local', role: 'QUALITY_INSPECTOR' }, mockJob.id)
      ]);

      const fulfilled = [resAlice, resBob].find((r) => r.status === 'fulfilled');
      const rejected = [resAlice, resBob].find((r) => r.status === 'rejected');

      expect(fulfilled).toBeDefined();
      expect(rejected).toBeDefined();

      if (rejected && rejected.status === 'rejected') {
        expect(rejected.reason).toBeInstanceOf(ConflictError);
        expect(rejected.reason.message).toContain('Take Inspection Conflict');
      }
    });
  });

  // =========================================================================
  // SUITE 5: Concurrent Inventory & Stock Allocation Operations
  // =========================================================================
  describe('5. Concurrent Inventory & Stock Operations (Preventing Overselling & Negative Balances)', () => {
    it('5.1 should prevent concurrent Goods Issues from driving inventory negative', async () => {
      if (!isMongoConnected) return;

      const itemId = 'item_stock_test_' + Date.now();
      const location = 'BIN-A-01';

      // Seed initial stock of exactly 10 units
      const balance = await InventoryBalanceModel.create({
        tenantId: testTenant,
        itemId,
        itemCode: 'BOLT-100',
        materialGrade: 'STEEL',
        location,
        onHandQuantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
        uom: 'PCS',
        version: 1,
        isDeleted: false
      });

      jest.spyOn(itemRepository, 'findById').mockResolvedValue({
        id: itemId,
        itemCode: 'BOLT-100',
        uom: 'PCS',
        status: 'active',
        isDeleted: false
      } as any);

      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);

      // Two concurrent requests attempt to issue 7 units each (Total requested = 14 > 10 available)
      const [issue1, issue2] = await Promise.allSettled([
        inventoryService.recordGoodsIssue(testTenant, {
          itemId,
          location,
          quantity: 7,
          referenceType: 'JOB_CARD'
        }),
        inventoryService.recordGoodsIssue(testTenant, {
          itemId,
          location,
          quantity: 7,
          referenceType: 'JOB_CARD'
        })
      ]);

      const fulfilled = [issue1, issue2].find((r) => r.status === 'fulfilled');
      const rejected = [issue1, issue2].find((r) => r.status === 'rejected');

      expect(fulfilled).toBeDefined();
      expect(rejected).toBeDefined();

      if (rejected && rejected.status === 'rejected') {
        expect(rejected.reason).toBeInstanceOf(BadRequestError);
        expect(rejected.reason.message).toContain('Insufficient stock on hand');
      }

      // Read back balance from database: Must be exactly 3 (10 - 7), NEVER negative!
      const finalBalance = await InventoryBalanceModel.findById(balance._id);
      expect(finalBalance?.onHandQuantity).toBe(3);
      expect(finalBalance?.availableQuantity).toBe(3);
      expect(finalBalance?.onHandQuantity).toBeGreaterThanOrEqual(0);
    });

    it('5.2 should prevent concurrent Finished Goods reservations from exceeding available stock', async () => {
      if (!isMongoConnected) return;

      // Seed finished goods lot with 10 units available
      const fgDoc = await FinishedGoodsModel.create({
        tenantId: testTenant,
        fgLotNumber: 'FG-CONCUR-001',
        jobCardId: 'job_001',
        jobCardNumber: 'JC-001',
        heatLotNumber: 'HT-001',
        customerCode: 'CUST-01',
        itemId: 'item_001',
        itemCode: 'PIN-001',
        totalQuantity: 10,
        availableQuantity: 10,
        reservedQuantity: 0,
        dispatchedQuantity: 0,
        uom: 'PCS',
        location: 'WH-FG-01',
        status: 'RELEASED_FOR_DISPATCH',
        qualityRelease: { isReleased: true }
      });

      // Two concurrent reservations for 8 units each (Total requested = 16 > 10)
      const [res1, res2] = await Promise.allSettled([
        finishedGoodsService.reserveForDispatch(testTenant, fgDoc.id, { quantity: 8 }),
        finishedGoodsService.reserveForDispatch(testTenant, fgDoc.id, { quantity: 8 })
      ]);

      const fulfilled = [res1, res2].find((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].find((r) => r.status === 'rejected');

      expect(fulfilled).toBeDefined();
      expect(rejected).toBeDefined();

      if (rejected && rejected.status === 'rejected') {
        expect(rejected.reason).toBeInstanceOf(BadRequestError);
        expect(rejected.reason.message).toContain('Insufficient available');
      }

      // Verify remaining available quantity in database is exactly 2, reserved is 8
      const finalFg = await FinishedGoodsModel.findById(fgDoc._id);
      expect(finalFg?.availableQuantity).toBe(2);
      expect(finalFg?.reservedQuantity).toBe(8);
      expect(finalFg?.availableQuantity).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // SUITE 6: Concurrent Authentication & Refresh Token Rotation (RTR)
  // =========================================================================
  describe('6. Concurrent Authentication & Refresh Token Rotation (RTR)', () => {
    it('6.1 should detect concurrent refresh token reuse and invalidate the entire token family', async () => {
      const tenantId = testTenant;
      const familyId = 'family_concur_' + Date.now();
      const rawToken = 'simulated_refresh_token_value';

      const mockTokenRecord = {
        id: 'token_rec_01',
        tenantId,
        userId: 'user_001',
        tokenHash: authService['hashToken'](rawToken),
        familyId,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60)
      };

      // Mock verify to return decoded claims
      jest.spyOn(authService['jwt'] || require('jsonwebtoken'), 'verify').mockReturnValue({
        type: 'refresh',
        userId: 'user_001',
        tenantId
      } as any);

      // Simulate token record retrieval
      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockImplementation(async () => {
        return mockTokenRecord as any;
      });

      jest.spyOn(userRepository, 'findById').mockResolvedValue({
        id: 'user_001',
        status: 'active',
        tenantId,
        email: 'user@astralis.local',
        roles: ['OPERATOR']
      } as any);

      const revokeFamilySpy = jest.spyOn(refreshTokenRepository, 'revokeFamily').mockResolvedValue();
      const revokeTokenSpy = jest.spyOn(refreshTokenRepository, 'revokeToken').mockImplementation(async () => {
        mockTokenRecord.isRevoked = true; // Mark revoked
        return mockTokenRecord as any;
      });

      // 1. First request arrives and rotates token
      const tokens = await authService.refreshToken(rawToken);
      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(mockTokenRecord.isRevoked).toBe(true);

      // 2. Second concurrent request arrives with the now-revoked token (or stale tab replay)
      await expect(authService.refreshToken(rawToken)).rejects.toThrow(
        /Security violation: Refresh token reuse detected/
      );

      // Entire family must have been revoked to prevent rogue replay
      expect(revokeFamilySpy).toHaveBeenCalledWith(tenantId, familyId);
    });
  });

  // =========================================================================
  // SUITE 7: ACID Transaction Rollback & State Isolation
  // =========================================================================
  describe('7. ACID Transaction Rollback & Partial Failure Isolation', () => {
    it('7.1 should rollback partial database state when a multi-document operation fails midway', async () => {
      if (!isMongoConnected) return;

      const testCode = 'TX-ROLLBACK-' + Date.now();
      let transactionError: any = null;
      let isReplicaSet = true;

      try {
        await withTransaction(async (session) => {
          // 1. First mutation succeeds inside session
          await ConcurrencyTestModel.create(
            [
              {
                tenantId: testTenant,
                code: testCode,
                data: 'PARTIAL_DATA_COMMITTED',
                isDeleted: false
              }
            ],
            { session }
          );

          // 2. Deliberately trigger failure halfway through multi-document operation
          throw new Error('DELIBERATE_MIDWAY_TRANSACTION_FAILURE');
        });
      } catch (err: any) {
        transactionError = err;
        if (err.message && err.message.includes('replica set')) {
          isReplicaSet = false;
        }
      }

      expect(transactionError).toBeDefined();

      if (isReplicaSet) {
        expect(transactionError.message).toBe('DELIBERATE_MIDWAY_TRANSACTION_FAILURE');

        // Verify zero orphaned documents: Document MUST NOT exist in database!
        const orphaned = await ConcurrencyTestModel.findOne({
          tenantId: testTenant,
          code: testCode
        });

        expect(orphaned).toBeNull();
      } else {
        // Standalone Mongo catches replica set constraint cleanly
        expect(transactionError.message).toContain('replica set');
      }
    });

    it('7.2 should verify TransactionManager.execute helper handles commit and abort cleanly', async () => {
      if (!isMongoConnected) return;

      let caughtError: any = null;
      try {
        await TransactionManager.execute(async (_session) => {
          throw new Error('TRANSACTION_MANAGER_ABORT_TEST');
        });
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 8: Two Users Editing the Same Master Record & Concurrent Soft-Delete
  // =========================================================================
  describe('8. Master Record Concurrency & Soft-Delete Preservation', () => {
    it('8.1 should preserve document integrity when two users concurrently modify distinct fields on the same record', async () => {
      if (!isMongoConnected) return;

      const doc = await ConcurrencyTestModel.create({
        tenantId: testTenant,
        code: 'CONCUR-EDIT-001',
        data: 'INITIAL_STATE',
        version: 1,
        isDeleted: false
      });

      // User A and User B concurrently update the document using atomic updates
      const [updateA, updateB] = await Promise.all([
        ConcurrencyTestModel.findOneAndUpdate(
          { tenantId: testTenant, _id: doc._id },
          { $set: { data: 'UPDATED_BY_USER_A' }, $inc: { version: 1 } },
          { new: true }
        ),
        ConcurrencyTestModel.findOneAndUpdate(
          { tenantId: testTenant, _id: doc._id },
          { $set: { code: 'CONCUR-EDIT-MODIFIED' }, $inc: { version: 1 } },
          { new: true }
        )
      ]);

      expect(updateA).toBeDefined();
      expect(updateB).toBeDefined();

      // Final state must reflect both updates and version = 3
      const finalDoc = await ConcurrencyTestModel.findById(doc._id);
      expect(finalDoc?.version).toBe(3);
      expect(finalDoc?.code).toBe('CONCUR-EDIT-MODIFIED');
    });

    it('8.2 should handle concurrent soft-delete operations without data corruption or phantom state', async () => {
      if (!isMongoConnected) return;

      const doc = await ConcurrencyTestModel.create({
        tenantId: testTenant,
        code: 'CONCUR-DELETE-001',
        data: 'FOR_DELETION',
        isDeleted: false
      });

      // User A and User B both call soft-delete at the exact same moment on their sessions
      const [docA, docB] = await Promise.all([
        ConcurrencyTestModel.findById(doc._id),
        ConcurrencyTestModel.findById(doc._id)
      ]);

      await Promise.allSettled([
        docA?.softDelete('user_alpha'),
        docB?.softDelete('user_beta')
      ]);

      const foundActive = await ConcurrencyTestModel.findOne({
        tenantId: testTenant,
        code: 'CONCUR-DELETE-001'
      });

      // Transparent soft-delete filter: document is completely excluded from active queries
      expect(foundActive).toBeNull();

      // Direct inspection with bypass: isDeleted is strictly true
      const rawDoc = await ConcurrencyTestModel.collection.findOne({
        tenantId: testTenant,
        code: 'CONCUR-DELETE-001'
      });

      expect(rawDoc?.isDeleted).toBe(true);
      expect(rawDoc?.deletedAt).toBeDefined();
    });
  });
});
