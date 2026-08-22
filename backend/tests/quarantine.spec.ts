import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { quarantineRepository } from '../src/modules/quarantine/quarantine.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { heatLotRepository } from '../src/modules/traceability/heat-lot.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Quality-Controlled Inventory Quarantine Subsystem', () => {
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
    name: 'AISI 4140 Round Bar',
    uom: 'KG'
  };

  const mockQuarantinePayload: any = {
    targetType: 'HEAT_LOT',
    targetId: 'hl_001',
    targetIdentifier: 'HL-202608-0001',
    itemId: 'item_4140_001',
    location: 'QUARANTINE-HOLD-01',
    originalLocation: 'Raw Material Yard Bay 3',
    quantity: 2500,
    reasonCode: 'SPECTROMETRY_CHEMISTRY_FAIL',
    reasonDescription: 'Chromium content (0.65%) is below ASTM A29 minimum (0.80%)',
    triggerSource: 'RECEIVING_INSPECTION',
    triggerReferenceNumber: 'LAB-SPECTRO-2026-099'
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

  describe('POST /api/v1/quarantine (Place in Quarantine)', () => {
    it('should place Heat Lot under quarantine, sync status, and record audit log', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue(null);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);

      const mockHeatLot: any = {
        id: 'hl_001',
        heatLotNumber: 'HL-202608-0001',
        status: 'INWARDED',
        save: jest.fn().mockResolvedValue({})
      };
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue(mockHeatLot);

      jest.spyOn(quarantineRepository, 'createQuarantine').mockResolvedValue({
        ...mockQuarantinePayload,
        id: 'qrn_001',
        tenantId: testTenant,
        quarantineNumber: 'QRN-2026-00001',
        itemCode: 'MAT-4140-RND-50',
        uom: 'KG',
        status: 'ACTIVE_QUARANTINE',
        toJSON: () => ({
          ...mockQuarantinePayload,
          id: 'qrn_001',
          quarantineNumber: 'QRN-2026-00001',
          status: 'ACTIVE_QUARANTINE'
        })
      } as any);

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/quarantine')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send(mockQuarantinePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quarantineNumber).toBe('QRN-2026-00001');
      expect(res.body.data.status).toBe('ACTIVE_QUARANTINE');
      expect(mockHeatLot.status).toBe('QUARANTINED');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'INVENTORY_QUARANTINE_PLACED'
        })
      );
    });

    it('should reject placing target in quarantine if active quarantine already exists', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue({
        quarantineNumber: 'QRN-2026-00001'
      } as any);

      const res = await request(app)
        .post('/api/v1/quarantine')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send(mockQuarantinePayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already under active quarantine');
    });
  });

  describe('POST /api/v1/quarantine/:id/release (Release to Stock)', () => {
    it('should release quarantined material back to usable stock and update heat lot', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockRecord = {
        id: 'qrn_001',
        quarantineNumber: 'QRN-2026-00001',
        targetType: 'HEAT_LOT',
        targetIdentifier: 'HL-202608-0001',
        status: 'ACTIVE_QUARANTINE',
        toJSON: () => ({ quarantineNumber: 'QRN-2026-00001', status: 'ACTIVE_QUARANTINE' })
      };

      jest.spyOn(quarantineRepository, 'findQuarantineById').mockResolvedValue(mockRecord as any);

      const mockHeatLot: any = {
        id: 'hl_001',
        heatLotNumber: 'HL-202608-0001',
        status: 'QUARANTINED',
        save: jest.fn().mockResolvedValue({})
      };
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue(mockHeatLot);

      jest.spyOn(quarantineRepository, 'updateQuarantine').mockResolvedValue({
        ...mockRecord,
        status: 'RELEASED_TO_STOCK',
        toJSON: () => ({ quarantineNumber: 'QRN-2026-00001', status: 'RELEASED_TO_STOCK' })
      } as any);

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/quarantine/qrn_001/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          releaseNotes: 'Re-test on OBLF Spectrometer confirmed Cr = 0.82%, within ASTM specification'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RELEASED_TO_STOCK');
      expect(mockHeatLot.status).toBe('RELEASED');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'INVENTORY_QUARANTINE_RELEASED'
        })
      );
    });
  });

  describe('POST /api/v1/quarantine/:id/disposition (Disposition Rejection/Scrap)', () => {
    it('should disposition quarantined material to SCRAP_DISPOSITION and mark heat lot as REJECTED', async () => {
      const metToken = generateToken('usr_met', ['METALLURGIST']);

      const mockRecord = {
        id: 'qrn_001',
        quarantineNumber: 'QRN-2026-00001',
        targetType: 'HEAT_LOT',
        targetIdentifier: 'HL-202608-0001',
        status: 'ACTIVE_QUARANTINE',
        toJSON: () => ({ quarantineNumber: 'QRN-2026-00001', status: 'ACTIVE_QUARANTINE' })
      };

      jest.spyOn(quarantineRepository, 'findQuarantineById').mockResolvedValue(mockRecord as any);

      const mockHeatLot: any = {
        id: 'hl_001',
        heatLotNumber: 'HL-202608-0001',
        status: 'QUARANTINED',
        save: jest.fn().mockResolvedValue({})
      };
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue(mockHeatLot);

      jest.spyOn(quarantineRepository, 'updateQuarantine').mockResolvedValue({
        ...mockRecord,
        status: 'SCRAP_DISPOSITION',
        toJSON: () => ({ quarantineNumber: 'QRN-2026-00001', status: 'SCRAP_DISPOSITION' })
      } as any);

      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/quarantine/qrn_001/disposition')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          dispositionStatus: 'SCRAP_DISPOSITION',
          dispositionNotes: 'Excessive internal hydrogen flaking confirmed via ultrasonic NDT. Scrap lot.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SCRAP_DISPOSITION');
      expect(mockHeatLot.status).toBe('REJECTED');
      expect(auditSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'INVENTORY_QUARANTINE_DISPOSITIONED'
        })
      );
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user lacking INVENTORY_HEAT_LOT_QUARANTINE permission', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/quarantine')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send(mockQuarantinePayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
