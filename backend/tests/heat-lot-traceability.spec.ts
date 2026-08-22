import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { heatLotRepository } from '../src/modules/traceability/heat-lot.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Heat-Lot Traceability & Genealogy Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockItem = {
    id: 'item_4140_001',
    tenantId: testTenant,
    itemCode: 'MAT-4140-RND-50',
    name: 'AISI 4140 Round Bar Ø50mm',
    materialGrade: 'AISI 4140'
  };

  const mockInwardPayload: any = {
    itemId: 'item_4140_001',
    materialGrade: 'AISI 4140',
    supplierHeatNumber: 'NIPPON-884920',
    supplierLotNumber: 'LOT-A-992',
    supplierName: 'Nippon Steel Corp',
    mtrNumber: 'MTR-NS-4140-2026-01',
    chemicalComposition: {
      C: 0.41,
      Mn: 0.85,
      Cr: 1.05,
      Mo: 0.22,
      Si: 0.25,
      S: 0.015,
      P: 0.012
    },
    receivedQuantity: 5000,
    uom: 'KG',
    storageLocation: 'Raw Material Yard Bay 3-A',
    testCertReferences: ['MTR-NS-4140-2026-01.pdf', 'SPECTRO-LAB-092.pdf']
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

  describe('POST /api/v1/heat-lots/inward (Inwarding & MTR Capture)', () => {
    it('should inward raw material heat lot and generate heat-lot number with audit record', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);
      jest.spyOn(heatLotRepository, 'generateNextHeatLotNumber').mockResolvedValue('HL-202608-0001');
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue(null);
      jest.spyOn(heatLotRepository, 'create').mockResolvedValue({
        ...mockInwardPayload,
        id: 'hl_mock_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        itemCode: 'MAT-4140-RND-50',
        currentQuantity: 5000,
        allocatedQuantity: 0,
        consumedQuantity: 0,
        status: 'INWARDED',
        allocations: [],
        consumptionHistory: [],
        toJSON: () => ({
          ...mockInwardPayload,
          id: 'hl_mock_001',
          tenantId: testTenant,
          heatLotNumber: 'HL-202608-0001',
          itemCode: 'MAT-4140-RND-50'
        })
      } as any);

      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);
      jest.spyOn(itemRepository, 'incrementBatchCounters').mockResolvedValue({} as any);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/heat-lots/inward')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send(mockInwardPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.heatLotNumber).toBe('HL-202608-0001');
      expect(res.body.data.supplierHeatNumber).toBe('NIPPON-884920');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'HEAT_LOT_INWARDED',
          entityType: 'HeatLot'
        })
      );
    });

    it('should reject inwarding if referenced Item master does not exist', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/heat-lots/inward')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send(mockInwardPayload);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Item master with ID');
    });
  });

  describe('Quarantine & Metallurgical Release Workflow', () => {
    it('should place heat lot in quarantine status', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockHeatLot: any = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        status: 'INWARDED',
        save: jest.fn().mockResolvedValue({
          id: 'hl_001',
          heatLotNumber: 'HL-202608-0001',
          status: 'QUARANTINED',
          quarantineReason: 'Spectro analysis pending for Mo % verification'
        })
      };

      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .patch('/api/v1/heat-lots/hl_001/quarantine')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ quarantineReason: 'Spectro analysis pending for Mo % verification' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('QUARANTINED');
    });

    it('should release quarantined heat lot after verification', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockHeatLot: any = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        status: 'QUARANTINED',
        save: jest.fn().mockResolvedValue({
          id: 'hl_001',
          heatLotNumber: 'HL-202608-0001',
          status: 'RELEASED'
        })
      };

      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .patch('/api/v1/heat-lots/hl_001/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ releaseNotes: 'Chemical composition within ASTM A29 limits' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RELEASED');
    });
  });

  describe('Allocation & Job Reservation', () => {
    it('should allocate material to production Job Card', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      const mockHeatLot: any = {
        id: 'hl_001',
        tenantId: testTenant,
        itemId: 'item_4140_001',
        heatLotNumber: 'HL-202608-0001',
        currentQuantity: 5000,
        allocatedQuantity: 0,
        uom: 'KG',
        status: 'RELEASED',
        allocations: [],
        save: jest.fn().mockResolvedValue({
          id: 'hl_001',
          heatLotNumber: 'HL-202608-0001',
          allocatedQuantity: 1200
        })
      };

      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot);
      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/heat-lots/hl_001/allocate')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          jobCardId: 'jc_001',
          jobCardNumber: 'JC-2026-0801',
          customerCode: 'CUST-AERO-001',
          quantity: 1200
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allocatedQuantity).toBe(1200);
    });

    it('should reject allocation if requested quantity exceeds unallocated current quantity', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      const mockHeatLot: any = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        currentQuantity: 1000,
        allocatedQuantity: 800, // Available: 200 KG
        uom: 'KG',
        status: 'RELEASED',
        allocations: []
      };

      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot);

      const res = await request(app)
        .post('/api/v1/heat-lots/hl_001/allocate')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          jobCardId: 'jc_002',
          jobCardNumber: 'JC-2026-0802',
          quantity: 500 // > 200 KG available
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient available quantity');
    });
  });

  describe('Material Consumption & Historical Lineage Preservation', () => {
    it('should log consumption against furnace batch, relieve allocation, and exhaust when 0 qty remains', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      const mockHeatLot: any = {
        id: 'hl_001',
        tenantId: testTenant,
        itemId: 'item_4140_001',
        heatLotNumber: 'HL-202608-0001',
        currentQuantity: 500,
        allocatedQuantity: 500,
        consumedQuantity: 4500,
        uom: 'KG',
        status: 'CONSUMED',
        allocations: [
          {
            allocationId: 'alloc_001',
            jobCardNumber: 'JC-2026-0801',
            quantity: 500,
            status: 'RESERVED'
          }
        ],
        consumptionHistory: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        })
      };

      jest.spyOn(heatLotRepository, 'findById').mockResolvedValue(mockHeatLot);
      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/heat-lots/hl_001/consume')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          jobCardId: 'jc_001',
          jobCardNumber: 'JC-2026-0801',
          furnaceId: 'FURNACE-SQF-01',
          batchNumber: 'BATCH-202608-01',
          quantity: 500,
          operatorId: 'usr_op_01'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentQuantity).toBe(0);
      expect(res.body.data.status).toBe('EXHAUSTED');
    });
  });

  describe('Bidirectional Traceability Engines', () => {
    it('should generate Forward Traceability from Heat Lot to downstream jobs and customers', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockHeatLot: any = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        supplierHeatNumber: 'NIPPON-884920',
        materialGrade: 'AISI 4140',
        consumptionHistory: [
          {
            jobCardId: 'jc_001',
            jobCardNumber: 'JC-2026-0801',
            customerCode: 'CUST-AERO-001',
            furnaceId: 'FURNACE-SQF-01',
            batchNumber: 'BATCH-202608-01',
            quantityConsumed: 1200,
            consumedAt: new Date()
          }
        ],
        allocations: [],
        toJSON: () => ({ heatLotNumber: 'HL-202608-0001', supplierHeatNumber: 'NIPPON-884920' })
      };

      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue(mockHeatLot);
      jest.spyOn(heatLotRepository, 'findChildLots').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/heat-lots/forward-trace/HL-202608-0001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.downstreamJobs.length).toBe(1);
      expect(res.body.data.downstreamJobs[0].jobCardNumber).toBe('JC-2026-0801');
    });

    it('should generate Backward Traceability from Job Card to supplier heat number and MTR chemistry', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockHeatLot: any = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        supplierHeatNumber: 'NIPPON-884920',
        supplierName: 'Nippon Steel',
        mtrNumber: 'MTR-NS-4140-2026-01',
        materialGrade: 'AISI 4140',
        chemicalComposition: { C: 0.41, Cr: 1.05, Mo: 0.22 },
        receivedDate: new Date('2026-08-01'),
        consumptionHistory: [
          {
            jobCardNumber: 'JC-2026-0801',
            quantityConsumed: 1200,
            consumedAt: new Date('2026-08-05')
          }
        ]
      };

      jest.spyOn(heatLotRepository, 'findByJobCardNumber').mockResolvedValue([mockHeatLot]);

      const res = await request(app)
        .get('/api/v1/heat-lots/backward-trace?jobCardNumber=JC-2026-0801')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.matchedHeatLots.length).toBe(1);
      expect(res.body.data.matchedHeatLots[0].supplierHeatNumber).toBe('NIPPON-884920');
      expect(res.body.data.matchedHeatLots[0].mtrNumber).toBe('MTR-NS-4140-2026-01');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user from inwarding heat lots', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/heat-lots/inward')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send(mockInwardPayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
