import request from 'supertest';
import { createApp } from '../src/app.js';
import { machineRepository } from '../src/modules/machine/machine.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/app.config.js';

function createAuthToken(
  userId: string,
  tenantId: string,
  roles: string[] = ['FACTORY_ENGINEER']
): string {
  return jwt.sign(
    {
      userId,
      tenantId,
      email: `${userId.toLowerCase()}@astralis-testing.com`,
      roles
    },
    config.auth.jwtSecret,
    { expiresIn: '1h' }
  );
}

function createMockMachine(overrides: Record<string, any> = {}) {
  const defaultMachine = {
    _id: 'mach_test_001',
    id: 'mach_test_001',
    tenantId: 'tenant_test_1',
    machineCode: 'FURN-VAC-01',
    name: 'Ipsen 2-Bar Vacuum Furnace 10-Bar N2 Quench',
    category: 'FURNACE_VACUUM',
    status: 'IDLE',
    technicalSpecs: {
      manufacturer: 'Ipsen International',
      modelNumber: 'TurboTreater VTS-524',
      serialNumber: 'SN-IPS-2022-9981',
      yearOfManufacture: 2022,
      commissioningDate: new Date('2022-06-15'),
      heatingSource: 'ELECTRIC_RESISTANCE',
      maxPowerKw: 150,
      atmosphereTypes: ['VACUUM', 'NITROGEN', 'ARGON'],
      quenchMedia: ['GAS_HIGH_PRESSURE_N2']
    },
    thermalLimits: {
      minOperatingTempC: 300,
      maxOperatingTempC: 1350,
      uniformOperatingMinC: 450,
      uniformOperatingMaxC: 1250,
      maxHeatingRateCPerMin: 25,
      maxCoolingRateCPerMin: 50,
      temperatureUniformityToleranceC: 6
    },
    workingDimensions: {
      lengthMm: 1200,
      widthMm: 900,
      heightMm: 900,
      usableVolumeM3: 0.972,
      maxLoadWeightKg: 1000
    },
    location: {
      plant: 'Plant 1 - Aerospace Thermal',
      building: 'Bay 4',
      bay: 'BAY-04-NORTH',
      cell: 'CELL-VAC-01',
      coordinates: 'X:12, Y:44'
    },
    capabilities: {
      supportedProcessFamilies: [
        'VACUUM_HEAT_TREATMENT',
        'HARDENING_TEMPERING',
        'SOLUTION_AGEING',
        'ANNEALING',
        'STRESS_RELIEF'
      ],
      furnaceClass: 'CLASS_2',
      instrumentationType: 'TYPE_B',
      pyrometryStandard: 'AMS_2750G',
      hasAgitationControl: true,
      maxQuenchWeightKg: 1000
    },
    pyrometryCompliance: {
      lastTusDate: new Date('2026-06-01'),
      nextTusDueDate: new Date('2026-12-01'),
      lastSatDate: new Date('2026-07-01'),
      nextSatDueDate: new Date('2026-10-01'),
      isTusValid: true,
      isSatValid: true
    },
    currentJob: null,
    statusHistory: [
      {
        fromStatus: 'IDLE',
        toStatus: 'IDLE',
        changedAt: new Date(),
        changedBy: {
          userId: 'usr_eng_01',
          email: 'engineer@astralis.internal',
          role: 'FACTORY_ENGINEER'
        },
        reason: 'Initial equipment commissioning registration'
      }
    ],
    notes: [],
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    toJSON: jest.fn().mockImplementation(function () {
      const { save, toJSON, ...rest } = this;
      return rest;
    }),
    ...overrides
  };
  return defaultMachine;
}

describe('Machine & Equipment Subsystem', () => {
  const app = createApp();
  const tenantId = 'tenant_test_1';
  const engineerId = 'usr_eng_01';
  let engineerToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    engineerToken = createAuthToken(engineerId, tenantId, ['FACTORY_ENGINEER']);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: engineerId,
      roles: ['FACTORY_ENGINEER'],
      permissions: [
        PERMISSIONS.MACHINES_FURNACE_VIEW,
        PERMISSIONS.MACHINES_FURNACE_OPERATE,
        PERMISSIONS.MACHINES_FURNACE_CONFIGURE,
        PERMISSIONS.MACHINES_TELEMETRY_VIEW,
        PERMISSIONS.MACHINES_TELEMETRY_LOG
      ],
      isSuperAdmin: false
    });
  });

  describe('POST /api/v1/machines (Equipment Registration)', () => {
    it('should register a new vacuum furnace with full technical specifications and AMS 2750G pyrometry class', async () => {
      jest.spyOn(machineRepository, 'findByCode').mockResolvedValue(null);

      const mockMachine = createMockMachine();
      jest.spyOn(machineRepository, 'create').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/machines')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          machineCode: 'FURN-VAC-01',
          name: 'Ipsen 2-Bar Vacuum Furnace 10-Bar N2 Quench',
          category: 'FURNACE_VACUUM',
          technicalSpecs: {
            manufacturer: 'Ipsen International',
            modelNumber: 'TurboTreater VTS-524',
            serialNumber: 'SN-IPS-2022-9981',
            yearOfManufacture: 2022,
            heatingSource: 'ELECTRIC_RESISTANCE',
            maxPowerKw: 150,
            atmosphereTypes: ['VACUUM', 'NITROGEN', 'ARGON'],
            quenchMedia: ['GAS_HIGH_PRESSURE_N2']
          },
          thermalLimits: {
            minOperatingTempC: 300,
            maxOperatingTempC: 1350,
            uniformOperatingMinC: 450,
            uniformOperatingMaxC: 1250,
            maxHeatingRateCPerMin: 25,
            maxCoolingRateCPerMin: 50,
            temperatureUniformityToleranceC: 6
          },
          workingDimensions: {
            lengthMm: 1200,
            widthMm: 900,
            heightMm: 900,
            usableVolumeM3: 0.972,
            maxLoadWeightKg: 1000
          },
          location: {
            plant: 'Plant 1 - Aerospace Thermal',
            building: 'Bay 4',
            bay: 'BAY-04-NORTH',
            cell: 'CELL-VAC-01'
          },
          capabilities: {
            supportedProcessFamilies: [
              'VACUUM_HEAT_TREATMENT',
              'HARDENING_TEMPERING',
              'SOLUTION_AGEING'
            ],
            furnaceClass: 'CLASS_2',
            instrumentationType: 'TYPE_B',
            pyrometryStandard: 'AMS_2750G'
          },
          initialNote: 'Commissioned per AMS 2750G Class 2 pyrometry standards'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.machineCode).toBe('FURN-VAC-01');
      expect(res.body.data.status).toBe('IDLE');
      expect(res.body.data.capabilities.furnaceClass).toBe('CLASS_2');
      expect(res.body.data.workingDimensions.maxLoadWeightKg).toBe(1000);
      expect(res.body.data.thermalLimits.maxOperatingTempC).toBe(1350);
    });

    it('should reject machine registration with duplicate machine code with 409 Conflict', async () => {
      const existing = createMockMachine();
      jest.spyOn(machineRepository, 'findByCode').mockResolvedValue(existing as any);

      const res = await request(app)
        .post('/api/v1/machines')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          machineCode: 'FURN-VAC-01',
          name: 'Duplicate Vacuum Furnace',
          category: 'FURNACE_VACUUM',
          technicalSpecs: {
            manufacturer: 'Ipsen',
            modelNumber: 'VTS-524',
            serialNumber: 'SN-001',
            heatingSource: 'ELECTRIC_RESISTANCE',
            maxPowerKw: 150,
            atmosphereTypes: ['VACUUM'],
            quenchMedia: ['GAS_HIGH_PRESSURE_N2']
          },
          thermalLimits: {
            minOperatingTempC: 300,
            maxOperatingTempC: 1350,
            uniformOperatingMinC: 450,
            uniformOperatingMaxC: 1250
          },
          workingDimensions: {
            lengthMm: 1200,
            widthMm: 900,
            heightMm: 900,
            usableVolumeM3: 0.972,
            maxLoadWeightKg: 1000
          },
          location: {
            plant: 'Plant 1',
            building: 'Bay 4',
            bay: 'BAY-04'
          },
          capabilities: {
            supportedProcessFamilies: ['VACUUM_HEAT_TREATMENT'],
            furnaceClass: 'CLASS_2',
            instrumentationType: 'TYPE_B',
            pyrometryStandard: 'AMS_2750G'
          }
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject invalid thermal limits where minTemp > maxTemp with 400 Bad Request', async () => {
      jest.spyOn(machineRepository, 'findByCode').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/machines')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          machineCode: 'FURN-BAD-01',
          name: 'Bad Temp Furnace',
          category: 'FURNACE_BOX',
          technicalSpecs: {
            manufacturer: 'Thermcraft',
            modelNumber: 'BOX-100',
            serialNumber: 'SN-002',
            heatingSource: 'ELECTRIC_RESISTANCE',
            maxPowerKw: 50,
            atmosphereTypes: ['AIR'],
            quenchMedia: ['NONE']
          },
          thermalLimits: {
            minOperatingTempC: 1000,
            maxOperatingTempC: 500, // Invalid!
            uniformOperatingMinC: 1000,
            uniformOperatingMaxC: 500
          },
          workingDimensions: {
            lengthMm: 500,
            widthMm: 500,
            heightMm: 500,
            usableVolumeM3: 0.125,
            maxLoadWeightKg: 200
          },
          location: {
            plant: 'Plant 1',
            building: 'Bay 1',
            bay: 'BAY-01'
          },
          capabilities: {
            supportedProcessFamilies: ['ANNEALING'],
            furnaceClass: 'CLASS_4',
            instrumentationType: 'TYPE_D',
            pyrometryStandard: 'STANDARD'
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot exceed maxOperatingTempC');
    });
  });

  describe('POST /api/v1/machines/:id/status (Operational State Machine)', () => {
    it('should transition machine from IDLE to RUNNING with active job assignment', async () => {
      const mockMachine = createMockMachine({ status: 'IDLE' });
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/machines/mach_test_001/status')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          status: 'RUNNING',
          jobId: 'job_001',
          jobNumber: 'JOB-202608-0001',
          reason: 'Started carburizing batch cycle'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMachine.status).toBe('RUNNING');
      expect(mockMachine.currentJob.jobNumber).toBe('JOB-202608-0001');
      expect(mockMachine.statusHistory.length).toBe(2);
      expect(mockMachine.save).toHaveBeenCalled();
    });

    it('should transition machine from IDLE to BREAKDOWN and log audit event', async () => {
      const mockMachine = createMockMachine({ status: 'IDLE' });
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/machines/mach_test_001/status')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          status: 'BREAKDOWN',
          reason: 'Heating element zone 2 open circuit fault',
          workOrderId: 'WO-MAINT-8812'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMachine.status).toBe('BREAKDOWN');
      expect(mockMachine.save).toHaveBeenCalled();
    });

    it('should reject invalid transition from BREAKDOWN directly to RUNNING without maintenance', async () => {
      const mockMachine = createMockMachine({ status: 'BREAKDOWN' });
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/machines/mach_test_001/status')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          status: 'RUNNING',
          jobId: 'job_002',
          jobNumber: 'JOB-202608-0002'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid machine state transition');
      expect(res.body.message).toContain('BREAKDOWN');
    });

    it('should reject invalid transition from RUNNING directly to MAINTENANCE while actively processing', async () => {
      const mockMachine = createMockMachine({ status: 'RUNNING' });
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/machines/mach_test_001/status')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          status: 'MAINTENANCE',
          reason: 'Scheduled oil filter change'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot start scheduled maintenance while machine is actively RUNNING');
    });
  });

  describe('GET /api/v1/machines/capabilities/search (Capability Queries)', () => {
    it('should query machines matching process family and temperature capability criteria', async () => {
      const mockMachine = createMockMachine();
      jest.spyOn(machineRepository, 'findCapableMachines').mockResolvedValue([mockMachine as any]);

      const res = await request(app)
        .get('/api/v1/machines/capabilities/search')
        .set('Authorization', `Bearer ${engineerToken}`)
        .query({
          processFamily: 'VACUUM_HEAT_TREATMENT',
          targetTemperatureC: '950',
          requiredLoadWeightKg: '500',
          status: 'IDLE'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].machineCode).toBe('FURN-VAC-01');
    });
  });

  describe('GET /api/v1/machines/summary/fleet (Fleet Health Aggregation)', () => {
    it('should aggregate machine status counts, load capacities, and pyrometry health', async () => {
      const mockSummary = {
        totalMachines: 6,
        statusCounts: {
          IDLE: 3,
          RUNNING: 2,
          MAINTENANCE: 1,
          BREAKDOWN: 0,
          OFFLINE: 0,
          CALIBRATING: 0
        },
        categoryCounts: {
          FURNACE_VACUUM: 2,
          FURNACE_ATMOSPHERE_SEALED_QUENCH: 2,
          QUENCH_TANK: 1,
          TEMPERING_OVEN: 1,
          FURNACE_PIT: 0,
          FURNACE_BOX: 0,
          FURNACE_CONTINUOUS_BELT: 0,
          FURNACE_INDUCTION: 0,
          CRYOGENIC_CHAMBER: 0,
          WASHING_LINE: 0,
          SHOT_BLASTER: 0,
          STRAIGHTENING_PRESS: 0,
          AUXILIARY_EQUIPMENT: 0
        },
        totalLoadCapacityKg: 6500,
        fleetAvailabilityPercent: 83.3,
        pyrometryCompliance: {
          compliantCount: 5,
          overdueCount: 1
        }
      };

      jest.spyOn(machineRepository, 'getFleetSummary').mockResolvedValue(mockSummary);

      const res = await request(app)
        .get('/api/v1/machines/summary/fleet')
        .set('Authorization', `Bearer ${engineerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalMachines).toBe(6);
      expect(res.body.data.statusCounts.RUNNING).toBe(2);
      expect(res.body.data.fleetAvailabilityPercent).toBe(83.3);
      expect(res.body.data.totalLoadCapacityKg).toBe(6500);
    });
  });

  describe('POST /api/v1/machines/:id/notes (Machine Operational Notes)', () => {
    it('should add operational notes to machine log', async () => {
      const mockMachine = createMockMachine();
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/machines/mach_test_001/notes')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          content: 'Shift handover: Replaced thermocouple probe on port 3. Temperature reading steady at 22°C ambient.',
          category: 'HANDOVER'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockMachine.notes.length).toBe(1);
      expect(mockMachine.notes[0].category).toBe('HANDOVER');
      expect(mockMachine.save).toHaveBeenCalled();
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized viewers from changing machine configuration', async () => {
      const viewerToken = createAuthToken('usr_viewer_01', tenantId, ['GUEST_VIEWER']);

      jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
        tenantId,
        userId: 'usr_viewer_01',
        roles: ['GUEST_VIEWER'],
        permissions: [PERMISSIONS.MACHINES_FURNACE_VIEW],
        isSuperAdmin: false
      });

      const res = await request(app)
        .post('/api/v1/machines')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          machineCode: 'FURN-UNAUTH-01',
          name: 'Unauthorized Furnace',
          category: 'FURNACE_BOX'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
