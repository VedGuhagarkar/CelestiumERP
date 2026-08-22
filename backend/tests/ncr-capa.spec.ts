import request from 'supertest';
import { createApp } from '../src/app.js';
import { ncrCapaRepository } from '../src/modules/ncr-capa/ncr-capa.repository.js';
import { productionJobRepository } from '../src/modules/production-job/production-job.repository.js';
import { qualityInspectionRepository } from '../src/modules/quality-inspection/quality-inspection.repository.js';
import { heatLotRepository } from '../src/modules/traceability/heat-lot.repository.js';
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

function createMockNcrDocument(overrides: Record<string, any> = {}) {
  const defaultDoc = {
    _id: 'ncr_test_001',
    id: 'ncr_test_001',
    tenantId: 'tenant_test_1',
    ncrNumber: 'NCR-202608-0001',
    status: 'OPEN',
    inspectionId: 'insp_001',
    inspectionNumber: 'INSP-202608-0001',
    jobId: 'job_001',
    jobNumber: 'JOB-202608-0001',
    planId: 'plan_001',
    planNumber: 'PLAN-202608-0001',
    customer: {
      customerId: 'cust_001',
      customerCode: 'BOEING',
      customerName: 'Boeing Commercial Airplanes'
    },
    item: {
      itemId: 'item_9310',
      itemCode: 'MAT-9310-PINION',
      itemName: 'Sun Pinion Gear AISI 9310',
      materialGrade: 'AISI 9310',
      uom: 'PCS'
    },
    heatLots: [
      {
        heatLotId: 'hl_001',
        heatLotNumber: 'HL-202608-9310-A',
        quantity: 250,
        uom: 'PCS'
      }
    ],
    processFamily: 'CARBURIZING',
    defectType: 'HARDNESS_OUT_OF_TOLERANCE',
    defectSeverity: 'MAJOR',
    defectDescription: 'Surface hardness below minimum specification limit (56 HRC vs 60-64 HRC target)',
    defectLocations: ['PITCH_LINE', 'TOOTH_FLANK'],
    affectedQuantity: {
      totalAffectedQuantity: 250,
      rejectedQuantity: 250,
      scrappedQuantity: 0,
      reworkedQuantity: 0,
      uom: 'PCS'
    },
    evidence: [
      {
        evidenceId: 'EVD-1',
        title: 'Traverse Hardness Survey Profile',
        evidenceType: 'HARDNESS_REPORT',
        fileUrl: 'https://docs.astralis.internal/lab/surveys/EVD-001.pdf',
        description: 'Microhardness profile showing deficient case carbon',
        uploadedAt: new Date(),
        uploadedBy: { userId: 'usr_qe_01', email: 'qe@astralis.internal', role: 'METALLURGIST' }
      }
    ],
    containment: {
      containmentAction: 'Quarantined charge in Bay Q-4. Placed companion lot on hold.',
      isQuarantined: true,
      quarantineId: 'qr_001',
      quarantineNumber: 'QR-202608-1001',
      quarantineBay: 'BAY_Q4',
      quarantineStatus: 'ACTIVE',
      containedAt: new Date(),
      containedBy: { userId: 'usr_qe_01', email: 'qe@astralis.internal', role: 'METALLURGIST' }
    },
    rootCause: null,
    disposition: null,
    requiresCapa: true,
    capaIds: [],
    capaNumbers: [],
    raisedAt: new Date(),
    raisedBy: { userId: 'usr_qe_01', email: 'qe@astralis.internal', role: 'METALLURGIST' },
    closedAt: null,
    closedBy: null,
    transitionHistory: [
      {
        fromStatus: 'OPEN',
        toStatus: 'OPEN',
        timestamp: new Date(),
        performedBy: { userId: 'usr_qe_01', email: 'qe@astralis.internal', role: 'METALLURGIST' },
        reason: 'NCR raised for low surface hardness'
      }
    ],
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

function createMockCapaDocument(overrides: Record<string, any> = {}) {
  const defaultDoc = {
    _id: 'capa_test_001',
    id: 'capa_test_001',
    tenantId: 'tenant_test_1',
    capaNumber: 'CAPA-202608-0001',
    ncrId: 'ncr_test_001',
    ncrNumber: 'NCR-202608-0001',
    type: 'CORRECTIVE_AND_PREVENTIVE',
    status: 'IN_PROGRESS',
    title: 'Correction of Atmosphere Carbon Potential Depletion in Furnace F-02',
    problemStatement: 'Atmosphere %C dropped during soak stage due to oxygen probe reference air blockage',
    rootCauseSummary: 'Oxygen probe reference air line clogged with carbon soot',
    actionItems: [
      {
        itemNumber: 1,
        actionType: 'MAINTENANCE_OVERHAUL',
        description: 'Clean and purge oxygen probe reference air delivery system on Furnace F-02',
        assignedTo: { userId: 'usr_maint_01', email: 'maint@astralis.internal', name: 'Marcus Maint' },
        targetCompletionDate: new Date(Date.now() + 86400000 * 3),
        actualCompletionDate: null,
        status: 'PENDING',
        completionNotes: null
      }
    ],
    effectivenessVerification: null,
    raisedAt: new Date(),
    raisedBy: { userId: 'usr_qe_01', email: 'qe@astralis.internal', role: 'METALLURGIST' },
    closedAt: null,
    closedBy: null,
    transitionHistory: [
      {
        fromStatus: 'OPEN',
        toStatus: 'IN_PROGRESS',
        timestamp: new Date(),
        performedBy: { userId: 'usr_qe_01', email: 'qe@astralis.internal', role: 'METALLURGIST' },
        reason: 'CAPA initiated for NCR-202608-0001'
      }
    ],
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

describe('Manufacturing Non-Conformance (NCR) & CAPA Management', () => {
  const app = createApp();
  const tenantId = 'tenant_test_1';
  const qaLeadId = 'usr_qa_lead_01';
  let qaToken: string;

  const mockJob = {
    _id: 'job_001',
    id: 'job_001',
    jobNumber: 'JOB-202608-0001',
    planId: 'plan_001',
    planNumber: 'PLAN-202608-0001',
    tenantId,
    customer: {
      customerId: 'cust_001',
      customerCode: 'BOEING',
      customerName: 'Boeing Commercial Airplanes'
    },
    item: {
      itemId: 'item_9310',
      itemCode: 'MAT-9310-PINION',
      itemName: 'Sun Pinion Gear AISI 9310',
      materialGrade: 'AISI 9310',
      uom: 'PCS'
    },
    quantity: {
      targetQuantity: 250,
      loadedQuantity: 250
    },
    recipeSnapshot: {
      processFamily: 'CARBURIZING'
    },
    materialAllocations: [
      {
        heatLotId: 'hl_001',
        heatLotNumber: 'HL-202608-9310-A',
        allocatedQuantity: 250,
        uom: 'PCS'
      }
    ],
    isDeleted: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    qaToken = createAuthToken(qaLeadId, tenantId, ['METALLURGIST', 'QUALITY_MANAGER']);

    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);

    jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
      tenantId,
      userId: qaLeadId,
      roles: ['METALLURGIST'],
      permissions: [
        PERMISSIONS.QUALITY_INSPECTION_RECORD,
        PERMISSIONS.QUALITY_INSPECTION_VIEW,
        PERMISSIONS.QUALITY_DISPOSITION_MANAGE,
        PERMISSIONS.QUALITY_COC_APPROVE
      ],
      isSuperAdmin: false
    });
  });

  describe('POST /api/v1/ncrs (NCR Creation & Linkages)', () => {
    it('should create an NCR linked to production job, heat lots, and containment state', async () => {
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(mockJob as any);
      jest.spyOn(ncrCapaRepository, 'generateNextNcrNumber').mockResolvedValue('NCR-202608-0001');

      const mockNcr = createMockNcrDocument();
      jest.spyOn(ncrCapaRepository, 'createNcr').mockResolvedValue(mockNcr as any);
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue({
        status: 'AVAILABLE',
        save: jest.fn().mockResolvedValue(true)
      } as any);

      const res = await request(app)
        .post('/api/v1/ncrs')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          jobId: 'job_001',
          defectType: 'HARDNESS_OUT_OF_TOLERANCE',
          defectSeverity: 'MAJOR',
          defectDescription: 'Surface hardness below minimum specification limit (56 HRC vs 60-64 HRC target)',
          defectLocations: ['PITCH_LINE', 'TOOTH_FLANK'],
          totalAffectedQuantity: 250,
          rejectedQuantity: 250,
          containmentAction: 'Quarantined charge in Bay Q-4. Placed companion lot on hold.',
          quarantineRequired: true,
          quarantineBay: 'BAY_Q4',
          requiresCapa: true,
          evidence: [
            {
              title: 'Traverse Hardness Survey Profile',
              evidenceType: 'HARDNESS_REPORT',
              fileUrl: 'https://docs.astralis.internal/lab/surveys/EVD-001.pdf'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ncrNumber).toBe('NCR-202608-0001');
      expect(res.body.data.status).toBe('OPEN');
      expect(res.body.data.defectType).toBe('HARDNESS_OUT_OF_TOLERANCE');
    });

    it('should reject NCR creation if production job does not exist', async () => {
      jest.spyOn(productionJobRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/ncrs')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          jobId: 'job_non_existent',
          defectType: 'HARDNESS_OUT_OF_TOLERANCE',
          defectSeverity: 'MAJOR',
          defectDescription: 'Defect description',
          totalAffectedQuantity: 100,
          rejectedQuantity: 100,
          containmentAction: 'Segregated'
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Production Job with ID');
    });
  });

  describe('PUT /api/v1/ncrs/:id/root-cause (RCA 5-Why & Ishikawa)', () => {
    it('should record 5-Why root cause analysis and advance status to UNDER_INVESTIGATION', async () => {
      const mockNcr = createMockNcrDocument({ status: 'OPEN' });
      jest.spyOn(ncrCapaRepository, 'findNcrById').mockResolvedValue(mockNcr as any);

      const res = await request(app)
        .put('/api/v1/ncrs/ncr_test_001/root-cause')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          category: 'MACHINE_FURNACE',
          investigationMethod: '5_WHY',
          investigationDetails: 'Atmosphere %C dropped during soak stage due to oxygen probe reference air blockage',
          fiveWhys: [
            'Why 1: Surface carbon depleted -> Carbon potential in atmosphere dropped to 0.45% C',
            'Why 2: Controller did not enrich atmosphere -> Probe mV signal indicated false rich condition',
            'Why 3: Probe read false rich -> Reference air line flow rate was zero',
            'Why 4: Reference air flow zero -> In-line air filter clogged with soot',
            'Why 5: Filter clogged -> Preventive maintenance cycle exceeded by 60 days'
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockNcr.status).toBe('UNDER_INVESTIGATION');
      expect(mockNcr.rootCause.category).toBe('MACHINE_FURNACE');
      expect(mockNcr.rootCause.fiveWhys.length).toBe(5);
      expect(mockNcr.save).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/ncrs/:id/disposition (MRB Disposition & Quarantine Coordination)', () => {
    it('should record rework disposition and update quantities and quarantine status', async () => {
      const mockNcr = createMockNcrDocument({ status: 'UNDER_INVESTIGATION' });
      jest.spyOn(ncrCapaRepository, 'findNcrById').mockResolvedValue(mockNcr as any);
      jest.spyOn(heatLotRepository, 'findByHeatLotNumber').mockResolvedValue({
        status: 'QUARANTINED',
        save: jest.fn().mockResolvedValue(true)
      } as any);

      const res = await request(app)
        .post('/api/v1/ncrs/ncr_test_001/disposition')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          dispositionType: 'REWORK_REHEAT_TREAT',
          instructions: 'Re-boost carbon in Furnace F-01 at 930C for 90 minutes followed by direct oil quench and temper at 180C',
          remarks: 'Approved by Chief Metallurgist',
          quarantineAction: 'RELEASE_FOR_REWORK'
        });

      expect(res.status).toBe(200);
      expect(mockNcr.disposition.dispositionType).toBe('REWORK_REHEAT_TREAT');
      expect(mockNcr.affectedQuantity.reworkedQuantity).toBe(250);
      expect(mockNcr.containment.quarantineStatus).toBe('RELEASED');
      expect(mockNcr.save).toHaveBeenCalled();
    });

    it('should reject USE_AS_IS_CONCESSION if concession number is not provided', async () => {
      const mockNcr = createMockNcrDocument({ status: 'UNDER_INVESTIGATION' });
      jest.spyOn(ncrCapaRepository, 'findNcrById').mockResolvedValue(mockNcr as any);

      const res = await request(app)
        .post('/api/v1/ncrs/ncr_test_001/disposition')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          dispositionType: 'USE_AS_IS_CONCESSION',
          instructions: 'Accept parts with 58 HRC'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Customer concession / waiver number is mandatory');
    });
  });

  describe('POST /api/v1/ncrs/:ncrId/capas & CAPA Lifecycle', () => {
    it('should initiate CAPA with action items and link to NCR', async () => {
      const mockNcr = createMockNcrDocument({ status: 'DISPOSITIONED' });
      const mockCapa = createMockCapaDocument();

      jest.spyOn(ncrCapaRepository, 'findNcrById').mockResolvedValue(mockNcr as any);
      jest.spyOn(ncrCapaRepository, 'generateNextCapaNumber').mockResolvedValue('CAPA-202608-0001');
      jest.spyOn(ncrCapaRepository, 'createCapa').mockResolvedValue(mockCapa as any);

      const res = await request(app)
        .post('/api/v1/ncrs/ncr_test_001/capas')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          type: 'CORRECTIVE_AND_PREVENTIVE',
          title: 'Correction of Atmosphere Carbon Potential Depletion in Furnace F-02',
          problemStatement: 'Atmosphere %C dropped during soak stage due to oxygen probe reference air blockage',
          rootCauseSummary: 'Oxygen probe reference air line clogged with carbon soot',
          actionItems: [
            {
              actionType: 'MAINTENANCE_OVERHAUL',
              description: 'Clean and purge oxygen probe reference air delivery system on Furnace F-02',
              assignedToUserId: 'usr_maint_01',
              assignedToEmail: 'maint@astralis.internal',
              assignedToName: 'Marcus Maint',
              targetCompletionDate: new Date(Date.now() + 86400000 * 3).toISOString()
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.capaNumber).toBe('CAPA-202608-0001');
      expect(mockNcr.capaIds).toContain('capa_test_001');
    });

    it('should update CAPA action item and advance to VERIFICATION when all completed', async () => {
      const mockCapa = createMockCapaDocument();
      jest.spyOn(ncrCapaRepository, 'findCapaById').mockResolvedValue(mockCapa as any);

      const res = await request(app)
        .put('/api/v1/capas/capa_test_001/action-items')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          itemNumber: 1,
          status: 'COMPLETED',
          completionNotes: 'Replaced reference air particulate filter and calibrated flow to 1.5 SCFH'
        });

      expect(res.status).toBe(200);
      expect(mockCapa.actionItems[0].status).toBe('COMPLETED');
      expect(mockCapa.status).toBe('VERIFICATION');
      expect(mockCapa.save).toHaveBeenCalled();
    });

    it('should record effectiveness verification and close CAPA', async () => {
      const mockCapa = createMockCapaDocument({ status: 'VERIFICATION' });
      jest.spyOn(ncrCapaRepository, 'findCapaById').mockResolvedValue(mockCapa as any);

      // Verify effectiveness
      const verifyRes = await request(app)
        .post('/api/v1/capas/capa_test_001/verify')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          verificationMethod: 'SUBSEQUENT_LOT_AUDIT',
          verificationPeriodDays: 30,
          isEffective: true,
          notes: 'Subsequent 10 consecutive furnace loads showed carbon potential stability within +/- 0.02% C'
        });

      expect(verifyRes.status).toBe(200);
      expect(mockCapa.status).toBe('EFFECTIVE');

      // Close CAPA
      const closeRes = await request(app)
        .post('/api/v1/capas/capa_test_001/close')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          remarks: 'Permanent filter maintenance schedule added to CMMS'
        });

      expect(closeRes.status).toBe(200);
      expect(mockCapa.status).toBe('CLOSED');
    });
  });

  describe('POST /api/v1/ncrs/:id/close (NCR Closure Gating)', () => {
    it('should block closing NCR when MRB disposition is missing', async () => {
      const mockNcr = createMockNcrDocument({ status: 'OPEN', disposition: null });
      jest.spyOn(ncrCapaRepository, 'findNcrById').mockResolvedValue(mockNcr as any);

      const res = await request(app)
        .post('/api/v1/ncrs/ncr_test_001/close')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Material Review Board (MRB) disposition and signoff are mandatory');
    });

    it('should block closing NCR when required linked CAPAs are still open', async () => {
      const mockNcr = createMockNcrDocument({
        status: 'DISPOSITIONED',
        disposition: {
          dispositionType: 'REWORK_REHEAT_TREAT',
          instructions: 'Rework completed',
          dispositionSignoff: { userId: qaLeadId, timestamp: new Date() }
        },
        containment: { isQuarantined: false },
        requiresCapa: true,
        capaIds: ['capa_test_001']
      });
      const openCapa = createMockCapaDocument({ status: 'IN_PROGRESS' });

      jest.spyOn(ncrCapaRepository, 'findNcrById').mockResolvedValue(mockNcr as any);
      jest.spyOn(ncrCapaRepository, 'findCapasByNcrId').mockResolvedValue([openCapa as any]);

      const res = await request(app)
        .post('/api/v1/ncrs/ncr_test_001/close')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('are still in progress. All CAPAs must be VERIFIED/EFFECTIVE or CLOSED');
    });

    it('should successfully close NCR when disposition and CAPAs are verified', async () => {
      const mockNcr = createMockNcrDocument({
        status: 'DISPOSITIONED',
        disposition: {
          dispositionType: 'REWORK_REHEAT_TREAT',
          instructions: 'Rework completed and inspected conforming',
          dispositionSignoff: { userId: qaLeadId, timestamp: new Date() }
        },
        containment: { isQuarantined: false },
        requiresCapa: true,
        capaIds: ['capa_test_001']
      });
      const closedCapa = createMockCapaDocument({ status: 'CLOSED' });

      jest.spyOn(ncrCapaRepository, 'findNcrById').mockResolvedValue(mockNcr as any);
      jest.spyOn(ncrCapaRepository, 'findCapasByNcrId').mockResolvedValue([closedCapa as any]);

      const res = await request(app)
        .post('/api/v1/ncrs/ncr_test_001/close')
        .set('Authorization', `Bearer ${qaToken}`)
        .send({
          remarks: 'Rework verified and CAPA closed'
        });

      expect(res.status).toBe(200);
      expect(mockNcr.status).toBe('CLOSED');
      expect(mockNcr.save).toHaveBeenCalled();
    });
  });

  describe('RBAC Permission Gates', () => {
    it('should block unauthorized operators from recording MRB disposition', async () => {
      const operatorToken = createAuthToken('usr_operator_01', tenantId, ['FURNACE_OPERATOR']);

      jest.spyOn(rbacService, 'getUserEffectivePermissions').mockResolvedValue({
        tenantId,
        userId: 'usr_operator_01',
        roles: ['FURNACE_OPERATOR'],
        permissions: ['PRODUCTION_EXECUTE'],
        isSuperAdmin: false
      });

      const res = await request(app)
        .post('/api/v1/ncrs/ncr_test_001/disposition')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          dispositionType: 'SCRAP',
          instructions: 'Unauthorized scrap attempt'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Access Denied');
    });
  });
});
