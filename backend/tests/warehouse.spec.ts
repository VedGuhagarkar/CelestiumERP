import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { warehouseRepository } from '../src/modules/warehouse/warehouse.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Warehouse & Physical Storage Location Master Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[]) => {
    return jwt.sign(
      { userId, tenantId: testTenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockWarehouse = {
    id: 'wh_main_001',
    tenantId: testTenant,
    code: 'WH-MAIN-PLANT',
    name: 'Main Heat-Treatment Plant',
    type: 'MAIN_PLANT',
    plantArea: 'Shop Floor 1 & 2',
    status: 'ACTIVE',
    toJSON: () => ({
      id: 'wh_main_001',
      tenantId: testTenant,
      code: 'WH-MAIN-PLANT',
      name: 'Main Heat-Treatment Plant'
    })
  };

  const mockLocation = {
    id: 'loc_quar_001',
    tenantId: testTenant,
    warehouseId: 'wh_main_001',
    warehouseCode: 'WH-MAIN-PLANT',
    locationCode: 'QUARANTINE-HOLD-01',
    zone: 'Zone Q - Metallurgical Inspection',
    bay: 'Bay 1',
    rack: 'Rack Q',
    bin: 'Bin 01',
    zoneType: 'QUARANTINE_AREA',
    capacityQuantity: 10000,
    capacityUom: 'KG',
    currentOccupancy: 0,
    status: 'ACTIVE',
    isQuarantineLocation: true,
    temperatureControlled: false,
    toJSON: () => ({
      id: 'loc_quar_001',
      tenantId: testTenant,
      locationCode: 'QUARANTINE-HOLD-01',
      status: 'ACTIVE'
    })
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

  describe('Warehouse Management (POST /api/v1/warehouses)', () => {
    it('should create warehouse and record audit log', async () => {
      const mgrToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(warehouseRepository, 'findWarehouseByCode').mockResolvedValue(null);
      jest.spyOn(warehouseRepository, 'createWarehouse').mockResolvedValue(mockWarehouse as any);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/warehouses')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${mgrToken}`)
        .send({
          code: 'WH-MAIN-PLANT',
          name: 'Main Heat-Treatment Plant',
          type: 'MAIN_PLANT',
          plantArea: 'Shop Floor 1 & 2'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('WH-MAIN-PLANT');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'WAREHOUSE_CREATED',
          entityType: 'Warehouse'
        })
      );
    });

    it('should reject warehouse creation if code already exists (conflict guard)', async () => {
      const mgrToken = generateToken('usr_mgr', ['PLANT_MANAGER']);

      jest.spyOn(warehouseRepository, 'findWarehouseByCode').mockResolvedValue(mockWarehouse as any);

      const res = await request(app)
        .post('/api/v1/warehouses')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${mgrToken}`)
        .send({
          code: 'WH-MAIN-PLANT',
          name: 'Duplicate Plant',
          type: 'MAIN_PLANT'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('Storage Location Management (POST /api/v1/warehouses/locations)', () => {
    it('should create storage location under parent warehouse', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(warehouseRepository, 'findWarehouseById').mockResolvedValue(mockWarehouse as any);
      jest.spyOn(warehouseRepository, 'findLocationByCode').mockResolvedValue(null);
      jest.spyOn(warehouseRepository, 'createLocation').mockResolvedValue(mockLocation as any);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/warehouses/locations')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          warehouseId: 'wh_main_001',
          locationCode: 'QUARANTINE-HOLD-01',
          zone: 'Zone Q - Metallurgical Inspection',
          zoneType: 'QUARANTINE_AREA',
          bay: 'Bay 1',
          rack: 'Rack Q',
          bin: 'Bin 01',
          capacityQuantity: 10000,
          capacityUom: 'KG',
          isQuarantineLocation: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.locationCode).toBe('QUARANTINE-HOLD-01');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'STORAGE_LOCATION_CREATED',
          entityType: 'StorageLocation'
        })
      );
    });

    it('should reject location creation if referenced warehouse does not exist', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(warehouseRepository, 'findWarehouseById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/warehouses/locations')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          warehouseId: 'wh_nonexistent',
          locationCode: 'YARD-BAY-99',
          zone: 'Zone A',
          zoneType: 'RAW_MATERIAL_YARD'
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Warehouse with ID');
    });

    it('should reject location creation if locationCode is already in use', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(warehouseRepository, 'findWarehouseById').mockResolvedValue(mockWarehouse as any);
      jest.spyOn(warehouseRepository, 'findLocationByCode').mockResolvedValue(mockLocation as any);

      const res = await request(app)
        .post('/api/v1/warehouses/locations')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          warehouseId: 'wh_main_001',
          locationCode: 'QUARANTINE-HOLD-01',
          zone: 'Zone Q',
          zoneType: 'QUARANTINE_AREA'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('Storage Location Lookup & Details', () => {
    it('should retrieve storage location by code', async () => {
      const clerkToken = generateToken('usr_clerk', ['INVENTORY_CLERK']);

      jest.spyOn(warehouseRepository, 'findLocationByCode').mockResolvedValue(mockLocation as any);

      const res = await request(app)
        .get('/api/v1/warehouses/locations/code/QUARANTINE-HOLD-01')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.locationCode).toBe('QUARANTINE-HOLD-01');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking WAREHOUSE_MANAGE permission from creating locations', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/warehouses/locations')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          warehouseId: 'wh_main_001',
          locationCode: 'FURNACE-STAGE-01',
          zone: 'Zone F',
          zoneType: 'WIP_STAGE'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
