import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { customerRepository } from '../src/modules/customer/customer.repository.js';
import { itemRepository } from '../src/modules/item/item.repository.js';
import { recipeRepository } from '../src/modules/recipe/recipe.repository.js';
import { specificationRepository } from '../src/modules/specification/specification.repository.js';
import { heatLotRepository } from '../src/modules/traceability/heat-lot.repository.js';
import { warehouseRepository } from '../src/modules/warehouse/warehouse.repository.js';
import { quarantineRepository } from '../src/modules/quarantine/quarantine.repository.js';
import { finishedGoodsRepository } from '../src/modules/finished-goods/finished-goods.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Phase 2 Master Data & Inventory End-to-End Integration Certification', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
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

  describe('End-to-End Manufacturing Genealogy & Quality Integrity Flow', () => {
    it('should complete full integrated journey from Customer & Item Master -> Recipe & Spec -> Heat Lot -> Quarantine -> Finished Goods with QC Release Gate', async () => {
      const metToken = generateToken('usr_chief_met', ['METALLURGIST', 'PLANT_MANAGER']);
      const clerkToken = generateToken('usr_stores_clerk', ['INVENTORY_CLERK']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      // 1. Customer Master Verification
      const mockCustomer = {
        id: 'cust_aero_001',
        tenantId: testTenant,
        customerCode: 'CUST-AERO-001',
        companyName: 'Aero Dynamics Corp',
        industrySegment: 'Aerospace',
        status: 'active',
        toJSON: () => ({ customerCode: 'CUST-AERO-001', companyName: 'Aero Dynamics Corp' })
      };
      jest.spyOn(customerRepository, 'findByCode').mockResolvedValue(null);
      jest.spyOn(customerRepository, 'create').mockResolvedValue(mockCustomer as any);

      const custRes = await request(app)
        .post('/api/v1/customers')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          customerCode: 'CUST-AERO-001',
          companyName: 'Aero Dynamics Corp',
          industrySegment: 'Aerospace',
          contacts: [
            {
              name: 'Sarah Jenkins',
              email: 'sjenkins@aerodynamics.com',
              phone: '+1-555-019-2834',
              isPrimary: true
            }
          ],
          billingAddress: {
            street: '100 Aerospace Blvd',
            city: 'Seattle',
            state: 'WA',
            country: 'USA',
            postalCode: '98101'
          }
        });
      expect(custRes.status).toBe(201);
      expect(custRes.body.data.customerCode).toBe('CUST-AERO-001');

      // 2. Item Master Verification
      const mockItem = {
        id: 'item_4140_001',
        tenantId: testTenant,
        itemCode: 'MAT-4140-RND-50',
        name: 'AISI 4140 Round Bar Ø50mm',
        category: 'RAW_MATERIAL',
        materialGrade: 'AISI 4140',
        uom: 'KG',
        currentStock: 0,
        allocatedStock: 0,
        status: 'ACTIVE',
        toJSON: () => ({ itemCode: 'MAT-4140-RND-50', uom: 'KG' })
      };
      jest.spyOn(itemRepository, 'findByCode').mockResolvedValue(null);
      jest.spyOn(itemRepository, 'create').mockResolvedValue(mockItem as any);
      jest.spyOn(itemRepository, 'findById').mockResolvedValue(mockItem as any);

      const itemRes = await request(app)
        .post('/api/v1/items')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          itemCode: 'MAT-4140-RND-50',
          name: 'AISI 4140 Round Bar Ø50mm',
          category: 'RAW_MATERIAL',
          materialGrade: 'AISI 4140',
          uom: 'KG'
        });
      expect(itemRes.status).toBe(201);

      // 3. Heat-Treatment Recipe Master Verification (Revision 1)
      const mockRecipe = {
        id: 'rec_001',
        tenantId: testTenant,
        recipeCode: 'REC-CARB-4140-01',
        name: 'Carburize & Hardening for 4140 Pinion',
        processFamily: 'CARBURIZING',
        status: 'ACTIVE',
        revision: 1,
        isCurrent: true,
        toJSON: () => ({ recipeCode: 'REC-CARB-4140-01', revision: 1, status: 'ACTIVE' })
      };
      jest.spyOn(recipeRepository, 'findByCodeAndRevision').mockResolvedValue(null);
      jest.spyOn(recipeRepository, 'create').mockResolvedValue(mockRecipe as any);

      const recRes = await request(app)
        .post('/api/v1/recipes')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          recipeCode: 'REC-CARB-4140-01',
          name: 'Carburize & Hardening for 4140 Pinion',
          processFamily: 'CARBURIZING',
          applicableMaterialGrades: ['AISI 4140'],
          stages: [
            {
              sequence: 1,
              stageName: 'Carburize & Soak',
              targetTemperatureC: 920,
              temperatureToleranceMinusC: 5,
              temperatureTolerancePlusC: 5,
              soakTimeMinutes: 240,
              soakCriteria: 'FIXED_TIME'
            }
          ],
          metallurgicalTargets: {
            targetHardnessMin: 58,
            targetHardnessMax: 62,
            hardnessScale: 'HRC'
          },
          machineRequirements: {
            compatibleFurnaceTypes: ['SEALED_QUENCH_FURNACE'],
            maxOperatingTempRequiredC: 1050
          }
        });
      expect(recRes.status).toBe(201);

      // 4. Metallurgical Specification Master Verification
      const mockSpec = {
        id: 'spec_001',
        tenantId: testTenant,
        specificationCode: 'SPEC-AERO-4140-01',
        name: 'Aerospace Pinion Gear Hardness & ECD Spec',
        customerCode: 'CUST-AERO-001',
        status: 'ACTIVE',
        revision: 1,
        toJSON: () => ({ specificationCode: 'SPEC-AERO-4140-01', revision: 1, status: 'ACTIVE' })
      };
      jest.spyOn(specificationRepository, 'findByCodeAndRevision').mockResolvedValue(null);
      jest.spyOn(specificationRepository, 'create').mockResolvedValue(mockSpec as any);

      const specRes = await request(app)
        .post('/api/v1/specifications')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          specCode: 'SPEC-AERO-4140-01',
          title: 'Aerospace Pinion Gear Hardness & ECD Spec',
          customerCode: 'CUST-AERO-001',
          processFamily: 'CARBURIZING',
          applicableMaterialGrades: ['AISI 4140'],
          surfaceHardness: { min: 58, max: 62, scale: 'HRC' },
          customerAcceptance: {
            samplingPlan: 'ANSI/ASQ Z1.4 Level II',
            testStandardReferences: ['ASTM E18', 'ASTM E384']
          }
        });
      expect(specRes.status).toBe(201);

      // 5. Warehouse & Location Master Verification
      const mockWarehouse = {
        id: 'wh_main_001',
        tenantId: testTenant,
        code: 'WH-MAIN-PLANT',
        name: 'Main Plant Storage',
        type: 'MAIN_PLANT',
        status: 'ACTIVE',
        toJSON: () => ({ code: 'WH-MAIN-PLANT' })
      };
      jest.spyOn(warehouseRepository, 'findWarehouseByCode').mockResolvedValue(null);
      jest.spyOn(warehouseRepository, 'createWarehouse').mockResolvedValue(mockWarehouse as any);
      jest.spyOn(warehouseRepository, 'findWarehouseById').mockResolvedValue(mockWarehouse as any);

      const whRes = await request(app)
        .post('/api/v1/warehouses')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          code: 'WH-MAIN-PLANT',
          name: 'Main Plant Storage',
          type: 'MAIN_PLANT'
        });
      expect(whRes.status).toBe(201);

      // 6. Inward Heat Lot with MTR Chemistry Spectrometry
      const mockHeatLot = {
        id: 'hl_001',
        tenantId: testTenant,
        heatLotNumber: 'HL-202608-0001',
        itemId: 'item_4140_001',
        itemCode: 'MAT-4140-RND-50',
        materialGrade: 'AISI 4140',
        supplierHeatNumber: 'NIPPON-884920',
        mtrNumber: 'MTR-NS-4140-2026-01',
        chemicalComposition: { C: 0.41, Cr: 1.05, Mo: 0.22, Mn: 0.85 },
        receivedQuantity: 5000,
        currentQuantity: 5000,
        allocatedQuantity: 0,
        consumedQuantity: 0,
        uom: 'KG',
        status: 'INWARDED',
        allocations: [],
        consumptionHistory: [],
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({
          heatLotNumber: 'HL-202608-0001',
          supplierHeatNumber: 'NIPPON-884920',
          mtrNumber: 'MTR-NS-4140-2026-01',
          currentQuantity: 5000
        })
      };
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue(null);
      jest.spyOn(heatLotRepository, 'generateNextHeatLotNumber').mockResolvedValue('HL-202608-0001');
      jest.spyOn(heatLotRepository, 'create').mockResolvedValue(mockHeatLot as any);
      jest.spyOn(itemRepository, 'updateStock').mockResolvedValue({} as any);
      jest.spyOn(itemRepository, 'incrementBatchCounters').mockResolvedValue({} as any);

      const hlRes = await request(app)
        .post('/api/v1/heat-lots/inward')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          itemId: 'item_4140_001',
          materialGrade: 'AISI 4140',
          supplierHeatNumber: 'NIPPON-884920',
          supplierLotNumber: 'LOT-992',
          supplierName: 'Nippon Steel',
          mtrNumber: 'MTR-NS-4140-2026-01',
          chemicalComposition: { C: 0.41, Cr: 1.05, Mo: 0.22, Mn: 0.85 },
          receivedQuantity: 5000,
          uom: 'KG',
          storageLocation: 'Raw Material Yard Bay 1'
        });
      expect(hlRes.status).toBe(201);
      expect(hlRes.body.data.heatLotNumber).toBe('HL-202608-0001');

      // 7. Place in Quarantine & Release
      jest.spyOn(quarantineRepository, 'findActiveQuarantineForTarget').mockResolvedValue(null);
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue(mockHeatLot as any);
      jest.spyOn(quarantineRepository, 'createQuarantine').mockResolvedValue({
        id: 'qrn_001',
        tenantId: testTenant,
        quarantineNumber: 'QRN-2026-00001',
        status: 'ACTIVE_QUARANTINE',
        toJSON: () => ({ quarantineNumber: 'QRN-2026-00001', status: 'ACTIVE_QUARANTINE' })
      } as any);

      const qrnRes = await request(app)
        .post('/api/v1/quarantine')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          targetType: 'HEAT_LOT',
          targetId: 'hl_001',
          targetIdentifier: 'HL-202608-0001',
          itemId: 'item_4140_001',
          location: 'QUARANTINE-HOLD-01',
          quantity: 5000,
          reasonCode: 'SPECTROMETRY_CHEMISTRY_FAIL',
          reasonDescription: 'Pending secondary optical emission spectro confirmation',
          triggerSource: 'RECEIVING_INSPECTION'
        });
      expect(qrnRes.status).toBe(201);

      // Release from Quarantine
      jest.spyOn(quarantineRepository, 'findQuarantineById').mockResolvedValue({
        id: 'qrn_001',
        targetType: 'HEAT_LOT',
        targetIdentifier: 'HL-202608-0001',
        status: 'ACTIVE_QUARANTINE',
        toJSON: () => ({ status: 'ACTIVE_QUARANTINE' })
      } as any);
      jest.spyOn(quarantineRepository, 'updateQuarantine').mockResolvedValue({
        id: 'qrn_001',
        status: 'RELEASED_TO_STOCK',
        toJSON: () => ({ status: 'RELEASED_TO_STOCK' })
      } as any);

      const relRes = await request(app)
        .post('/api/v1/quarantine/qrn_001/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({ releaseNotes: 'Confirmed Mo % matches mill cert' });
      expect(relRes.status).toBe(200);

      // 8. Inward Finished Goods Output from Production (AWAITING_QC_RELEASE)
      const mockFG = {
        id: 'fg_001',
        tenantId: testTenant,
        fgLotNumber: 'FG-202608-0001',
        jobCardNumber: 'JC-2026-0801',
        heatLotNumber: 'HL-202608-0001',
        customerCode: 'CUST-AERO-001',
        itemId: 'item_4140_001',
        itemCode: 'MAT-4140-RND-50',
        totalQuantity: 200,
        availableQuantity: 0,
        reservedQuantity: 0,
        dispatchedQuantity: 0,
        uom: 'PCS',
        location: 'FG-STAGE-BAY-01',
        status: 'AWAITING_QC_RELEASE',
        qualityRelease: { isReleased: false },
        save: jest.fn().mockImplementation(function (this: any) {
          return Promise.resolve(this);
        }),
        toJSON: () => ({
          fgLotNumber: 'FG-202608-0001',
          status: 'AWAITING_QC_RELEASE',
          availableQuantity: 0
        })
      };
      jest.spyOn(finishedGoodsRepository, 'create').mockResolvedValue(mockFG as any);

      const operatorToken = generateToken('usr_operator', ['FURNACE_OPERATOR']);
      const fgInwardRes = await request(app)
        .post('/api/v1/finished-goods/inward')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          jobCardId: 'jc_001',
          jobCardNumber: 'JC-2026-0801',
          heatLotNumber: 'HL-202608-0001',
          customerCode: 'CUST-AERO-001',
          itemId: 'item_4140_001',
          totalQuantity: 200,
          location: 'FG-STAGE-BAY-01'
        });
      expect(fgInwardRes.status).toBe(201);
      expect(fgInwardRes.body.data.status).toBe('AWAITING_QC_RELEASE');

      // 9. Verify Quality Gate Blocks Pre-Dispatch Reservation
      jest.spyOn(finishedGoodsRepository, 'findById').mockResolvedValue(mockFG as any);
      const dispatchToken = generateToken('usr_dispatch', ['DISPATCH_OFFICER']);

      const blockedRes = await request(app)
        .post('/api/v1/finished-goods/fg_001/reserve')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${dispatchToken}`)
        .send({ quantity: 50 });
      expect(blockedRes.status).toBe(400);
      expect(blockedRes.body.message).toContain('not released by QC');

      // 10. Quality Release of Finished Goods with CoC Reference
      const fgRelRes = await request(app)
        .post('/api/v1/finished-goods/fg_001/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${metToken}`)
        .send({
          cocNumber: 'COC-2026-0081',
          inspectionReportId: 'QC-INSP-2026-092',
          releaseNotes: 'Final metallurgical approval passed for flight release'
        });
      expect(fgRelRes.status).toBe(200);

      // Verify Audit Logging was called throughout the pipeline
      expect(auditSpy).toHaveBeenCalled();
    });
  });

  describe('RBAC Security Boundary Enforcement across Phase 2', () => {
    it('should prevent unauthorized role from modifying recipes or releasing finished goods', async () => {
      const opToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const recipeRes = await request(app)
        .post('/api/v1/recipes')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({
          recipeCode: 'REC-CARB-HACK',
          name: 'Unauthorized Recipe',
          processFamily: 'CARBURIZING',
          applicableMaterialGrades: ['AISI 4140'],
          stages: [
            {
              sequence: 1,
              stageName: 'Carburize',
              targetTemperatureC: 920,
              soakTimeMinutes: 240
            }
          ],
          metallurgicalTargets: {
            targetHardnessMin: 58,
            targetHardnessMax: 62,
            hardnessScale: 'HRC'
          },
          machineRequirements: {
            compatibleFurnaceTypes: ['SEALED_QUENCH_FURNACE'],
            maxOperatingTempRequiredC: 1050
          }
        });
      expect(recipeRes.status).toBe(403);

      const fgRelRes = await request(app)
        .post('/api/v1/finished-goods/fg_001/release')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${opToken}`)
        .send({ releaseNotes: 'Attempting operator bypass' });
      expect(fgRelRes.status).toBe(403);
    });
  });
});
