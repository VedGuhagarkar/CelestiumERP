import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { inventoryRepository } from '../src/modules/inventory/inventory.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Inventory Stock Ledger & Balance Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockItem = {
    id: 'item_qoil_001',
    tenantId: testTenant,
    itemCode: 'QMED-OIL-FAST-200',
    name: 'Fast Quench Oil 200',
    uom: 'LTR',
    materialGrade: 'Quench Medium'
  };

  const mockBalance = {
    id: 'bal_001',
    tenantId: testTenant,
    itemId: 'item_qoil_001',
    itemCode: 'QMED-OIL-FAST-200',
    location: 'Quench Tank 1 Reservoir',
    onHandQuantity: 2000,
    reservedQuantity: 500,
    availableQuantity: 1500,
    uom: 'LTR',
    version: 1
  };

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
  });

  describe('POST /api/v1/inventory/goods-receipt', () => {
    it('should record goods receipt, increment on-hand balance, and log immutable ledger transaction', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(inventoryRepository, 'findOrCreateBalance').mockResolvedValue(mockBalance as any);
      jest.spyOn(inventoryRepository, 'updateBalance').mockResolvedValue({
        ...mockBalance,
        onHandQuantity: 3000,
        availableQuantity: 2500
      } as any);
      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);

      const mockTxn = {
        id: 'txn_001',
        transactionNumber: 'TXN-INV-2026-00001',
        type: 'GOODS_RECEIPT',
        quantity: 1000,
        beforeBalance: 2000,
        afterBalance: 3000,
        destinationLocation: 'Quench Tank 1 Reservoir',
        toJSON: () => ({ transactionNumber: 'TXN-INV-2026-00001', type: 'GOODS_RECEIPT' })
      };

      jest.spyOn(inventoryRepository, 'recordTransaction').mockResolvedValue(mockTxn as any);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/inventory/goods-receipt')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          location: 'Quench Tank 1 Reservoir',
          quantity: 1000,
          referenceType: 'PURCHASE_ORDER',
          referenceNumber: 'PO-2026-088',
          comments: 'Bulk quench oil delivery'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transactionNumber).toBe('TXN-INV-2026-00001');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'INVENTORY_GOODS_RECEIPT'
        })
      );
    });
  });

  describe('POST /api/v1/inventory/goods-issue', () => {
    it('should record goods issue and deduct on-hand balance', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(inventoryRepository, 'getBalance').mockResolvedValue(mockBalance as any);
      jest.spyOn(inventoryRepository, 'updateBalance').mockResolvedValue({
        ...mockBalance,
        onHandQuantity: 1500,
        availableQuantity: 1000
      } as any);
      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);

      const mockTxn = {
        id: 'txn_002',
        transactionNumber: 'TXN-INV-2026-00002',
        type: 'GOODS_ISSUE',
        quantity: 500,
        beforeBalance: 2000,
        afterBalance: 1500,
        toJSON: () => ({ transactionNumber: 'TXN-INV-2026-00002', type: 'GOODS_ISSUE' })
      };

      jest.spyOn(inventoryRepository, 'recordTransaction').mockResolvedValue(mockTxn as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/inventory/goods-issue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          location: 'Quench Tank 1 Reservoir',
          quantity: 500,
          referenceType: 'JOB_CARD',
          referenceNumber: 'JC-2026-0801'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('GOODS_ISSUE');
    });

    it('should reject goods issue if on-hand balance is insufficient (negative inventory guard)', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(inventoryRepository, 'getBalance').mockResolvedValue({
        ...mockBalance,
        onHandQuantity: 200 // Only 200 LTR on hand
      } as any);

      const res = await request(app)
        .post('/api/v1/inventory/goods-issue')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          location: 'Quench Tank 1 Reservoir',
          quantity: 500, // > 200 LTR
          referenceType: 'JOB_CARD',
          referenceNumber: 'JC-2026-0801'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient stock on hand');
    });
  });

  describe('POST /api/v1/inventory/adjustments', () => {
    it('should record manual stock adjustment with mandatory reason code and justification', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(inventoryRepository, 'findOrCreateBalance').mockResolvedValue(mockBalance as any);
      jest.spyOn(inventoryRepository, 'updateBalance').mockResolvedValue({} as any);
      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);

      const mockTxn = {
        id: 'txn_003',
        transactionNumber: 'TXN-INV-2026-00003',
        type: 'STOCK_ADJUSTMENT_DEDUCT',
        quantity: 50,
        reasonCode: 'DAMAGED_IN_STORAGE',
        toJSON: () => ({ transactionNumber: 'TXN-INV-2026-00003', type: 'STOCK_ADJUSTMENT_DEDUCT' })
      };

      jest.spyOn(inventoryRepository, 'recordTransaction').mockResolvedValue(mockTxn as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          location: 'Quench Tank 1 Reservoir',
          adjustedQuantity: -50,
          reasonCode: 'DAMAGED_IN_STORAGE',
          comments: 'Drain valve leakage discovered during monthly inspection'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('STOCK_ADJUSTMENT_DEDUCT');
    });

    it('should reject adjustment if comments or reason code are omitted', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      const res = await request(app)
        .post('/api/v1/inventory/adjustments')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          location: 'Quench Tank 1 Reservoir',
          adjustedQuantity: -50
          // Missing reasonCode and comments
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Request validation failed');
    });
  });

  describe('POST /api/v1/inventory/transfers', () => {
    it('should transfer stock between locations and record dual ledger transactions', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(inventoryRepository, 'getBalance').mockResolvedValue(mockBalance as any);
      jest.spyOn(inventoryRepository, 'findOrCreateBalance').mockResolvedValue({
        ...mockBalance,
        location: 'Quench Tank 2 Backup'
      } as any);
      jest.spyOn(inventoryRepository, 'updateBalance').mockResolvedValue({} as any);

      const mockTxn = {
        id: 'txn_004',
        transactionNumber: 'TXN-INV-2026-00004',
        type: 'INTERNAL_TRANSFER_OUT',
        quantity: 400,
        sourceLocation: 'Quench Tank 1 Reservoir',
        destinationLocation: 'Quench Tank 2 Backup',
        toJSON: () => ({ transactionNumber: 'TXN-INV-2026-00004', type: 'INTERNAL_TRANSFER_OUT' })
      };

      jest.spyOn(inventoryRepository, 'recordTransaction').mockResolvedValue(mockTxn as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/inventory/transfers')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          sourceLocation: 'Quench Tank 1 Reservoir',
          destinationLocation: 'Quench Tank 2 Backup',
          quantity: 400,
          comments: 'Balancing quench reservoir volumes'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('INTERNAL_TRANSFER_OUT');
    });

    it('should reject transfer if source location and destination location are identical', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      const res = await request(app)
        .post('/api/v1/inventory/transfers')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          sourceLocation: 'Quench Tank 1 Reservoir',
          destinationLocation: 'Quench Tank 1 Reservoir', // SAME!
          quantity: 400
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Request validation failed');
    });
  });

  describe('Stock Reservations & Releases', () => {
    it('should reserve stock for production job', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(inventoryRepository, 'getBalance').mockResolvedValue(mockBalance as any);
      jest.spyOn(inventoryRepository, 'updateBalance').mockResolvedValue({} as any);
      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);

      const mockTxn = {
        id: 'txn_005',
        transactionNumber: 'TXN-INV-2026-00005',
        type: 'RESERVATION_ALLOCATE',
        quantity: 300,
        toJSON: () => ({ transactionNumber: 'TXN-INV-2026-00005', type: 'RESERVATION_ALLOCATE' })
      };

      jest.spyOn(inventoryRepository, 'recordTransaction').mockResolvedValue(mockTxn as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/inventory/reservations')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          location: 'Quench Tank 1 Reservoir',
          quantity: 300,
          referenceType: 'JOB_CARD',
          referenceNumber: 'JC-2026-0805'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('RESERVATION_ALLOCATE');
    });

    it('should release previously reserved stock', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(inventoryRepository, 'getBalance').mockResolvedValue(mockBalance as any);
      jest.spyOn(inventoryRepository, 'updateBalance').mockResolvedValue({} as any);
      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);

      const mockTxn = {
        id: 'txn_006',
        transactionNumber: 'TXN-INV-2026-00006',
        type: 'RESERVATION_RELEASE',
        quantity: 200,
        toJSON: () => ({ transactionNumber: 'TXN-INV-2026-00006', type: 'RESERVATION_RELEASE' })
      };

      jest.spyOn(inventoryRepository, 'recordTransaction').mockResolvedValue(mockTxn as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/inventory/reservations/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_qoil_001',
          location: 'Quench Tank 1 Reservoir',
          quantity: 200,
          referenceType: 'JOB_CARD',
          referenceNumber: 'JC-2026-0805'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('RESERVATION_RELEASE');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block user lacking INVENTORY_STOCK_ADJUST permission', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/inventory/goods-receipt')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          itemId: 'item_qoil_001',
          location: 'Quench Tank 1 Reservoir',
          quantity: 100,
          referenceType: 'PURCHASE_ORDER'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
