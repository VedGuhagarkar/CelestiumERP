import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { searchRepository } from '../src/modules/search/search.repository.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES, PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';

describe('Manufacturing Global Search & Operational Navigation', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';
  const otherTenant = 'tenant_heat_treat_002';

  const generateToken = (
    userId: string,
    roles: string[],
    permissions?: string[],
    tenant: string = testTenant
  ) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles, permissions },
      config.auth.jwtSecret
    );
  };

  const mockJobs = [
    {
      id: 'job_001',
      jobNumber: 'JOB-202608-0010',
      status: 'IN_PROGRESS',
      currentStage: 'AUSTENITIZING_SOAK',
      customer: { customerName: 'AeroDynamics Corp' },
      item: { itemCode: 'SHAFT-4340' },
      quantity: { targetQuantity: 100, completedQuantity: 0 }
    }
  ];

  const mockMachines = [
    {
      id: 'mach_01',
      machineCode: 'FURNACE-VAC-01',
      name: 'Vacuum Hardening Furnace #1',
      type: 'VACUUM_FURNACE',
      status: 'RUNNING',
      serialNumber: 'SN-VAC-9901',
      location: { bay: 'Bay 1' }
    }
  ];

  const mockHeatLots = [
    {
      id: 'hl_01',
      heatLotNumber: 'HL-4340-9901',
      supplierHeatNumber: 'HEAT-SUP-888',
      materialGrade: 'AISI 4340',
      quantityOnHand: 2500,
      isQuarantined: false
    }
  ];

  const mockMaterials = [
    {
      id: 'item_01',
      itemCode: 'BAR-4340-50MM',
      name: 'AISI 4340 Round Bar 50mm',
      materialGrade: 'AISI 4340',
      uom: 'KG',
      standardCost: 45.0,
      safetyStock: 50
    }
  ];

  const mockNcrs = [
    {
      id: 'ncr_01',
      ncrNumber: 'NCR-202608-0004',
      title: 'Surface decarburization on vacuum batch',
      severity: 'CRITICAL',
      jobNumber: 'JOB-202608-0010',
      defectCategory: 'Decarburization',
      quarantinedQuantity: 45,
      status: 'OPEN'
    }
  ];

  const mockInvoices = [
    {
      id: 'inv_01',
      invoiceNumber: 'INV-2026-0089',
      customerCode: 'CUST-AERO',
      totalAmount: 14500.0,
      outstandingAmount: 14500.0,
      paymentStatus: 'UNPAID',
      dueDate: new Date('2026-09-15')
    }
  ];

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

  describe('Multi-Domain Global Search', () => {
    it('should search across jobs, furnaces, heat lots, materials, and NCRs for authorized plant manager', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      jest.spyOn(searchRepository, 'searchJobs').mockResolvedValue(mockJobs);
      jest.spyOn(searchRepository, 'searchMachines').mockResolvedValue(mockMachines);
      jest.spyOn(searchRepository, 'searchHeatLots').mockResolvedValue(mockHeatLots);
      jest.spyOn(searchRepository, 'searchMaterials').mockResolvedValue(mockMaterials);
      jest.spyOn(searchRepository, 'searchCustomers').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchEmployees').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchInspections').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchNcrs').mockResolvedValue(mockNcrs);
      jest.spyOn(searchRepository, 'searchWarehouses').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchDispatches').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchInvoices').mockResolvedValue(mockInvoices);

      const res = await request(app)
        .get('/api/v1/search?q=4340')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.query).toBe('4340');
      expect(data.totalResults).toBeGreaterThanOrEqual(4);

      // Verify domain result groups
      const jobGroup = data.groups.find((g: any) => g.category === 'JOBS');
      expect(jobGroup).toBeDefined();
      expect(jobGroup.items[0].referenceCode).toBe('JOB-202608-0010');
      expect(jobGroup.items[0].actionUrl).toBe('/production-jobs/job_001');

      const machineGroup = data.groups.find((g: any) => g.category === 'MACHINES');
      expect(machineGroup).toBeDefined();
      expect(machineGroup.items[0].referenceCode).toBe('FURNACE-VAC-01');

      const ncrGroup = data.groups.find((g: any) => g.category === 'NCRS');
      expect(ncrGroup).toBeDefined();
      expect(ncrGroup.items[0].referenceCode).toBe('NCR-202608-0004');
    });

    it('should filter search to a single category when category query parameter is provided', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const jobSpy = jest.spyOn(searchRepository, 'searchJobs').mockResolvedValue(mockJobs);
      const machineSpy = jest.spyOn(searchRepository, 'searchMachines').mockResolvedValue(mockMachines);

      const res = await request(app)
        .get('/api/v1/search?q=VAC&category=MACHINES')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(machineSpy).toHaveBeenCalled();
      expect(jobSpy).not.toHaveBeenCalled();
      expect(res.body.data.groups.every((g: any) => g.category === 'MACHINES')).toBe(true);
    });
  });

  describe('Permission-Scoped Domain Isolation', () => {
    it('should strictly exclude invoices from search results for furnace operators lacking finance permissions', async () => {
      const operatorToken = generateToken('usr_furnace_op', ['FURNACE_OPERATOR']);

      jest.spyOn(searchRepository, 'searchJobs').mockResolvedValue(mockJobs);
      jest.spyOn(searchRepository, 'searchMachines').mockResolvedValue(mockMachines);
      const invoiceSpy = jest.spyOn(searchRepository, 'searchInvoices').mockResolvedValue(mockInvoices);

      const res = await request(app)
        .get('/api/v1/search?q=INV')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(invoiceSpy).not.toHaveBeenCalled();
      expect(res.body.data.groups.some((g: any) => g.category === 'INVOICES')).toBe(false);
    });

    it('should include invoice results for finance controllers with billing permissions', async () => {
      const financeToken = generateToken('usr_finance', ['FINANCE_CONTROLLER']);

      jest.spyOn(searchRepository, 'searchJobs').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchMachines').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchHeatLots').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchMaterials').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchCustomers').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchEmployees').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchInspections').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchNcrs').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchWarehouses').mockResolvedValue([]);
      jest.spyOn(searchRepository, 'searchDispatches').mockResolvedValue([]);
      const invoiceSpy = jest.spyOn(searchRepository, 'searchInvoices').mockResolvedValue(mockInvoices);

      const res = await request(app)
        .get('/api/v1/search?q=INV')
        .set('Authorization', `Bearer ${financeToken}`);

      expect(res.status).toBe(200);
      expect(invoiceSpy).toHaveBeenCalled();
      const invoiceGroup = res.body.data.groups.find((g: any) => g.category === 'INVOICES');
      expect(invoiceGroup).toBeDefined();
      expect(invoiceGroup.items[0].referenceCode).toBe('INV-2026-0089');
    });
  });

  describe('Quick Actions & Suggestions', () => {
    it('should return role-tailored quick actions for command palette', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/search/quick-actions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const actions = res.body.data;
      expect(actions.length).toBeGreaterThan(3);
      expect(actions.some((a: any) => a.title.includes('Manufacturing Command Center'))).toBe(true);
      expect(actions.some((a: any) => a.title.includes('Create Production Work Order'))).toBe(true);
      expect(actions.some((a: any) => a.title.includes('Record QC Hardness Survey'))).toBe(true);
    });

    it('should return search typeahead suggestions', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/search/suggestions?q=JOB')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toContain('JOB');
    });
  });

  describe('Tenant Isolation & Validation', () => {
    it('should reject unauthenticated search requests', async () => {
      const res = await request(app).get('/api/v1/search?q=test');
      expect(res.status).toBe(401);
    });

    it('should reject empty search query with 422 Unprocessable Entity', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/search?q=')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
    });
  });
});
