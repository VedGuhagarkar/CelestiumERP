import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS, DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Item & Material Master Data Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockRawMaterial = {
    itemCode: 'MAT-4140-RND-50',
    name: 'AISI 4140 Alloy Steel Round Bar Ø50mm',
    description: 'Hot rolled, normalized chromium-molybdenum alloy steel bar',
    category: 'RAW_MATERIAL',
    materialGrade: 'AISI 4140',
    uom: 'KG',
    minStockLevel: 500,
    reorderPoint: 1000,
    maxStockLevel: 5000,
    safetyStock: 300,
    currentStock: 2500,
    storageLocation: 'Raw Material Yard Bay 3-A',
    isHazardous: false,
    isShelfLifeTracked: false
  };

  const mockProcessGas = {
    itemCode: 'GAS-N2-HP',
    name: 'High Purity Nitrogen Gas (99.999%)',
    description: 'Purge and protective atmosphere gas for sealed quench furnaces',
    category: 'PROCESS_GAS',
    uom: 'CYLINDER',
    secondaryUom: 'CU_M',
    conversionFactor: 7,
    minStockLevel: 10,
    reorderPoint: 25,
    maxStockLevel: 100,
    currentStock: 45,
    storageLocation: 'Gas Manifold Bank North',
    isHazardous: true,
    unNumber: 'UN 1066',
    msdsReference: 'MSDS-N2-001'
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/v1/items (Item Registration)', () => {
    it('should register a raw material item and log an audit record', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'findByCode').mockResolvedValue(null);
      jest.spyOn(itemRepository, 'create').mockResolvedValue({
        ...mockRawMaterial,
        id: 'item_mock_001',
        tenantId: testTenant,
        allocatedStock: 0,
        activeBatchCount: 0,
        totalBatchCount: 0,
        status: 'active',
        toJSON: () => ({ ...mockRawMaterial, id: 'item_mock_001', tenantId: testTenant })
      } as any);

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/items')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mockRawMaterial);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.itemCode).toBe('MAT-4140-RND-50');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'ITEM_CREATED',
          entityType: 'Item'
        })
      );
    });

    it('should register a hazardous process gas item', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'findByCode').mockResolvedValue(null);
      jest.spyOn(itemRepository, 'create').mockResolvedValue({
        ...mockProcessGas,
        id: 'item_mock_002',
        tenantId: testTenant,
        allocatedStock: 0,
        activeBatchCount: 0,
        totalBatchCount: 0,
        status: 'active',
        toJSON: () => ({ ...mockProcessGas, id: 'item_mock_002', tenantId: testTenant })
      } as any);

      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/items')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mockProcessGas);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isHazardous).toBe(true);
      expect(res.body.data.category).toBe('PROCESS_GAS');
    });

    it('should reject registration with duplicate itemCode under the same tenant', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'findByCode').mockResolvedValue({
        id: 'item_existing_001',
        itemCode: 'MAT-4140-RND-50'
      } as any);

      const res = await request(app)
        .post('/api/v1/items')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mockRawMaterial);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject registration with missing mandatory fields', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      const invalidItem = { itemCode: 'BAD', name: '' };

      const res = await request(app)
        .post('/api/v1/items')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidItem);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Request validation failed');
    });
  });

  describe('GET /api/v1/items (Search & Retrieval)', () => {
    it('should retrieve item by ID', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue({
        id: 'item_001',
        tenantId: testTenant,
        ...mockRawMaterial
      } as any);

      const res = await request(app)
        .get('/api/v1/items/item_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.itemCode).toBe('MAT-4140-RND-50');
    });

    it('should retrieve item by unique Item Code', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'findByCode').mockResolvedValue({
        id: 'item_001',
        tenantId: testTenant,
        ...mockRawMaterial
      } as any);

      const res = await request(app)
        .get('/api/v1/items/code/MAT-4140-RND-50')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.materialGrade).toBe('AISI 4140');
    });

    it('should perform paginated search with category and reorder point filters', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'searchItems').mockResolvedValue({
        items: [{ id: 'item_001', tenantId: testTenant, ...mockRawMaterial } as any],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/items?category=RAW_MATERIAL&search=4140')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('PUT /api/v1/items/:id (Updates & Traceability Guards)', () => {
    it('should update mutable item fields and log audit diff', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      const mockExistingItem: any = {
        id: 'item_001',
        tenantId: testTenant,
        itemCode: 'MAT-4140-RND-50',
        reorderPoint: 1000,
        toJSON: () => ({ itemCode: 'MAT-4140-RND-50', reorderPoint: 1000 })
      };

      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockExistingItem);
      jest.spyOn(itemRepository, 'updateById').mockResolvedValue({
        ...mockExistingItem,
        reorderPoint: 1200,
        toJSON: () => ({ itemCode: 'MAT-4140-RND-50', reorderPoint: 1200 })
      });

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .put('/api/v1/items/item_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reorderPoint: 1200 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'ITEM_UPDATED'
        })
      );
    });

    it('should reject attempts to mutate itemCode after creation', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue({
        id: 'item_001',
        tenantId: testTenant,
        itemCode: 'MAT-4140-RND-50',
        toJSON: () => ({ itemCode: 'MAT-4140-RND-50' })
      } as any);

      const res = await request(app)
        .put('/api/v1/items/item_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemCode: 'MUTATED-CODE-999' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Item Code is immutable');
    });
  });

  describe('Controlled Deactivation & Archiving', () => {
    it('should reject deactivation if material item has active batches', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue({
        id: 'item_001',
        tenantId: testTenant,
        itemCode: 'MAT-4140-RND-50',
        activeBatchCount: 2, // ACTIVE BATCHES IN PROCESS!
        toJSON: () => ({ itemCode: 'MAT-4140-RND-50', activeBatchCount: 2 })
      } as any);

      const res = await request(app)
        .patch('/api/v1/items/item_001/status')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'inactive' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('active batches currently reference this material');
    });

    it('should archive item when no active batches remain and preserve historical references', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);

      jest.spyOn(itemRepository, 'findById').mockResolvedValue({
        id: 'item_001',
        tenantId: testTenant,
        itemCode: 'MAT-4140-RND-50',
        activeBatchCount: 0,
        status: 'active',
        toJSON: () => ({ itemCode: 'MAT-4140-RND-50', activeBatchCount: 0, status: 'active' })
      } as any);

      const updateSpy = jest.spyOn(itemRepository, 'updateById').mockResolvedValue({} as any);
      jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .delete('/api/v1/items/item_001')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(testTenant, 'item_001', {
        $set: { status: 'archived', isDeleted: true }
      });
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block user lacking INVENTORY_ITEM_VIEW permission', async () => {
      const unauthRoles = ['GUEST_ROLE'];
      const unauthToken = generateToken('usr_guest', unauthRoles);

      jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
      jest.spyOn(roleRepository, 'findRolesByCodes').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/items')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${unauthToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
