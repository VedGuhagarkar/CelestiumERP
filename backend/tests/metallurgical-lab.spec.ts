import request from 'supertest';
import { createApp } from '../src/app.js';
import { qualityInspectionRepository } from '../src/modules/quality-inspection/quality-inspection.repository.js';
import { metallurgicalLabRepository } from '../src/modules/metallurgical-lab/metallurgical-lab.repository.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { PERMISSIONS } from '../src/modules/rbac/rbac.constants.js';
import { rbacService } from '../src/modules/rbac/rbac.service.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/app.config.js';

function createAuthToken(
  userId: string,
  tenantId: string,
  roles: string[] = ['METALLURGIST']
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

function createMockLabRecordDocument(overrides: Record<string, any> = {}) {
  const defaultDoc = {
    _id: 'lab_rec_001',
    id: 'lab_rec_001',
    tenantId: 'tenant_test_1',
    recordNumber: 'LAB-202608-0001',
    inspectionId: 'insp_test_001',
    inspectionNumber: 'INSP-202608-0001',
    jobId: 'job_test_001',
    jobNumber: 'JOB-202608-0001',
    heatLotNumber: 'HL-2026-0811',
    materialGrade: 'AISI 9310',
    status: 'DRAFT',
    hardnessMeasurements: [],
    hardnessTraverses: [],
    microstructureObservations: [],
    lockedAt: null,
    lockedBy: null,
    lockReason: null,
    revision: 1,
    auditHistory: [],
    notes: null,
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
  return defaultDoc;
}

describe('Metallurgical Laboratory Measurement & Data Layer', () => {
  const app = createApp();
  const tenantId = 'tenant_test_1';
  const metallurgistId = 'usr_metallurgist_01';
  let metallurgistToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    metallurgistToken = createAuthToken(metallurgistId, tenantId, ['METALLURGIST']);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: metallurgistId,
      roles: ['METALLURGIST'],
      permissions: [
        PERMISSIONS.QUALITY_INSPECTION_RECORD,
        PERMISSIONS.QUALITY_INSPECTION_VIEW,
        PERMISSIONS.QUALITY_COC_APPROVE,
        PERMISSIONS.QUALITY_DISPOSITION_MANAGE
      ],
      isSuperAdmin: false
    });
  });

  describe('POST /api/v1/metallurgical-lab (Record Creation)', () => {
    it('should create a laboratory test record linked to quality inspection and job', async () => {
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue({
        id: 'insp_test_001',
        inspectionNumber: 'INSP-202608-0001',
        jobId: 'job_test_001',
        jobNumber: 'JOB-202608-0001',
        status: 'IN_REVIEW',
        item: { materialGrade: 'AISI 9310' },
        heatLots: [{ heatLotNumber: 'HL-2026-0811' }]
      } as any);

      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'generateNextRecordNumber').mockResolvedValue('LAB-202608-0001');
      jest.spyOn(metallurgicalLabRepository, 'create').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/metallurgical-lab')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          inspectionId: 'insp_test_001',
          notes: 'Standard metallurgical test piece from furnace charge'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recordNumber).toBe('LAB-202608-0001');
      expect(res.body.data.materialGrade).toBe('AISI 9310');
      expect(res.body.data.status).toBe('DRAFT');
    });

    it('should reject creation if quality inspection is not found', async () => {
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/metallurgical-lab')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          inspectionId: 'insp_non_existent'
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('should block creation if quality inspection is already APPROVED', async () => {
      jest.spyOn(qualityInspectionRepository, 'findById').mockResolvedValue({
        id: 'insp_approved',
        inspectionNumber: 'INSP-202608-0002',
        status: 'APPROVED'
      } as any);

      const res = await request(app)
        .post('/api/v1/metallurgical-lab')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          inspectionId: 'insp_approved'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already APPROVED');
    });
  });

  describe('POST /api/v1/metallurgical-lab/:id/hardness (Multi-Scale Hardness)', () => {
    it('should record Rockwell C (HRC) multi-point survey and compute average and tolerance evaluation', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/hardness')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'SPECIMEN-A1',
          location: 'SURFACE',
          scale: 'HRC',
          readings: [60.2, 60.5, 60.8, 60.5],
          targetMin: 58.0,
          targetMax: 62.0,
          testEquipmentCode: 'ROCKWELL-TESTER-01',
          calibrationDueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          notes: 'Surface survey at 90 deg quadrants'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDoc.hardnessMeasurements).toHaveLength(1);
      expect(mockDoc.hardnessMeasurements[0].averageValue).toBe(60.5);
      expect(mockDoc.hardnessMeasurements[0].scale).toBe('HRC');
      expect(mockDoc.hardnessMeasurements[0].passed).toBe(true);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('should record Rockwell B (HRB), Rockwell A (HRA), Vickers (HV), and Brinell (HBW)', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'findById').mockResolvedValue(mockDoc as any);

      // 1. HRB
      await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/hardness')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'SPECIMEN-B1',
          location: 'CORE',
          scale: 'HRB',
          readings: [88.5, 89.0, 88.0]
        });

      // 2. HRA
      await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/hardness')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'SPECIMEN-B1',
          location: 'SURFACE',
          scale: 'HRA',
          readings: [82.0, 82.5]
        });

      // 3. HV
      await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/hardness')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'SPECIMEN-B1',
          location: 'CASE',
          scale: 'HV',
          readings: [720, 725, 730]
        });

      // 4. HBW
      await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/hardness')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'SPECIMEN-B1',
          location: 'CORE',
          scale: 'HBW',
          readings: [310, 315]
        });

      expect(mockDoc.hardnessMeasurements).toHaveLength(4);
      expect(mockDoc.hardnessMeasurements.map((m: any) => m.scale)).toEqual(['HRB', 'HRA', 'HV', 'HBW']);
    });

    it('should reject hardness readings that violate ASTM physical limits', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'findById').mockResolvedValue(mockDoc as any);

      // HRC scale max is 70
      const res = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/hardness')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'SPECIMEN-INVALID',
          location: 'SURFACE',
          scale: 'HRC',
          readings: [85.0] // Invalid!
        });

      expect(res.status).toBe(422);
      expect(JSON.stringify(res.body)).toContain('ASTM scale limits');
    });
  });

  describe('POST /api/v1/metallurgical-lab/:id/traverse (Depth vs Hardness & Effective Case Depth)', () => {
    it('should calculate Effective Case Depth (ECD) using exact linear interpolation across traverse points', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'findById').mockResolvedValue(mockDoc as any);

      // Points crossing 550 HV cutoff between depth 0.80mm (580 HV) and 1.00mm (500 HV)
      // Interpolation: 0.80 + ((550 - 580) / (500 - 580)) * (1.00 - 0.80)
      // = 0.80 + (-30 / -80) * 0.20 = 0.80 + 0.375 * 0.20 = 0.80 + 0.075 = 0.875 mm
      const res = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/traverse')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'GEAR-TOOTH-PITCH-01',
          location: 'PITCH_LINE',
          scale: 'HV',
          load: 'HV0.5',
          cutoffHardness: 550,
          coreHardnessBaseline: 340,
          targetCaseDepthMinMm: 0.75,
          targetCaseDepthMaxMm: 1.00,
          points: [
            { depthMm: 0.10, measuredHardness: 760 },
            { depthMm: 0.30, measuredHardness: 740 },
            { depthMm: 0.50, measuredHardness: 700 },
            { depthMm: 0.80, measuredHardness: 580 },
            { depthMm: 1.00, measuredHardness: 500 },
            { depthMm: 1.20, measuredHardness: 420 },
            { depthMm: 1.50, measuredHardness: 340 }
          ],
          testEquipmentCode: 'MICROHARDNESS-STATION-3',
          notes: 'Traverse along normal from pitch surface to tooth center'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDoc.hardnessTraverses).toHaveLength(1);
      const trav = mockDoc.hardnessTraverses[0];
      expect(trav.calculatedEffectiveCaseDepthMm).toBe(0.875);
      expect(trav.calculatedTotalCaseDepthMm).toBe(1.50);
      expect(trav.passed).toBe(true);
      expect(trav.load).toBe('HV0.5');
    });

    it('should reject traverse if less than 3 points are provided', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/traverse')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'SAMPLE-FEW-PTS',
          location: 'CASE',
          scale: 'HV',
          cutoffHardness: 550,
          points: [
            { depthMm: 0.1, measuredHardness: 700 },
            { depthMm: 0.2, measuredHardness: 600 }
          ]
        });

      expect(res.status).toBe(422);
      expect(JSON.stringify(res.body)).toContain('At least 3 traverse points are required');
    });
  });

  describe('POST /api/v1/metallurgical-lab/:id/microstructure (Microstructural Observations)', () => {
    it('should record comprehensive metallurgical microstructure observations and evaluate compliance', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'findById').mockResolvedValue(mockDoc as any);

      const res = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/microstructure')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'MET-SPEC-01',
          location: 'CASE',
          magnification: 500,
          matrixStructure: 'Tempered Martensite with fine, well-dispersed carbides',
          retainedAustenite: {
            measuredPercent: 6.2,
            testMethod: 'XRD',
            acceptableMaxPercent: 10.0
          },
          grainSize: {
            astmNumber: 8,
            method: 'INTERCEPT',
            targetMin: 6,
            targetMax: 10
          },
          decarburization: {
            type: 'NONE',
            totalDecarbDepthMm: 0.0,
            maxAllowedDepthMm: 0.05
          },
          carbideMorphology: {
            rating: 'TYPE_A_FINE',
            networkPresent: false,
            grainBoundaryPrecipitation: false,
            description: 'No continuous carbide networks observed'
          },
          micrographPhotoUrls: ['https://storage.astralis.internal/micro/spec-01-500x.png'],
          notes: 'Nital 2% etchant used. Specimen meets aerospace AMS 2759 criteria.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDoc.microstructureObservations).toHaveLength(1);
      const obs = mockDoc.microstructureObservations[0];
      expect(obs.retainedAustenite.passed).toBe(true);
      expect(obs.grainSize.passed).toBe(true);
      expect(obs.decarburization.passed).toBe(true);
      expect(obs.carbideMorphology.passed).toBe(true);
    });

    it('should reject invalid microstructure parameters exceeding physical bounds', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'findById').mockResolvedValue(mockDoc as any);

      // Retained austenite cannot exceed 100%
      const res = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/microstructure')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'MET-SPEC-02',
          location: 'CASE',
          magnification: 500,
          matrixStructure: 'Martensite',
          retainedAustenite: {
            measuredPercent: 110.0, // Invalid!
            testMethod: 'XRD'
          }
        });

      expect(res.status).toBe(422);
      expect(JSON.stringify(res.body)).toContain('Retained austenite percent cannot exceed 100%');
    });
  });

  describe('POST /api/v1/metallurgical-lab/:id/lock (Record Locking & Immutability)', () => {
    it('should lock laboratory record and prevent subsequent modifications', async () => {
      const mockDoc = createMockLabRecordDocument({
        hardnessMeasurements: [{ measurementId: 'h1', averageValue: 60.5 }]
      });
      jest.spyOn(metallurgicalLabRepository, 'findById').mockResolvedValue(mockDoc as any);

      // 1. Lock the record
      const lockRes = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/lock')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          lockReason: 'Metallurgical test signoff complete for CoC generation'
        });

      expect(lockRes.status).toBe(200);
      expect(mockDoc.status).toBe('LOCKED');
      expect(mockDoc.lockReason).toBe('Metallurgical test signoff complete for CoC generation');
      expect(mockDoc.revision).toBe(2);

      // 2. Attempt to add measurement on locked record -> Must be blocked!
      const addRes = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/hardness')
        .set('Authorization', `Bearer ${metallurgistToken}`)
        .send({
          sampleTag: 'SPECIMEN-LOCKED',
          location: 'SURFACE',
          scale: 'HRC',
          readings: [60.0]
        });

      expect(addRes.status).toBe(400);
      expect(addRes.body.message).toContain('is LOCKED and cannot be modified');
    });
  });

  describe('GET /api/v1/metallurgical-lab (Query & Retrieval)', () => {
    it('should retrieve lab records by inspection ID', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'findByInspectionId').mockResolvedValue([mockDoc as any]);

      const res = await request(app)
        .get('/api/v1/metallurgical-lab/by-inspection/insp_test_001')
        .set('Authorization', `Bearer ${metallurgistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should query paginated lab test records with filters', async () => {
      const mockDoc = createMockLabRecordDocument();
      jest.spyOn(metallurgicalLabRepository, 'queryRecords').mockResolvedValue({
        items: [mockDoc as any],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/metallurgical-lab?status=DRAFT&heatLotNumber=HL-2026-0811')
        .set('Authorization', `Bearer ${metallurgistToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('RBAC Permission Checks', () => {
    it('should block user lacking QUALITY_INSPECTION_RECORD from adding measurements', async () => {
      const operatorToken = createAuthToken('usr_operator_01', tenantId, ['FURNACE_OPERATOR']);

      jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
        tenantId,
        userId: 'usr_operator_01',
        roles: ['FURNACE_OPERATOR'],
        permissions: ['PRODUCTION_EXECUTE'],
        isSuperAdmin: false
      });

      const res = await request(app)
        .post('/api/v1/metallurgical-lab/lab_rec_001/hardness')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          sampleTag: 'SPECIMEN-OP',
          location: 'SURFACE',
          scale: 'HRC',
          readings: [60.0]
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
