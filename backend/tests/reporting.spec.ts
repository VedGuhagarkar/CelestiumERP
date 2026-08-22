import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { reportingRepository } from '../src/modules/reporting/reporting.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';

describe('Manufacturing Analytics & Authoritative Operational Reporting', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockProductionJobs: any[] = [
    {
      id: 'job_001',
      jobNumber: 'JOB-202608-0001',
      status: 'COMPLETED',
      quantity: { targetQuantity: 100, completedQuantity: 98, scrappedQuantity: 2 },
      totalWeightKg: 245.0,
      recipe: { recipeCode: 'RCP-CARB-01' },
      item: { itemCode: 'SHAFT-01' },
      execution: { furnaceCode: 'FURNACE-VAC-01', furnaceId: 'furn_01' },
      plannedMetrics: { estimatedDurationHours: 8.0 },
      actualMetrics: { totalProcessingTimeMinutes: 504 } // 8.4 hours
    },
    {
      id: 'job_002',
      jobNumber: 'JOB-202608-0002',
      status: 'IN_PROGRESS',
      quantity: { targetQuantity: 200, completedQuantity: 0 },
      totalWeightKg: 500.0,
      recipe: { recipeCode: 'RCP-ANNEAL-02' },
      item: { itemCode: 'GEAR-02' },
      execution: { furnaceCode: 'FURNACE-PIT-01', furnaceId: 'furn_02' },
      plannedMetrics: { estimatedDurationHours: 12.0 },
      actualMetrics: { totalProcessingTimeMinutes: 720 }
    }
  ];

  const mockInspections: any[] = [
    {
      id: 'insp_001',
      overallStatus: 'ACCEPTED',
      isReinspection: false,
      disposition: 'CONFORMING'
    },
    {
      id: 'insp_002',
      overallStatus: 'ACCEPTED',
      isReinspection: false,
      disposition: 'CONFORMING'
    },
    {
      id: 'insp_003',
      overallStatus: 'REJECTED',
      isReinspection: false,
      disposition: 'REWORK'
    }
  ];

  const mockNcrs: any[] = [
    {
      id: 'ncr_001',
      ncrNumber: 'NCR-202608-0001',
      title: 'Surface decarburization exceeded threshold',
      status: 'OPEN',
      defectCategory: 'Surface Oxidation / Decarb',
      affectedQuantity: 15,
      scrappedQuantity: 2,
      reworkedQuantity: 13,
      createdAt: new Date('2026-08-10T10:00:00Z')
    }
  ];

  const mockMachines: any[] = [
    {
      id: 'furn_01',
      machineCode: 'FURNACE-VAC-01',
      name: 'Vacuum Hardening Furnace #1',
      location: { bay: 'Bay 1' }
    },
    {
      id: 'furn_02',
      machineCode: 'FURNACE-PIT-01',
      name: 'Pit Carburizing Furnace #2',
      location: { bay: 'Bay 2' }
    }
  ];

  const mockWorkOrders: any[] = [
    {
      id: 'wo_01',
      machineId: 'furn_01',
      machineCode: 'FURNACE-VAC-01',
      workOrderType: 'EMERGENCY_BREAKDOWN',
      failureCategory: 'Heating Element Failure',
      downtimeDurationMinutes: 240 // 4 hours
    }
  ];

  const mockAttendance: any[] = [
    { employeeId: 'EMP-01', department: 'Thermal Processing', status: 'PRESENT', workingHours: 8 },
    { employeeId: 'EMP-02', department: 'Thermal Processing', status: 'PRESENT', workingHours: 8 },
    { employeeId: 'EMP-03', department: 'Quality Assurance', status: 'ABSENT', workingHours: 0 }
  ];

  const mockOvertime: any[] = [
    { employeeId: 'EMP-01', employeeName: 'Alex Smith', department: 'Thermal Processing', hours: 4 }
  ];

  const mockItems: any[] = [
    { itemCode: 'SHAFT-01', name: 'Drive Shaft', materialGrade: 'AISI 4340', standardCost: 45.0, safetyStock: 20 },
    { itemCode: 'GEAR-02', name: 'Pinion Gear', materialGrade: 'EN 353', standardCost: 65.0, safetyStock: 50 }
  ];

  const mockInventoryBalances: any[] = [
    { itemCode: 'SHAFT-01', quantity: 150 },
    { itemCode: 'GEAR-02', quantity: 15 } // Shortage! (15 < 50)
  ];

  const mockWarehouses: any[] = [
    { id: 'wh_01', warehouseCode: 'WH-MAIN', name: 'Main Plant Warehouse', totalBins: 1000, occupiedBins: 650, type: 'STORES' }
  ];

  const mockDispatches: any[] = [
    {
      dispatchNumber: 'DSP-202608-0001',
      status: 'DELIVERED',
      totalQuantity: 98,
      totalGrossWeightKg: 245.0,
      customer: { customerCode: 'CUST-AERO-01', customerName: 'Aero Dynamics' },
      carrier: { carrierName: 'Express Logistics', transportMode: 'ROAD' },
      timeline: {
        estimatedArrivalTime: new Date('2026-08-18T18:00:00Z'),
        actualDeliveryTime: new Date('2026-08-18T17:30:00Z') // On time
      }
    }
  ];

  const mockJobCosts: any[] = [
    {
      jobId: 'job_001',
      jobNumber: 'JOB-202608-0001',
      actualTotalCost: 1850.0,
      standardTotalCost: 1750.0,
      customerCode: 'CUST-AERO-01',
      itemCode: 'SHAFT-01',
      recipeCode: 'RCP-CARB-01',
      completedQuantity: 98,
      actualCost: { materialCost: 250, directLaborCost: 400, energyProcessCost: 550, furnaceRuntimeCost: 400, approvedOverheadCost: 250 }
    }
  ];

  const mockInvoices: any[] = [
    {
      invoiceNumber: 'INV-202608-0001',
      status: 'ISSUED',
      totalAmount: 2619.6,
      outstandingBalance: 1619.6,
      lines: [{ jobId: 'job_001', subtotal: 2220.0 }]
    }
  ];

  beforeEach(() => {
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });

    jest.spyOn(reportingRepository, 'getProductionJobs').mockResolvedValue(mockProductionJobs);
    jest.spyOn(reportingRepository, 'getQualityInspections').mockResolvedValue(mockInspections);
    jest.spyOn(reportingRepository, 'getNcrs').mockResolvedValue(mockNcrs);
    jest.spyOn(reportingRepository, 'getCapas').mockResolvedValue([]);
    jest.spyOn(reportingRepository, 'getMachines').mockResolvedValue(mockMachines);
    jest.spyOn(reportingRepository, 'getMaintenanceWorkOrders').mockResolvedValue(mockWorkOrders);
    jest.spyOn(reportingRepository, 'getAttendanceRecords').mockResolvedValue(mockAttendance);
    jest.spyOn(reportingRepository, 'getOvertimeRecords').mockResolvedValue(mockOvertime);
    jest.spyOn(reportingRepository, 'getItems').mockResolvedValue(mockItems);
    jest.spyOn(reportingRepository, 'getInventoryBalances').mockResolvedValue(mockInventoryBalances);
    jest.spyOn(reportingRepository, 'getWarehouses').mockResolvedValue(mockWarehouses);
    jest.spyOn(reportingRepository, 'getQuarantineRecords').mockResolvedValue([]);
    jest.spyOn(reportingRepository, 'getDispatches').mockResolvedValue(mockDispatches);
    jest.spyOn(reportingRepository, 'getJobCosts').mockResolvedValue(mockJobCosts);
    jest.spyOn(reportingRepository, 'getInvoices').mockResolvedValue(mockInvoices);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Executive Operational Dashboard', () => {
    it('should aggregate authoritative operational, quality, equipment, workforce, and financial KPIs', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/dashboard/executive')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Operational KPIs
      expect(data.operational.totalProductionJobs).toBe(2);
      expect(data.operational.completedJobsCount).toBe(1);
      expect(data.operational.activeJobsCount).toBe(1);
      expect(data.operational.totalDispatchedLots).toBe(1);
      expect(data.operational.onTimeDeliveryPercent).toBe(100.0);

      // Quality KPIs (2 passed out of 3 initial -> 66.7% FPY)
      expect(data.quality.totalInspectionsCount).toBe(3);
      expect(data.quality.passedInspectionsCount).toBe(2);
      expect(data.quality.firstPassYieldPercent).toBe(66.7);
      expect(data.quality.openNcrCount).toBe(1);

      // Equipment & OEE KPIs
      expect(data.equipment.totalDowntimeHours).toBe(4.0);
      expect(data.equipment.unplannedDowntimeHours).toBe(4.0);
      expect(data.equipment.mttrHours).toBe(4.0);
      expect(data.equipment.averageAvailabilityPercent).toBeGreaterThan(90);

      // Workforce KPIs (2 present out of 3 -> 66.7% attendance)
      expect(data.workforce.averageAttendancePercent).toBe(66.7);
      expect(data.workforce.totalOvertimeHours).toBe(4.0);

      // Financial KPIs
      expect(data.financial.totalInvoicedRevenue).toBe(2619.6);
      expect(data.financial.totalManufacturingCost).toBe(1850.0);
      expect(data.financial.totalOutstandingReceivables).toBe(1619.6);
    });
  });

  describe('Production & Throughput Reporting', () => {
    it('should calculate furnace throughput rates in Kg/Hr and completed pieces', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/production/throughput')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.summary.totalJobsCount).toBe(2);
      expect(data.summary.totalWeightKg).toBe(745.0);
      expect(data.items.length).toBe(2); // FURNACE-VAC-01 and FURNACE-PIT-01
    });

    it('should export production throughput report to CSV', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/production/throughput?format=csv')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
      expect(res.text).toContain('"Furnace Code","Total Jobs","Completed Jobs"');
      expect(res.text).toContain('FURNACE-VAC-01');
    });
  });

  describe('Cycle-Time Analysis Reporting', () => {
    it('should calculate planned vs actual cycle times and stage variances', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/production/cycle-time')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.summary.totalJobsAnalyzed).toBe(2);
      expect(data.items[0].jobNumber).toBe('JOB-202608-0001');
      expect(data.items[0].plannedCycleTimeHours).toBe(8.0);
      expect(data.items[0].actualCycleTimeHours).toBe(8.4);
      expect(data.items[0].stages.length).toBe(5);
    });
  });

  describe('Equipment OEE, Downtime, MTTR & MTBF Reporting', () => {
    it('should calculate Availability, Performance, Quality, OEE %, MTTR, and MTBF per machine', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/equipment/oee')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.summary.totalMachinesCount).toBe(2);
      expect(data.summary.unplannedDowntimeHours).toBe(4.0);
      expect(data.summary.totalBreakdownsCount).toBe(1);
      expect(data.summary.overallMttrHours).toBe(4.0);
      expect(data.machines[0].oeePercent).toBeGreaterThan(0);
      expect(data.downtimeBreakdownByCategory.length).toBeGreaterThan(0);
    });
  });

  describe('Quality Analytics, FPY & Defect Reporting', () => {
    it('should calculate first-pass yield FPY %, defect categories, and average resolution time', async () => {
      const token = generateToken('usr_qa', ['METALLURGIST']);

      const res = await request(app)
        .get('/api/v1/reporting/quality')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.summary.overallFpyPercent).toBe(66.7);
      expect(data.summary.openNcrCount).toBe(1);
      expect(data.defectsByCategory.length).toBe(1);
      expect(data.defectsByCategory[0].defectCategory).toBe('Surface Oxidation / Decarb');
    });
  });

  describe('Workforce Attendance & Overtime Reporting', () => {
    it('should calculate attendance rates and overtime hours by department', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/workforce/attendance')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.summary.totalOvertimeHours).toBe(4.0);
      expect(data.departmentBreakdown.length).toBe(2);
      expect(data.topOvertimeEmployees[0].employeeName).toBe('Alex Smith');
    });
  });

  describe('Inventory Valuation & Warehouse Occupancy', () => {
    it('should calculate total inventory valuation and detect safety stock shortages', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/inventory/valuation')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.summary.totalActiveItems).toBe(2);
      expect(data.summary.criticalShortagesCount).toBe(1); // GEAR-02 (15 < 50)
      expect(data.summary.totalInventoryValuation).toBe(150 * 45.0 + 15 * 65.0); // 6750 + 975 = 7725
      expect(data.warehouseOccupancies[0].occupancyPercent).toBe(65.0);
    });
  });

  describe('Dispatch & OTIF Delivery Performance', () => {
    it('should calculate on-time dispatch and on-time in-full (OTIF) delivery metrics', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/dispatch')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.summary.totalDispatchesCount).toBe(1);
      expect(data.summary.deliveredCount).toBe(1);
      expect(data.summary.onTimeInFullDeliveryPercent).toBe(100.0);
      expect(data.dispatches[0].isOnTime).toBe(true);
    });
  });

  describe('Job Costing & Profitability Reporting', () => {
    it('should compute job gross profit, gross margin %, cost variances, and profitability status', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/costing/profitability')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.summary.totalJobsAnalyzed).toBe(1);
      expect(data.jobs[0].jobNumber).toBe('JOB-202608-0001');
      expect(data.jobs[0].totalActualCost).toBe(1850.0);
      expect(data.jobs[0].invoicedRevenue).toBe(2220.0);
      expect(data.jobs[0].grossProfitAmount).toBe(370.0); // 2220 - 1850
      expect(data.jobs[0].grossProfitMarginPercent).toBe(16.7);
      expect(data.jobs[0].profitabilityStatus).toBe('STANDARD_MARGIN');
    });
  });

  describe('Manufacturing Command Center Dashboard', () => {
    it('should generate owner-view command center with operational, quality, equipment, and financial KPIs', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const res = await request(app)
        .get('/api/v1/reporting/command-center')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.viewMode).toBe('OWNER');
      expect(data.kpis.activeJobs.total).toBeGreaterThanOrEqual(1);
      expect(data.kpis.runningFurnaces.total).toBeGreaterThanOrEqual(2);
      expect(data.kpis.pendingQc.pendingInspections).toBeDefined();
      expect(data.kpis.dispatch.readyForDispatch).toBeDefined();
      expect(data.kpis.financial).toBeDefined();
      expect(data.kpis.financial.grossMarginPercent).toBeDefined();
      expect(data.throughput.totalWeightKgToday).toBeGreaterThan(0);
      expect(data.activeFurnaces.length).toBeGreaterThan(0);
      expect(data.alerts.lowInventory.length).toBeGreaterThan(0);
      expect(data.maintenance).toBeDefined();
      expect(data.attendance.activeHeadcount).toBeDefined();
      expect(data.recentActivity).toBeDefined();
    });

    it('should scope command center for operators by omitting financial metrics', async () => {
      const operatorToken = generateToken('usr_furnace_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .get('/api/v1/reporting/command-center')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.viewMode).toBe('OPERATOR');
      expect(data.kpis.activeJobs).toBeDefined();
      expect(data.kpis.runningFurnaces).toBeDefined();
      expect(data.kpis.financial).toBeUndefined(); // Financial KPIs omitted for non-finance/non-management roles
    });
  });

  describe('RBAC Authorization & Tenant Isolation', () => {
    it('should reject unauthenticated access', async () => {
      const res = await request(app).get('/api/v1/reporting/dashboard/executive');
      expect(res.status).toBe(401);
    });

    it('should reject unauthorized operator role without analytics permissions', async () => {
      const operatorToken = generateToken('usr_furnace_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .get('/api/v1/reporting/equipment/oee')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(403);
    });
  });
});
