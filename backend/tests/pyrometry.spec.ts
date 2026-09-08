import request from 'supertest';
import { createApp } from '../src/app.js';
import { pyrometryRepository } from '../src/modules/pyrometry/pyrometry.repository.js';
import { pyrometryService } from '../src/modules/pyrometry/pyrometry.service.js';
import { machineRepository } from '../src/modules/machine/machine.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/app.config.js';

function createAuthToken(
  userId: string,
  tenantId: string,
  roles: string[] = ['METALLURGICAL_ENGINEER', 'QUALITY_ENGINEER']
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

function createMockChannel(overrides: Record<string, any> = {}) {
  const defaultChannel = {
    _id: 'chan_001',
    id: 'chan_001',
    tenantId: 'tenant_test_1',
    channelId: 'TC-FURN-VAC-01-Z1-CTRL',
    machineId: 'mach_001',
    machineCode: 'FURN-VAC-01',
    furnaceZoneNumber: 1,
    channelType: 'CONTROL',
    thermocoupleType: 'TYPE_S',
    locationDescription: 'Zone 1 Top Hot Zone Control',
    sensorSerialNumber: 'SN-TC-2026-081',
    wireSpoolNumber: 'SPOOL-S-99.9',
    calibrationOffsetC: -0.4,
    correctionOffsets: [
      { setpointTempC: 500, rawReadingC: 500.4, correctedOffsetC: -0.4 },
      { setpointTempC: 950, rawReadingC: 950.5, correctedOffsetC: -0.5 },
      { setpointTempC: 1100, rawReadingC: 1100.6, correctedOffsetC: -0.6 }
    ],
    maxAllowedUsageCount: null,
    currentUsageCount: 5,
    calibratedAt: new Date('2026-06-01'),
    expiresAt: new Date('2027-06-01'),
    isCalibrated: true,
    isActive: true,
    notes: 'Primary control thermocouple zone 1',
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
  return defaultChannel;
}

function createMockCalibration(overrides: Record<string, any> = {}) {
  const defaultCal = {
    _id: 'cal_001',
    id: 'cal_001',
    tenantId: 'tenant_test_1',
    calibrationNumber: 'TUS-202608-0001',
    calibrationType: 'TUS_SURVEY',
    machineId: 'mach_001',
    machineCode: 'FURN-VAC-01',
    standardReference: 'AMS_2750G',
    status: 'DRAFT',
    calibratedBy: {
      userId: 'usr_pyro_01',
      email: 'pyro@astralis-testing.com',
      role: 'QUALITY_ENGINEER',
      technicianName: 'Marcus Vance'
    },
    masterStandardSerial: 'NIST-CAL-STD-998',
    masterStandardExpiry: new Date('2027-01-01'),
    testPoints: [],
    overallPassed: true,
    tusRecord: {
      furnaceClass: 'CLASS_2',
      operatingRangeMinC: 450,
      operatingRangeMaxC: 1150,
      surveyTemperatures: [
        {
          setpointC: 500,
          minObservedC: 497.5,
          maxObservedC: 502.1,
          uniformitySpreadC: 4.6,
          maxAllowedSpreadC: 6.0,
          durationMinutes: 60,
          passed: true
        },
        {
          setpointC: 950,
          minObservedC: 947.8,
          maxObservedC: 952.8,
          uniformitySpreadC: 5.0,
          maxAllowedSpreadC: 6.0,
          durationMinutes: 60,
          passed: true
        }
      ],
      surveySensorCount: 9,
      overallPassed: true,
      reportDocumentUrl: 'https://docs.astralis.internal/tus/tus-202608-0001.pdf'
    },
    satRecord: null,
    testDate: new Date('2026-08-01'),
    expiryDate: new Date('2026-11-01'), // 90-day TUS cycle
    approvedBy: null,
    certificateNumber: 'CERT-TUS-202608',
    notes: 'Quarterly AMS 2750G Class 2 survey',
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
  return defaultCal;
}

describe('Pyrometry & Calibration Subsystem (AMS 2750G / CQI-9)', () => {
  const app = createApp();
  const tenantId = 'tenant_test_1';
  const engineerId = 'usr_engineer_01';
  let engineerToken: string;

  const mockMachine = {
    _id: 'mach_001',
    id: 'mach_001',
    machineCode: 'FURN-VAC-01',
    name: 'Ipsen 2-Bar Vacuum Furnace',
    status: 'IDLE',
    tenantId,
    thermalLimits: {
      minOperatingTempC: 400,
      maxOperatingTempC: 1200,
      maxRampRateCPerMin: 15
    },
    capabilities: {
      supportedProcessFamilies: ['VACUUM_HEAT_TREATMENT'],
      furnaceClass: 'CLASS_2',
      instrumentationType: 'TYPE_A',
      pyrometryStandard: 'AMS_2750G'
    },
    pyrometryCompliance: {
      lastTusDate: new Date('2026-08-01'),
      nextTusDueDate: new Date('2026-11-01'),
      isTusValid: true,
      lastSatDate: new Date('2026-08-01'),
      nextSatDueDate: new Date('2026-09-01'),
      isSatValid: true
    },
    isDeleted: false,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    engineerToken = createAuthToken(engineerId, tenantId, ['METALLURGICAL_ENGINEER']);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: engineerId,
      roles: ['METALLURGICAL_ENGINEER'],
      permissions: [
        PERMISSIONS.QUALITY_PYROMETRY_VIEW,
        PERMISSIONS.QUALITY_PYROMETRY_CALIBRATE,
        PERMISSIONS.QUALITY_PYROMETRY_APPROVE_SAT,
        PERMISSIONS.QUALITY_PYROMETRY_APPROVE_TUS,
        PERMISSIONS.MACHINES_TELEMETRY_LOG,
        PERMISSIONS.MACHINES_FURNACE_VIEW
      ],
      isSuperAdmin: false
    });
  });

  describe('POST /api/v1/pyrometry/channels (Thermocouple Channel Registration)', () => {
    it('should register a control thermocouple channel with correction offsets', async () => {
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);
      jest.spyOn(pyrometryRepository, 'findChannelByChannelId').mockResolvedValue(null);

      const mockChannel = createMockChannel();
      jest.spyOn(pyrometryRepository, 'createChannel').mockResolvedValue(mockChannel as any);

      const res = await request(app)
        .post('/api/v1/pyrometry/channels')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          channelId: 'TC-FURN-VAC-01-Z1-CTRL',
          machineId: 'mach_001',
          furnaceZoneNumber: 1,
          channelType: 'CONTROL',
          thermocoupleType: 'TYPE_S',
          locationDescription: 'Zone 1 Top Hot Zone Control',
          sensorSerialNumber: 'SN-TC-2026-081',
          wireSpoolNumber: 'SPOOL-S-99.9',
          calibrationOffsetC: -0.4,
          correctionOffsets: [
            { setpointTempC: 500, rawReadingC: 500.4, correctedOffsetC: -0.4 },
            { setpointTempC: 950, rawReadingC: 950.5, correctedOffsetC: -0.5 }
          ],
          calibratedAt: '2026-06-01',
          expiresAt: '2027-06-01'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.channelId).toBe('TC-FURN-VAC-01-Z1-CTRL');
      expect(res.body.data.channelType).toBe('CONTROL');
      expect(res.body.data.correctionOffsets.length).toBe(3);
    });

    it('should reject duplicate channelId with 409 Conflict', async () => {
      const existing = createMockChannel();
      jest.spyOn(pyrometryRepository, 'findChannelByChannelId').mockResolvedValue(existing as any);

      const res = await request(app)
        .post('/api/v1/pyrometry/channels')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          channelId: 'TC-FURN-VAC-01-Z1-CTRL',
          machineId: 'mach_001',
          furnaceZoneNumber: 1,
          channelType: 'CONTROL',
          thermocoupleType: 'TYPE_S',
          locationDescription: 'Duplicate Channel',
          sensorSerialNumber: 'SN-001',
          calibratedAt: '2026-06-01',
          expiresAt: '2027-06-01'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('POST /api/v1/pyrometry/calibrations/tus & /approve (Temperature Uniformity Survey)', () => {
    it('should log a Class 2 TUS survey and evaluate uniformity spread within +/- 6C limit', async () => {
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);
      jest.spyOn(pyrometryRepository, 'generateNextCalibrationNumber').mockResolvedValue('TUS-202608-0001');

      const mockCal = createMockCalibration();
      jest.spyOn(pyrometryRepository, 'createCalibration').mockResolvedValue(mockCal as any);

      const res = await request(app)
        .post('/api/v1/pyrometry/calibrations/tus')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          machineId: 'mach_001',
          standardReference: 'AMS_2750G',
          technicianName: 'Marcus Vance',
          masterStandardSerial: 'NIST-CAL-STD-998',
          masterStandardExpiry: '2027-01-01',
          furnaceClass: 'CLASS_2',
          operatingRangeMinC: 450,
          operatingRangeMaxC: 1150,
          surveyTemperatures: [
            {
              setpointC: 500,
              minObservedC: 497.5,
              maxObservedC: 502.1,
              uniformitySpreadC: 4.6,
              maxAllowedSpreadC: 6.0,
              durationMinutes: 60,
              passed: true
            },
            {
              setpointC: 950,
              minObservedC: 947.8,
              maxObservedC: 952.8,
              uniformitySpreadC: 5.0,
              maxAllowedSpreadC: 6.0,
              durationMinutes: 60,
              passed: true
            }
          ],
          surveySensorCount: 9,
          testDate: '2026-08-01',
          expiryDate: '2026-11-01',
          certificateNumber: 'CERT-TUS-202608'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calibrationType).toBe('TUS_SURVEY');
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.overallPassed).toBe(true);
    });

    it('should formally approve TUS survey and update machine pyrometry compliance dates', async () => {
      const mockCal = createMockCalibration();
      jest.spyOn(pyrometryRepository, 'findCalibrationById').mockResolvedValue(mockCal as any);
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);

      const res = await request(app)
        .post('/api/v1/pyrometry/calibrations/cal_001/approve')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({ comments: 'AMS 2750G Class 2 compliance confirmed across 9-point array' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockCal.status).toBe('APPROVED');
      expect(mockCal.approvedBy).toBeDefined();
      expect(mockMachine.pyrometryCompliance.isTusValid).toBe(true);
      expect(mockMachine.save).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/pyrometry/calibrations/sat (System Accuracy Test)', () => {
    it('should log an SAT test comparing resident control sensor vs portable master standard', async () => {
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);
      jest.spyOn(pyrometryRepository, 'generateNextCalibrationNumber').mockResolvedValue('SAT-202608-0001');

      const mockSatCal = createMockCalibration({
        calibrationNumber: 'SAT-202608-0001',
        calibrationType: 'SAT_TEST',
        channelId: 'TC-FURN-VAC-01-Z1-CTRL',
        satRecord: {
          satMethod: 'COMPARISON_PORTABLE_STANDARD',
          targetSetpointC: 950,
          furnaceControlReadingC: 950.4,
          testStandardReadingC: 950.8,
          observedDifferenceC: 0.4,
          maxAllowedDifferenceC: 3.8, // 0.4% of 950°C
          passed: true
        }
      });
      jest.spyOn(pyrometryRepository, 'createCalibration').mockResolvedValue(mockSatCal as any);

      const res = await request(app)
        .post('/api/v1/pyrometry/calibrations/sat')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          machineId: 'mach_001',
          channelId: 'TC-FURN-VAC-01-Z1-CTRL',
          standardReference: 'AMS_2750G',
          technicianName: 'Marcus Vance',
          masterStandardSerial: 'NIST-PORTABLE-99',
          masterStandardExpiry: '2027-01-01',
          satMethod: 'COMPARISON_PORTABLE_STANDARD',
          targetSetpointC: 950,
          furnaceControlReadingC: 950.4,
          testStandardReadingC: 950.8,
          testDate: '2026-08-01',
          expiryDate: '2026-09-01'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.calibrationType).toBe('SAT_TEST');
      expect(res.body.data.overallPassed).toBe(true);
    });
  });

  describe('GET /api/v1/pyrometry/machines/:machineId/compliance-status', () => {
    it('should evaluate and return COMPLIANT when TUS, SAT, and control sensors are valid', async () => {
      const approvedTus = createMockCalibration({ status: 'APPROVED', expiryDate: new Date('2026-11-01') });
      const approvedSat = createMockCalibration({
        calibrationType: 'SAT_TEST',
        status: 'APPROVED',
        expiryDate: new Date('2026-10-01')
      });
      const validChannel = createMockChannel({ expiresAt: new Date('2027-06-01'), isCalibrated: true });

      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);
      jest
        .spyOn(pyrometryRepository, 'findLatestApprovedCalibration')
        .mockImplementation(async (_t, _m, type) => {
          if (type === 'TUS_SURVEY') return approvedTus as any;
          if (type === 'SAT_TEST') return approvedSat as any;
          return null;
        });
      jest.spyOn(pyrometryRepository, 'findChannelsByMachineId').mockResolvedValue([validChannel as any]);

      const res = await request(app)
        .get('/api/v1/pyrometry/machines/mach_001/compliance-status?targetTempC=950')
        .set('Authorization', `Bearer ${engineerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isCompliant).toBe(true);
      expect(res.body.data.overallAlertLevel).toBe('COMPLIANT');
      expect(res.body.data.tusStatus.isValid).toBe(true);
      expect(res.body.data.satStatus.isValid).toBe(true);
      expect(res.body.data.channelStatus.controlChannelsValid).toBe(true);
    });

    it('should flag NON_COMPLIANT when TUS is expired', async () => {
      const expiredTus = createMockCalibration({
        status: 'APPROVED',
        expiryDate: new Date('2026-07-01') // Expired
      });
      const approvedSat = createMockCalibration({
        calibrationType: 'SAT_TEST',
        status: 'APPROVED',
        expiryDate: new Date('2026-09-01')
      });
      const validChannel = createMockChannel();

      jest.spyOn(machineRepository, 'findById').mockResolvedValue({
        ...mockMachine,
        pyrometryCompliance: { ...mockMachine.pyrometryCompliance, nextTusDueDate: new Date('2026-07-01') }
      } as any);
      jest
        .spyOn(pyrometryRepository, 'findLatestApprovedCalibration')
        .mockImplementation(async (_t, _m, type) => {
          if (type === 'TUS_SURVEY') return expiredTus as any;
          if (type === 'SAT_TEST') return approvedSat as any;
          return null;
        });
      jest.spyOn(pyrometryRepository, 'findChannelsByMachineId').mockResolvedValue([validChannel as any]);

      const res = await request(app)
        .get('/api/v1/pyrometry/machines/mach_001/compliance-status')
        .set('Authorization', `Bearer ${engineerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isCompliant).toBe(false);
      expect(res.body.data.overallAlertLevel).toBe('TUS_OVERDUE');
      expect(res.body.data.alerts[0]).toContain('TUS) is OVERDUE');
    });

    it('should block production readiness gating when machine pyrometry is non-compliant', async () => {
      jest.spyOn(pyrometryService, 'evaluateMachineCompliance').mockResolvedValue({
        machineId: 'mach_001',
        machineCode: 'FURN-VAC-01',
        pyrometryStandard: 'AMS_2750G',
        furnaceClass: 'CLASS_2',
        instrumentationType: 'TYPE_A',
        isCompliant: false,
        overallAlertLevel: 'TUS_OVERDUE',
        tusStatus: { isValid: false },
        satStatus: { isValid: true },
        channelStatus: { totalChannels: 1, controlChannelsValid: true, overtempChannelsValid: true, expiredChannels: [] },
        alerts: ['TUS is OVERDUE']
      });

      await expect(
        pyrometryService.validateMachinePyrometryReadiness(tenantId, 'mach_001', 950)
      ).rejects.toThrow('failed Pyrometry Compliance Readiness');
    });
  });

  describe('POST /api/v1/pyrometry/telemetry (Real-time Telemetry & Excursions)', () => {
    it('should record telemetry with corrected sensor offsets and detect overtemperature excursion', async () => {
      const channel = createMockChannel({ channelId: 'TC-01', calibrationOffsetC: -0.5 });
      jest.spyOn(machineRepository, 'findById').mockResolvedValue(mockMachine as any);
      jest.spyOn(pyrometryRepository, 'findChannelsByMachineId').mockResolvedValue([channel as any]);

      const mockSample = {
        id: 'tel_001',
        machineId: 'mach_001',
        machineCode: 'FURN-VAC-01',
        isExcursionAlert: true,
        channelReadings: [{ channelId: 'TC-01', rawReadingC: 1220, correctedReadingC: 1219.5, isOvertempAlert: true }]
      };
      jest.spyOn(pyrometryRepository, 'createTelemetrySample').mockResolvedValue(mockSample as any);

      const res = await request(app)
        .post('/api/v1/pyrometry/telemetry')
        .set('Authorization', `Bearer ${engineerToken}`)
        .send({
          machineId: 'mach_001',
          jobId: 'job_001',
          jobNumber: 'JOB-202608-0001',
          channelReadings: [{ channelId: 'TC-01', setpointC: 950, rawReadingC: 1220 }],
          vacuumLevelMbar: 0.0002
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isExcursionAlert).toBe(true);
    });
  });
});
