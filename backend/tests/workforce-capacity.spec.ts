import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { workforceCapacityRepository } from '../src/modules/workforce-capacity/workforce-capacity.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';

describe('Factory Workforce Capacity & Operator Qualification Domain', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockEmployee1 = {
    id: 'emp_001',
    tenantId: testTenant,
    employeeCode: 'EMP-OP-001',
    fullName: 'Marcus Vance',
    department: 'Thermal Operations',
    designation: 'Lead Furnace Operator',
    defaultShift: 'SHIFT_1_MORNING',
    status: 'ACTIVE',
    maxDailyHours: 8.0,
    maxWeeklyOvertimeHours: 12.0,
    skills: [
      {
        skillCode: 'SEALED_QUENCH_FURNACE_OPERATION',
        skillName: 'Sealed Quench Furnace Operation',
        proficiency: 'EXPERT',
        certifiedDate: new Date('2025-01-10'),
        expiryDate: new Date('2027-01-10'),
        isCertified: true
      },
      {
        skillCode: 'METALLURGICAL_PYROMETRY_AMS2750',
        skillName: 'Pyrometry AMS 2750G',
        proficiency: 'COMPETENT',
        certifiedDate: new Date('2025-02-15'),
        expiryDate: new Date('2027-02-15'),
        isCertified: true
      }
    ],
    approvedLeaves: [],
    toJSON: () => ({
      employeeCode: 'EMP-OP-001',
      fullName: 'Marcus Vance',
      status: 'ACTIVE'
    })
  };

  const mockEmployeeOnLeave = {
    id: 'emp_002',
    tenantId: testTenant,
    employeeCode: 'EMP-OP-002',
    fullName: 'David Sterling',
    department: 'Thermal Operations',
    designation: 'Furnace Operator',
    defaultShift: 'SHIFT_1_MORNING',
    status: 'ACTIVE',
    maxDailyHours: 8.0,
    skills: [
      {
        skillCode: 'SEALED_QUENCH_FURNACE_OPERATION',
        skillName: 'Sealed Quench Furnace Operation',
        proficiency: 'COMPETENT',
        certifiedDate: new Date('2025-01-10'),
        expiryDate: new Date('2027-01-10'),
        isCertified: true
      }
    ],
    approvedLeaves: [
      {
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        endDate: new Date('2026-09-05T23:59:59.000Z'),
        leaveType: 'VACATION'
      }
    ]
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

  describe('POST /api/v1/workforce (Employee Registration)', () => {
    it('should register a new workforce member with skills and default shift', async () => {
      const adminToken = generateToken('usr_admin', ['ADMIN']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      jest.spyOn(workforceCapacityRepository, 'findEmployeeByCode').mockResolvedValue(null);
      jest.spyOn(workforceCapacityRepository, 'createEmployee').mockResolvedValue(mockEmployee1 as any);

      const res = await request(app)
        .post('/api/v1/workforce')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          employeeCode: 'EMP-OP-001',
          fullName: 'Marcus Vance',
          department: 'Thermal Operations',
          designation: 'Lead Furnace Operator',
          defaultShift: 'SHIFT_1_MORNING',
          skills: [
            {
              skillCode: 'SEALED_QUENCH_FURNACE_OPERATION',
              skillName: 'Sealed Quench Furnace Operation',
              proficiency: 'EXPERT',
              certifiedDate: '2025-01-10T00:00:00.000Z'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employeeCode).toBe('EMP-OP-001');
      expect(auditSpy).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/workforce-capacity/evaluate-coverage (Operator qualification & coverage)', () => {
    it('should confirm sufficient coverage when qualified active operators are available', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(workforceCapacityRepository, 'findEmployees').mockResolvedValue([mockEmployee1 as any]);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeAllocationsOnDate').mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/workforce-capacity/evaluate-coverage')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          date: '2026-09-01T00:00:00.000Z',
          shift: 'SHIFT_1_MORNING',
          requiredSkills: ['SEALED_QUENCH_FURNACE_OPERATION'],
          requiredOperatorCount: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSufficient).toBe(true);
      expect(res.body.data.availableQualifiedCount).toBe(1);
    });

    it('should flag operator shortage when operator is on approved leave', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      // Only mockEmployeeOnLeave exists in the system
      jest.spyOn(workforceCapacityRepository, 'findEmployees').mockResolvedValue([mockEmployeeOnLeave as any]);

      const res = await request(app)
        .post('/api/v1/workforce-capacity/evaluate-coverage')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          date: '2026-09-02T00:00:00.000Z',
          shift: 'SHIFT_1_MORNING',
          requiredSkills: ['SEALED_QUENCH_FURNACE_OPERATION'],
          requiredOperatorCount: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isSufficient).toBe(false);
      expect(res.body.data.shortageCount).toBe(1);
      expect(res.body.data.violations[0]).toContain('Operator shortage');
    });

    it('should identify unqualified operators lacking required pyrometry skill', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      // mockEmployeeOnLeave lacks METALLURGICAL_PYROMETRY_AMS2750
      jest.spyOn(workforceCapacityRepository, 'findEmployees').mockResolvedValue([
        { ...mockEmployeeOnLeave, approvedLeaves: [] } as any
      ]);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeAllocationsOnDate').mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/workforce-capacity/evaluate-coverage')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          date: '2026-09-02T00:00:00.000Z',
          shift: 'SHIFT_1_MORNING',
          requiredSkills: ['METALLURGICAL_PYROMETRY_AMS2750'],
          requiredOperatorCount: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isSufficient).toBe(false);
      expect(res.body.data.unqualifiedOperatorsInShift).toHaveLength(1);
      expect(res.body.data.unqualifiedOperatorsInShift[0].missingSkills).toContain('METALLURGICAL_PYROMETRY_AMS2750');
    });
  });

  describe('POST /api/v1/workforce-capacity/assign (Shift Assignment & Double-Booking Guards)', () => {
    it('should assign a qualified operator to a production shift', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);
      const auditSpy = jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockEmployee1 as any);
      jest.spyOn(workforceCapacityRepository, 'findEmployeeAllocationsOnDate').mockResolvedValue([]);
      jest.spyOn(workforceCapacityRepository, 'generateNextAllocationNumber').mockResolvedValue('WFA-202608-0001');

      const mockAllocation = {
        id: 'wfa_001',
        allocationNumber: 'WFA-202608-0001',
        employeeId: 'emp_001',
        employeeCode: 'EMP-OP-001',
        employeeName: 'Marcus Vance',
        shift: 'SHIFT_1_MORNING',
        allocatedHours: 8,
        status: 'ASSIGNED',
        toJSON: () => ({ allocationNumber: 'WFA-202608-0001', status: 'ASSIGNED' })
      };
      jest.spyOn(workforceCapacityRepository, 'createAllocation').mockResolvedValue(mockAllocation as any);

      const res = await request(app)
        .post('/api/v1/workforce-capacity/assign')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          employeeId: 'emp_001',
          date: '2026-09-01T00:00:00.000Z',
          shift: 'SHIFT_1_MORNING',
          allocatedHours: 8,
          requiredSkills: ['SEALED_QUENCH_FURNACE_OPERATION']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allocationNumber).toBe('WFA-202608-0001');
      expect(auditSpy).toHaveBeenCalled();
    });

    it('should prevent double-booking when operator is already assigned to the same shift', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockEmployee1 as any);
      // Already allocated on that shift!
      jest.spyOn(workforceCapacityRepository, 'findEmployeeAllocationsOnDate').mockResolvedValue([
        { allocationNumber: 'WFA-202608-0001', shift: 'SHIFT_1_MORNING' } as any
      ]);

      const res = await request(app)
        .post('/api/v1/workforce-capacity/assign')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          employeeId: 'emp_001',
          date: '2026-09-01T00:00:00.000Z',
          shift: 'SHIFT_1_MORNING',
          allocatedHours: 8
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Double-booking prevented');
    });

    it('should block assignment if operator lacks required skill certification', async () => {
      const plannerToken = generateToken('usr_planner', ['PLANT_MANAGER']);

      jest.spyOn(workforceCapacityRepository, 'findEmployeeById').mockResolvedValue(mockEmployee1 as any);

      const res = await request(app)
        .post('/api/v1/workforce-capacity/assign')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${plannerToken}`)
        .send({
          employeeId: 'emp_001',
          date: '2026-09-01T00:00:00.000Z',
          shift: 'SHIFT_1_MORNING',
          allocatedHours: 8,
          requiredSkills: ['VACUUM_FURNACE_OPERATION'] // Marcus doesn't have this!
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Operator qualification check failed');
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized user from creating workforce members', async () => {
      const operatorToken = generateToken('usr_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/workforce')
        .set('x-tenant-id', testTenant)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          employeeCode: 'EMP-HACK',
          fullName: 'Unauthorized Employee',
          department: 'Thermal Operations',
          designation: 'Operator'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
