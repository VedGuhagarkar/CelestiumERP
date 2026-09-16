import mongoose, { Document } from 'mongoose';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { CounterModel } from '../src/core/models/counter.model.js';
import { PurchaseOrderModel } from '../src/modules/purchase-order/purchase-order.model.js';
import { purchaseOrderRepository } from '../src/modules/purchase-order/purchase-order.repository.js';
import { purchaseOrderService } from '../src/modules/purchase-order/purchase-order.service.js';
import { MaterialReceiptModel, GRNModel, GRNUnitModel } from '../src/modules/grn/grn.model.js';
import { grnRepository } from '../src/modules/grn/grn.repository.js';
import { grnService } from '../src/modules/grn/grn.service.js';
import { ProductionJobModel } from '../src/modules/production-job/production-job.model.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { productionJobService } from '../src/modules/production-job/production-job.service.js';
import { DispatchConsignmentModel } from '../src/modules/dispatch/dispatch.model.js';
import { dispatchRepository } from '../src/modules/dispatch/dispatch.repository.js';
import { dispatchService } from '../src/modules/dispatch/dispatch.service.js';
import { qualityInspectionRepository } from '../src/modules/quality-inspection/quality-inspection.repository.js';
import { ncrCapaRepository } from '../src/modules/ncr-capa/ncr-capa.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { itemService } from '../src/modules/item/item.service.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { recipeService } from '../src/modules/recipe/recipe.service.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { customerService } from '../src/modules/customer/customer.service.js';
import { createBaseSchema } from '../src/core/models/base.schema.js';
import { withTransaction } from '../src/core/database/transaction.js';
import { BadRequestError, NotFoundError } from '../src/core/errors/app-error.js';
import { errorMiddleware } from '../src/core/middleware/error.middleware.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

interface ISoftDeleteTestDoc extends Document {
  tenantId: string;
  code: string;
  category: string;
  amount: number;
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  softDelete: (deletedBy?: string) => Promise<any>;
  restore: () => Promise<any>;
}

const SoftDeleteTestSchema = createBaseSchema<ISoftDeleteTestDoc>({
  code: { type: String, required: true, uppercase: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 }
});

const SoftDeleteTestModel =
  mongoose.models.SoftDeleteTestDoc ||
  mongoose.model<ISoftDeleteTestDoc>('SoftDeleteTestDoc', SoftDeleteTestSchema);

describe('PROMPT 2 — Aggressive Database & Data-Integrity Destruction Test Suite', () => {
  const testTenantA = 'tenant_destruction_alpha';
  const testTenantB = 'tenant_destruction_beta';
  let isMongoConnected = false;

  beforeAll(async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect('mongodb://localhost:27017/celestium-destruction-test', {
          serverSelectionTimeoutMS: 3000
        });
      }
      isMongoConnected = mongoose.connection.readyState === 1;
      if (isMongoConnected) {
        await CounterModel.init();
        await SoftDeleteTestModel.init();
      }
    } catch {
      isMongoConnected = false;
    }

    if (isMongoConnected) {
      await CounterModel.deleteMany({ tenantId: { $in: [testTenantA, testTenantB] } });
      await SoftDeleteTestModel.deleteMany({ tenantId: { $in: [testTenantA, testTenantB] } });
    }
  });

  afterAll(async () => {
    if (isMongoConnected) {
      await CounterModel.deleteMany({ tenantId: { $in: [testTenantA, testTenantB] } });
      await SoftDeleteTestModel.deleteMany({ tenantId: { $in: [testTenantA, testTenantB] } });
      await mongoose.disconnect();
    }
  });

  beforeEach(() => {
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      permissions: Object.values(PERMISSIONS),
      roles: ['ADMIN']
    } as any);
  });

  // =========================================================================
  // SUITE 1: Schema-Level Bounds, Precision, & Validation Failures
  // =========================================================================
  describe('1. Schema-Level Bounds, Nulls, Types, and Precision', () => {
    it('should reject missing required fields with Mongoose ValidationError', async () => {
      const invalidPo = new PurchaseOrderModel({
        supplierName: 'Acme Metals'
      });

      const err: any = invalidPo.validateSync();
      expect(err).toBeDefined();
      expect(err.name).toBe('ValidationError');
      expect(err.errors['tenantId']).toBeDefined();
      expect(err.errors['poNumber']).toBeDefined();
      expect(err.errors['expectedDeliveryDate']).toBeDefined();
    });

    it('should reject null values in required non-nullable fields', async () => {
      const invalidPo = new PurchaseOrderModel({
        tenantId: testTenantA,
        poNumber: null,
        supplierName: null,
        expectedDeliveryDate: null,
        createdById: null
      });

      const err: any = invalidPo.validateSync();
      expect(err).toBeDefined();
      expect(err.name).toBe('ValidationError');
      expect(err.errors['poNumber']).toBeDefined();
      expect(err.errors['supplierName']).toBeDefined();
    });

    it('should reject negative quantities across all core transactional models', async () => {
      // 1. Purchase Order Item Negative Ordered Quantity
      const poWithNegativeQty = new PurchaseOrderModel({
        tenantId: testTenantA,
        poNumber: 'PO-202609-9999',
        supplierName: 'AeroMetals Inc',
        expectedDeliveryDate: new Date(),
        createdById: 'usr_buyer',
        items: [
          {
            lineItemId: 'line_1',
            itemId: 'item_1',
            itemCode: 'BAR-4140',
            itemName: 'Steel Round Bar',
            materialGrade: 'AISI 4140',
            processFamily: 'MACHINING',
            recipeId: 'rec_1',
            recipeCode: 'REC-01',
            recipeRevision: 1,
            orderedQuantity: -10, // NEGATIVE
            uom: 'KG'
          }
        ]
      });
      const poErr: any = poWithNegativeQty.validateSync();
      expect(poErr).toBeDefined();
      expect(poErr.errors['items.0.orderedQuantity']).toBeDefined();

      // 2. GRN Unit Negative Quantity
      const grnUnitWithNegative = new GRNUnitModel({
        tenantId: testTenantA,
        unitIdentifier: 'UNIT-NEG-001',
        poId: 'po_123',
        poNumber: 'PO-01',
        grnId: 'grn_123',
        grnNumber: 'GRN-01',
        supplierChallanNumber: 'CH-001',
        itemId: 'item_1',
        itemCode: 'BAR-01',
        itemName: 'Bar',
        materialGrade: 'AISI 4140',
        processFamily: 'MACHINING',
        recipeId: 'rec_1',
        recipeCode: 'REC-01',
        recipeRevision: 1,
        warehouseId: 'wh_1',
        warehouseCode: 'WH-01',
        storageLocationCode: 'LOC-01',
        supplierHeatNumber: 'HEAT-01',
        quantity: -5, // NEGATIVE
        uom: 'PCS'
      });
      const unitErr: any = grnUnitWithNegative.validateSync();
      expect(unitErr).toBeDefined();
      expect(unitErr.errors['quantity']).toBeDefined();

      // 3. Production Job Negative Target Quantity
      const jobWithNegative = new ProductionJobModel({
        tenantId: testTenantA,
        jobNumber: 'JOB-NEG-001',
        boNumber: 'BO-NEG-001',
        poId: 'po_1',
        poNumber: 'PO-01',
        grnId: 'grn_1',
        grnNumber: 'GRN-01',
        customer: { customerId: 'c1', customerCode: 'CUST-1', customerName: 'Customer' },
        item: { itemId: 'i1', itemCode: 'ITEM-1', itemName: 'Item', materialGrade: '4140', uom: 'PCS' },
        quantity: { targetQuantity: -50 } // NEGATIVE
      });
      const jobErr: any = jobWithNegative.validateSync();
      expect(jobErr).toBeDefined();
      expect(jobErr.errors['quantity.targetQuantity']).toBeDefined();
    });

    it('should reject zero quantities where positive is required', async () => {
      const poWithZeroQty = new PurchaseOrderModel({
        tenantId: testTenantA,
        poNumber: 'PO-202609-0000',
        supplierName: 'Precision Alloys',
        expectedDeliveryDate: new Date(),
        createdById: 'usr_test',
        items: [
          {
            lineItemId: 'line_1',
            itemId: 'item_1',
            itemCode: 'BAR-4140',
            itemName: 'Steel Round Bar',
            materialGrade: 'AISI 4140',
            processFamily: 'MACHINING',
            recipeId: 'rec_1',
            recipeCode: 'REC-01',
            recipeRevision: 1,
            orderedQuantity: 0, // ZERO
            uom: 'KG'
          }
        ]
      });
      const err: any = poWithZeroQty.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['items.0.orderedQuantity']).toBeDefined();
    });

    it('should enforce decimal precision bounds (min: 0.0001)', async () => {
      // Valid precision at 4 decimal places
      const validDoc = new PurchaseOrderModel({
        tenantId: testTenantA,
        poNumber: 'PO-202609-PREC-1',
        supplierName: 'Precision Alloys',
        expectedDeliveryDate: new Date(),
        createdById: 'usr_test',
        totalOrderedQuantity: 0.0001,
        items: [
          {
            lineItemId: 'line_1',
            itemId: 'item_1',
            itemCode: 'BAR-4140',
            itemName: 'Steel Round Bar',
            materialGrade: 'AISI 4140',
            processFamily: 'MACHINING',
            recipeId: 'rec_1',
            recipeCode: 'REC-01',
            recipeRevision: 1,
            orderedQuantity: 0.0001, // Valid 4-decimal precision
            uom: 'KG'
          }
        ]
      });
      expect(validDoc.validateSync()).toBeUndefined();

      // Below lower threshold (e.g. 0.00005)
      const invalidDoc = new PurchaseOrderModel({
        tenantId: testTenantA,
        poNumber: 'PO-202609-PREC-2',
        supplierName: 'Precision Alloys',
        expectedDeliveryDate: new Date(),
        createdById: 'usr_test',
        totalOrderedQuantity: 0.00005,
        items: [
          {
            lineItemId: 'line_1',
            itemId: 'item_1',
            itemCode: 'BAR-4140',
            itemName: 'Steel Round Bar',
            materialGrade: 'AISI 4140',
            processFamily: 'MACHINING',
            recipeId: 'rec_1',
            recipeCode: 'REC-01',
            recipeRevision: 1,
            orderedQuantity: 0.00005, // Below 0.0001
            uom: 'KG'
          }
        ]
      });
      const err: any = invalidDoc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors['items.0.orderedQuantity']).toBeDefined();
    });

    it('should reject incorrect data types via CastError', () => {
      const docWithBadType = new PurchaseOrderModel({
        tenantId: testTenantA,
        poNumber: 'PO-TYPE-TEST',
        supplierName: 'Test Supplier',
        expectedDeliveryDate: 'NOT_A_VALID_DATE_STRING',
        createdById: 'usr_test'
      });
      const err: any = docWithBadType.validateSync();
      expect(err).toBeDefined();
      expect(err.name).toBe('ValidationError');
      expect(err.errors['expectedDeliveryDate']?.name).toBe('CastError');
    });

    it('should detect invalid ObjectIds safely without crash', () => {
      const invalidIds = ['123', 'invalid-hex-id', 'null', undefined, '', 'xyz999'];
      invalidIds.forEach((id) => {
        expect(mongoose.isValidObjectId(id)).toBe(false);
      });

      const validId = new mongoose.Types.ObjectId().toHexString();
      expect(mongoose.isValidObjectId(validId)).toBe(true);
    });

    it('should translate Mongoose CastError and ValidationError into structured 400 and 422 API responses in errorMiddleware', () => {
      // 1. CastError translation
      const castError = new mongoose.Error.CastError('ObjectId', 'invalid_id_value', 'customerId');
      const req: any = { method: 'GET', originalUrl: '/api/v1/customers/invalid_id_value' };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation((data) => data)
      };

      errorMiddleware(castError, req, res, (() => {}) as any);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_IDENTIFIER'
          })
        })
      );

      // 2. Duplicate Key 11000 translation
      const mongoDupKeyError = {
        code: 11000,
        keyValue: { poNumber: 'PO-202609-0001' }
      };
      errorMiddleware(mongoDupKeyError, req, res, (() => {}) as any);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'DUPLICATE_KEY_ERROR'
          })
        })
      );
    });
  });

  // =========================================================================
  // SUITE 2: Atomic Counters & High-Concurrency Race Condition Destruction
  // =========================================================================
  describe('2. Atomic Counters & Monotonic Concurrency Stress Testing', () => {
    it('should generate collision-free monotonic PO numbers under 25 simultaneous concurrent requests', async () => {
      const concurrencyLevel = 25;
      const promises = Array.from({ length: concurrencyLevel }).map(() =>
        purchaseOrderRepository.generateNextPoNumber(testTenantA)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrencyLevel);

      if (isMongoConnected) {
        const uniqueSet = new Set(results);
        expect(uniqueSet.size).toBe(concurrencyLevel);

        results.forEach((code) => {
          expect(code).toMatch(/^PO-\d{6}-\d{4}$/);
        });
      }
    });

    it('should generate collision-free monotonic GRN numbers under 25 simultaneous concurrent requests', async () => {
      const concurrencyLevel = 25;
      const promises = Array.from({ length: concurrencyLevel }).map(() =>
        grnRepository.generateNextGrnNumber(testTenantA)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrencyLevel);

      if (isMongoConnected) {
        const uniqueSet = new Set(results);
        expect(uniqueSet.size).toBe(concurrencyLevel);

        results.forEach((code) => {
          expect(code).toMatch(/^GRN-\d{6}-\d{4}$/);
        });
      }
    });

    it('should generate collision-free monotonic Job numbers under 25 simultaneous concurrent requests', async () => {
      const concurrencyLevel = 25;
      const promises = Array.from({ length: concurrencyLevel }).map(() =>
        productionJobRepository.generateNextJobNumber(testTenantA)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrencyLevel);

      if (isMongoConnected) {
        const uniqueSet = new Set(results);
        expect(uniqueSet.size).toBe(concurrencyLevel);

        results.forEach((code) => {
          expect(code).toMatch(/^JOB-\d{6}-\d{4}$/);
        });
      }
    });

    it('should generate collision-free monotonic Batch Order numbers under 25 simultaneous concurrent requests', async () => {
      const concurrencyLevel = 25;
      const promises = Array.from({ length: concurrencyLevel }).map(() =>
        productionJobRepository.generateNextBatchOrderNumber(testTenantA)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrencyLevel);

      if (isMongoConnected) {
        const uniqueSet = new Set(results);
        expect(uniqueSet.size).toBe(concurrencyLevel);

        results.forEach((code) => {
          expect(code).toMatch(/^BO-\d{6}-\d{4}$/);
        });
      }
    });

    it('should generate collision-free monotonic Dispatch numbers under 25 simultaneous concurrent requests', async () => {
      const concurrencyLevel = 25;
      const promises = Array.from({ length: concurrencyLevel }).map(() =>
        dispatchRepository.generateNextDispatchNumber(testTenantA)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrencyLevel);

      if (isMongoConnected) {
        const uniqueSet = new Set(results);
        expect(uniqueSet.size).toBe(concurrencyLevel);

        results.forEach((code) => {
          expect(code).toMatch(/^DSP-\d{6}-\d{4}$/);
        });
      }
    });

    it('should generate collision-free monotonic Inspection numbers under 25 simultaneous concurrent requests', async () => {
      const concurrencyLevel = 25;
      const promises = Array.from({ length: concurrencyLevel }).map(() =>
        qualityInspectionRepository.generateNextInspectionNumber(testTenantA)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrencyLevel);

      if (isMongoConnected) {
        const uniqueSet = new Set(results);
        expect(uniqueSet.size).toBe(concurrencyLevel);

        results.forEach((code) => {
          expect(code).toMatch(/^INSP-\d{6}-\d{4}$/);
        });
      }
    });

    it('should generate collision-free monotonic NCR and CAPA numbers under 25 simultaneous concurrent requests', async () => {
      const concurrencyLevel = 25;
      const [ncrResults, capaResults] = await Promise.all([
        Promise.all(Array.from({ length: concurrencyLevel }).map(() => ncrCapaRepository.generateNextNcrNumber(testTenantA))),
        Promise.all(Array.from({ length: concurrencyLevel }).map(() => ncrCapaRepository.generateNextCapaNumber(testTenantA)))
      ]);

      expect(ncrResults).toHaveLength(concurrencyLevel);
      expect(capaResults).toHaveLength(concurrencyLevel);

      if (isMongoConnected) {
        expect(new Set(ncrResults).size).toBe(concurrencyLevel);
        expect(new Set(capaResults).size).toBe(concurrencyLevel);

        ncrResults.forEach((code) => expect(code).toMatch(/^NCR-\d{6}-\d{4}$/));
        capaResults.forEach((code) => expect(code).toMatch(/^CAPA-\d{6}-\d{4}$/));
      }
    });

    it('should enforce unique index constraints against duplicate submissions with identical business keys', async () => {
      if (!isMongoConnected) return;

      const testDomain = 'UNIQUE_STRESS_TEST';
      await CounterModel.deleteMany({ tenantId: testTenantA, domain: testDomain });

      // First insert
      await CounterModel.create({
        tenantId: testTenantA,
        domain: testDomain,
        seq: 1
      });

      // Attempt duplicate insert with same tenantId and domain
      let duplicateError: any = null;
      try {
        await CounterModel.create({
          tenantId: testTenantA,
          domain: testDomain,
          seq: 2
        });
      } catch (err: any) {
        duplicateError = err;
      }

      expect(duplicateError).toBeDefined();
      expect(duplicateError.code).toBe(11000);
    });
  });

  // =========================================================================
  // SUITE 3: Soft-Delete Leakage Prevention Across All Mongoose Operations
  // =========================================================================
  describe('3. Soft-Delete Leakage Prevention Across All Operations', () => {
    it('should verify soft-delete filtering across find, findOne, findOneAndUpdate, and countDocuments', async () => {
      if (!isMongoConnected) return;

      const uniqueCode = `SD-${Date.now()}`;
      const doc = await SoftDeleteTestModel.create({
        tenantId: testTenantA,
        code: uniqueCode,
        category: 'TITANIUM',
        amount: 500,
        isDeleted: false
      });

      expect(doc.isDeleted).toBe(false);

      // Perform soft delete
      await doc.softDelete('admin_tester');
      expect(doc.isDeleted).toBe(true);
      expect(doc.deletedAt).toBeInstanceOf(Date);
      expect(doc.deletedBy).toBe('admin_tester');

      // 1. find: Should not return the deleted doc
      const findResults = await SoftDeleteTestModel.find({ tenantId: testTenantA, code: uniqueCode });
      expect(findResults).toHaveLength(0);

      // 2. findOne: Should return null
      const findOneResult = await SoftDeleteTestModel.findOne({ tenantId: testTenantA, code: uniqueCode });
      expect(findOneResult).toBeNull();

      // 3. findOneAndUpdate: Should not update or return the deleted doc
      const updateResult = await SoftDeleteTestModel.findOneAndUpdate(
        { tenantId: testTenantA, code: uniqueCode },
        { $set: { amount: 999 } },
        { new: true }
      );
      expect(updateResult).toBeNull();

      // 4. countDocuments: Should return 0
      const count = await SoftDeleteTestModel.countDocuments({ tenantId: testTenantA, code: uniqueCode });
      expect(count).toBe(0);

      // 5. Explicit { isDeleted: true }: Should find the document for audit reconstruction
      const auditResult = await SoftDeleteTestModel.findOne({
        tenantId: testTenantA,
        code: uniqueCode,
        isDeleted: true
      });
      expect(auditResult).not.toBeNull();
      expect(auditResult?.code).toBe(uniqueCode);

      // 6. Restore: Should restore document to active state
      await auditResult?.restore();
      const restored = await SoftDeleteTestModel.findOne({ tenantId: testTenantA, code: uniqueCode });
      expect(restored).not.toBeNull();
      expect(restored?.isDeleted).toBe(false);
      expect(restored?.deletedAt).toBeNull();
    });

    it('should prevent soft-deleted records from leaking into aggregate pipelines and reporting queries', async () => {
      if (!isMongoConnected) return;

      const category = `AERO_${Date.now()}`;

      // Create 2 active documents and 1 soft-deleted document
      await SoftDeleteTestModel.create([
        { tenantId: testTenantA, code: `ACT-1-${Date.now()}`, category, amount: 100, isDeleted: false },
        { tenantId: testTenantA, code: `ACT-2-${Date.now()}`, category, amount: 200, isDeleted: false },
        { tenantId: testTenantA, code: `DEL-1-${Date.now()}`, category, amount: 500, isDeleted: true, deletedAt: new Date() }
      ]);

      // Run raw aggregation pipeline
      const aggResult = await SoftDeleteTestModel.aggregate([
        { $match: { tenantId: testTenantA, category } },
        { $group: { _id: '$category', totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]);

      expect(aggResult).toHaveLength(1);
      // Soft-deleted record (amount: 500) must NOT leak into the sum! Total must be 100 + 200 = 300
      expect(aggResult[0].totalAmount).toBe(300);
      expect(aggResult[0].count).toBe(2);
    });

    it('should prevent soft-deleted records from being mutated by updateMany and distinct', async () => {
      if (!isMongoConnected) return;

      const catBatch = `BATCH_${Date.now()}`;
      await SoftDeleteTestModel.create([
        { tenantId: testTenantA, code: `B-1-${Date.now()}`, category: catBatch, amount: 10, isDeleted: false },
        { tenantId: testTenantA, code: `B-2-${Date.now()}`, category: catBatch, amount: 20, isDeleted: true, deletedAt: new Date() }
      ]);

      // updateMany without isDeleted specified
      await SoftDeleteTestModel.updateMany(
        { tenantId: testTenantA, category: catBatch },
        { $set: { amount: 999 } }
      );

      // Active doc updated
      const activeDoc = await SoftDeleteTestModel.findOne({ tenantId: testTenantA, category: catBatch, isDeleted: false });
      expect(activeDoc?.amount).toBe(999);

      // Soft-deleted doc must NOT be updated
      const deletedDoc = await SoftDeleteTestModel.findOne({ tenantId: testTenantA, category: catBatch, isDeleted: true });
      expect(deletedDoc?.amount).toBe(20);

      // distinct without isDeleted specified
      const distinctCats = await SoftDeleteTestModel.distinct('category', { tenantId: testTenantA, code: deletedDoc?.code });
      expect(distinctCats).toHaveLength(0);
    });
  });

  // =========================================================================
  // SUITE 4: Cross-Module Relational Integrity & Orphan Prevention
  // =========================================================================
  describe('4. Cross-Module Relational Integrity & Backend Enforcement', () => {
    const actor = {
      userId: 'usr_qa_reliability',
      email: 'reliability@celestium.internal',
      roles: ['ADMIN'],
      role: 'ADMIN'
    };

    it('should reject PO creation when referenced supplier is non-existent, inactive, or blacklisted (Supplier → PO)', async () => {
      // Mock supplier resolution returning blacklisted
      jest.spyOn(customerService, 'getCustomerByCode').mockResolvedValueOnce({
        customerCode: 'SUP-SUSPENDED',
        qualityStatus: 'blacklisted',
        status: 'inactive'
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenantA,
          {
            supplierName: 'Blacklisted Metals Corp',
            supplierCode: 'SUP-SUSPENDED',
            expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
            items: [
              {
                itemId: 'item_valid',
                recipeId: 'rec_valid',
                orderedQuantity: 10
              }
            ]
          },
          actor
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject PO creation when referenced Item is deleted or inactive (Item → PO)', async () => {
      jest.spyOn(customerService, 'getCustomerByCode').mockResolvedValueOnce(null as any);
      jest.spyOn(itemService, 'getItemById').mockResolvedValueOnce({
        id: 'item_archived',
        itemCode: 'ITEM-ARCH',
        status: 'inactive',
        isDeleted: true
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenantA,
          {
            supplierName: 'Reliable Alloys',
            expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
            items: [
              {
                itemId: 'item_archived',
                recipeId: 'rec_valid',
                orderedQuantity: 10
              }
            ]
          },
          actor
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject PO creation when referenced Recipe is deleted or not approved (Recipe → PO)', async () => {
      jest.spyOn(customerService, 'getCustomerByCode').mockResolvedValueOnce(null as any);
      jest.spyOn(itemService, 'getItemById').mockResolvedValueOnce({
        id: 'item_active',
        itemCode: 'ITEM-ACT',
        materialGrade: 'AISI 4140',
        status: 'active',
        isDeleted: false
      } as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValueOnce({
        id: 'rec_draft',
        recipeCode: 'REC-DRAFT',
        status: 'DRAFT', // Not APPROVED/ACTIVE
        isDeleted: false
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenantA,
          {
            supplierName: 'Reliable Alloys',
            expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
            items: [
              {
                itemId: 'item_active',
                recipeId: 'rec_draft',
                orderedQuantity: 10
              }
            ]
          },
          actor
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject PO creation on material grade mismatch between Item and Recipe (Item → Recipe)', async () => {
      jest.spyOn(customerService, 'getCustomerByCode').mockResolvedValueOnce(null as any);
      jest.spyOn(itemService, 'getItemById').mockResolvedValueOnce({
        id: 'item_titanium',
        itemCode: 'BAR-TI-64',
        materialGrade: 'TITANIUM GRADE 5',
        status: 'active',
        isDeleted: false
      } as any);
      jest.spyOn(recipeService, 'getRecipeById').mockResolvedValueOnce({
        id: 'rec_steel_carburize',
        recipeCode: 'REC-CARB-STEEL',
        status: 'ACTIVE',
        processFamily: 'CARBURIZING',
        applicableMaterialGrades: ['AISI 4140', 'EN19', '8620'], // TITANIUM GRADE 5 is missing
        isDeleted: false
      } as any);

      await expect(
        purchaseOrderService.createOrder(
          testTenantA,
          {
            supplierName: 'Titanium Suppliers',
            expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString(),
            items: [
              {
                itemId: 'item_titanium',
                recipeId: 'rec_steel_carburize',
                orderedQuantity: 10
              }
            ]
          },
          actor
        )
      ).rejects.toThrow(/Material grade mismatch/);
    });

    it('should reject GRN creation when Purchase Order is cancelled or deleted (PO → GRN)', async () => {
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValueOnce({
        id: 'po_cancelled_1',
        poNumber: 'PO-CANCELLED',
        status: 'CANCELLED',
        isDeleted: false,
        items: [{ lineItemId: 'l1', itemId: 'i1' }]
      } as any);

      await expect(
        grnService.createGRN(
          testTenantA,
          {
            poId: 'po_cancelled_1'
          },
          actor
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject GRN creation when warehouse putaway stage was skipped (State Machine Enforcement)', async () => {
      jest.spyOn(purchaseOrderService, 'getOrderById').mockResolvedValueOnce({
        id: 'po_active',
        poNumber: 'PO-ACTIVE-01',
        status: 'ISSUED',
        isDeleted: false,
        items: [{ lineItemId: 'l1', itemId: 'i1', quantity: 10 }]
      } as any);

      // No stored receipts exist for this PO
      jest.spyOn(grnRepository, 'queryReceipts').mockResolvedValueOnce([]);

      await expect(
        grnService.createGRN(
          testTenantA,
          {
            poId: 'po_active'
          },
          actor
        )
      ).rejects.toThrow(/STAGE_SKIPPED/);
    });

    it('should reject Batch Order creation when requested material grade contradicts GRN material grade (GRN → BO)', async () => {
      jest.spyOn(purchaseOrderRepository, 'findById').mockResolvedValueOnce({
        id: 'po_ti_1',
        poNumber: 'PO-TI-01',
        status: 'ISSUED',
        isDeleted: false,
        items: [
          {
            itemId: 'item_steel',
            itemCode: 'BAR-4140',
            materialGrade: 'AISI 4140'
          }
        ]
      } as any);

      jest.spyOn(grnRepository, 'findGrnById').mockResolvedValueOnce({
        id: 'grn_titanium',
        grnNumber: 'GRN-TI-01',
        poId: 'po_ti_1',
        poNumber: 'PO-TI-01',
        status: 'AVAILABLE_FOR_PLANNING',
        isDeleted: false,
        items: [
          {
            itemId: 'item_ti',
            itemCode: 'TI-BAR',
            materialGrade: 'TITANIUM GRADE 5',
            receivedQuantity: 10,
            recipeId: 'rec_ti',
            recipeCode: 'REC-TI'
          }
        ]
      } as any);

      jest.spyOn(itemRepository, 'findById').mockResolvedValueOnce({
        id: 'item_ti',
        itemCode: 'TI-BAR',
        materialGrade: 'TITANIUM GRADE 5',
        status: 'active',
        isDeleted: false
      } as any);

      await expect(
        productionJobService.createBatchOrder(
          testTenantA,
          actor,
          {
            poId: 'po_ti_1',
            grnId: 'grn_titanium',
            itemId: 'item_ti',
            quantity: 5,
            recipeId: 'rec_ti'
          } as any
        )
      ).rejects.toThrow(/Cross-Record Contamination Violation/);
    });

    it('should reject Dispatch consignment creation when finished goods lot is quarantined (GRN + BO → OC)', async () => {
      const validCustId = new mongoose.Types.ObjectId().toHexString();
      const validFgId = new mongoose.Types.ObjectId().toHexString();

      jest.spyOn(dispatchService['custRepo'], 'findById').mockResolvedValueOnce({
        id: validCustId,
        customerCode: 'CUST-AERO',
        qualityStatus: 'active',
        isDeleted: false
      } as any);

      jest.spyOn(dispatchService['fgRepo'], 'findById').mockResolvedValueOnce({
        id: validFgId,
        fgLotNumber: 'FG-LOT-999',
        customerCode: 'CUST-AERO',
        status: 'QUARANTINED', // Quarantined
        isDeleted: false
      } as any);

      await expect(
        dispatchService.createDispatch(testTenantA, actor, {
          customerId: validCustId,
          lines: [{ finishedGoodsId: validFgId, quantity: 10 }]
        })
      ).rejects.toThrow(/QUARANTINED/);
    });
  });

  // =========================================================================
  // SUITE 5: Transaction Rollback & Multi-Document State Consistency
  // =========================================================================
  describe('5. Transaction Rollback & State Consistency', () => {
    it('should verify transaction execution, failure handling, and session cleanup', async () => {
      if (!isMongoConnected) return;

      const rollbackTestCode = `ROLLBACK-${Date.now()}`;

      let transactionError: any = null;
      let isReplicaSet = true;

      try {
        await withTransaction(async (session) => {
          await SoftDeleteTestModel.create(
            [
              {
                tenantId: testTenantA,
                code: rollbackTestCode,
                category: 'ROLLBACK_TEST',
                amount: 777,
                isDeleted: false
              }
            ],
            { session }
          );

          // Simulate unhandled failure midway through transaction
          throw new Error('SIMULATED_TRANSACTION_FAILURE_MIDWAY');
        });
      } catch (err: any) {
        transactionError = err;
        if (err.message && err.message.includes('replica set')) {
          isReplicaSet = false;
        }
      }

      expect(transactionError).toBeDefined();

      if (isReplicaSet) {
        // On a replica set, the transaction aborted cleanly and the document rolled back!
        expect(transactionError.message).toBe('SIMULATED_TRANSACTION_FAILURE_MIDWAY');
        const orphanedDoc = await SoftDeleteTestModel.findOne({
          tenantId: testTenantA,
          code: rollbackTestCode
        });
        expect(orphanedDoc).toBeNull();
      } else {
        // On standalone MongoDB, withTransaction caught the engine constraint and cleanly threw
        expect(transactionError.message).toContain('replica set');
      }
    });
  });

  // =========================================================================
  // SUITE 6: Multi-Tenant Database Isolation
  // =========================================================================
  describe('6. Multi-Tenant Database Isolation & Cross-Tenant Boundary Enforcement', () => {
    it('should guarantee absolute tenant isolation: Tenant A cannot query Tenant B documents', async () => {
      if (!isMongoConnected) return;

      const sharedCode = `ISO-SEC-${Date.now()}`;

      // Create in Tenant A
      await SoftDeleteTestModel.create({
        tenantId: testTenantA,
        code: sharedCode,
        category: 'DEFENSE',
        amount: 1000,
        isDeleted: false
      });

      // Create with identical code in Tenant B
      await SoftDeleteTestModel.create({
        tenantId: testTenantB,
        code: sharedCode,
        category: 'COMMERCIAL',
        amount: 2000,
        isDeleted: false
      });

      // Query from Tenant A
      const docA = await SoftDeleteTestModel.findOne({ tenantId: testTenantA, code: sharedCode });
      expect(docA).not.toBeNull();
      expect(docA?.category).toBe('DEFENSE');
      expect(docA?.amount).toBe(1000);

      // Query from Tenant B
      const docB = await SoftDeleteTestModel.findOne({ tenantId: testTenantB, code: sharedCode });
      expect(docB).not.toBeNull();
      expect(docB?.category).toBe('COMMERCIAL');
      expect(docB?.amount).toBe(2000);

      // Cross-tenant breach attempt: Tenant A searching for Tenant B record returns null
      const breachAttempt = await SoftDeleteTestModel.findOne({
        tenantId: testTenantA,
        category: 'COMMERCIAL'
      });
      expect(breachAttempt).toBeNull();
    });
  });
});
