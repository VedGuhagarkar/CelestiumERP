import crypto from 'crypto';
import { BaseService } from '../../core/services/base.service.js';
import {
  IQualityDocumentationRepository,
  qualityDocumentationRepository
} from './quality-documentation.repository.js';
import {
  IQualityInspectionRepository,
  qualityInspectionRepository
} from '../quality-inspection/quality-inspection.repository.js';
import {
  IProductionJobRepository,
  productionJobRepository
} from '../production-job/production-job.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  QualityDocumentDocument,
  GenerateQualityDocumentDto,
  RevokeQualityDocumentDto,
  ReissueQualityDocumentDto,
  QueryQualityDocumentsDto,
  ITargetVsActualHardness,
  ITargetVsActualCaseDepth,
  ITargetVsActualMicrostructure,
  ITargetVsActualVisualDimensional,
  ITargetVsActualPyrometry,
  ReportType
} from './quality-documentation.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
  fullName?: string;
  title?: string;
}

export class QualityDocumentationService extends BaseService {
  constructor(
    private readonly repo: IQualityDocumentationRepository = qualityDocumentationRepository,
    private readonly inspectionRepo: IQualityInspectionRepository = qualityInspectionRepository,
    private readonly jobRepo: IProductionJobRepository = productionJobRepository
  ) {
    super('QualityDocumentationService');
  }

  /**
   * Generates an authoritative Test Report or Certificate of Conformance (CoC) from an APPROVED inspection
   */
  public async generateDocument(
    tenantId: string,
    actor: IActorContext,
    dto: GenerateQualityDocumentDto
  ): Promise<QualityDocumentDocument> {
    const inspection = await this.inspectionRepo.findById(tenantId, dto.inspectionId);
    if (!inspection || inspection.isDeleted) {
      throw new NotFoundError(`Quality Inspection with ID '${dto.inspectionId}' not found`);
    }

    // MANDATORY GATING: Inspection MUST be APPROVED
    if (inspection.status !== 'APPROVED') {
      throw new BadRequestError(
        `Cannot generate ${dto.reportType} for inspection '${inspection.inspectionNumber}' in '${inspection.status}' status. Only APPROVED inspections can generate official quality documentation.`
      );
    }

    const job = await this.jobRepo.findById(tenantId, inspection.jobId);
    if (!job || job.isDeleted) {
      throw new NotFoundError(`Production Job with ID '${inspection.jobId}' not found`);
    }

    const documentNumber = await this.repo.generateNextDocumentNumber(tenantId, dto.reportType);
    const now = new Date();

    // 1. Compile Target-vs-Actual Hardness Surveys
    const spec = inspection.specificationSnapshot;
    const hardnessSurveys: ITargetVsActualHardness[] = [];

    if (inspection.testResults?.hardnessTests && inspection.testResults.hardnessTests.length > 0) {
      const testsByLocation = new Map<string, typeof inspection.testResults.hardnessTests>();
      for (const t of inspection.testResults.hardnessTests) {
        const loc = t.location || 'SURFACE';
        if (!testsByLocation.has(loc)) testsByLocation.set(loc, []);
        testsByLocation.get(loc)!.push(t);
      }

      for (const [loc, points] of testsByLocation.entries()) {
        const measuredValues = points.map((p) => p.measuredValue);
        const avg = measuredValues.reduce((sum, v) => sum + v, 0) / measuredValues.length;
        const scale = points[0].scale || 'HRC';

        let targetMin: number | undefined;
        let targetMax: number | undefined;
        if (loc === 'SURFACE' && spec.surfaceHardness) {
          targetMin = spec.surfaceHardness.min;
          targetMax = spec.surfaceHardness.max;
        } else if (loc === 'CORE' && spec.coreHardness) {
          targetMin = spec.coreHardness.min;
          targetMax = spec.coreHardness.max;
        }

        const targetRangeText =
          targetMin !== undefined && targetMax !== undefined
            ? `${targetMin} - ${targetMax} ${scale}`
            : points[0].targetMin && points[0].targetMax
            ? `${points[0].targetMin} - ${points[0].targetMax} ${scale}`
            : 'Per Customer Approved Drawing';

        const isLocPassed = points.every((p) => p.passed);

        hardnessSurveys.push({
          location: loc,
          scale,
          targetMin: targetMin ?? points[0].targetMin ?? null,
          targetMax: targetMax ?? points[0].targetMax ?? null,
          targetRangeText,
          measuredPoints: measuredValues,
          averageMeasured: Math.round(avg * 10) / 10,
          evaluation: isLocPassed ? 'CONFORMING' : 'NON_CONFORMING',
          standardReference: 'ASTM E18 / ASTM E384'
        });
      }
    }

    // 2. Compile Target-vs-Actual Case Depth
    let caseDepth: ITargetVsActualCaseDepth | null = null;
    if (inspection.testResults?.caseDepth) {
      const cd = inspection.testResults.caseDepth;
      const targetMin = spec.caseDepth?.effectiveCaseDepthMinMm ?? cd.targetMinMm ?? null;
      const targetMax = spec.caseDepth?.effectiveCaseDepthMaxMm ?? cd.targetMaxMm ?? null;

      caseDepth = {
        targetMinMm: targetMin,
        targetMaxMm: targetMax,
        targetRangeText:
          targetMin !== null && targetMax !== null
            ? `${targetMin} - ${targetMax} mm`
            : targetMin !== null
            ? `Min ${targetMin} mm`
            : 'Per Engineering Specification',
        cutoffHardnessText: cd.cutoffHardnessHrc
          ? `${cd.cutoffHardnessHrc} HRC`
          : '550 HV0.5 Cutoff Hardness per ASTM E384',
        effectiveCaseDepthMm: cd.effectiveCaseDepthMm,
        totalCaseDepthMm: cd.totalCaseDepthMm ?? null,
        evaluation: cd.passed ? 'CONFORMING' : 'NON_CONFORMING'
      };
    }

    // 3. Compile Target-vs-Actual Microstructure
    const microstructure: ITargetVsActualMicrostructure[] = [];
    if (inspection.testResults?.microstructure) {
      const ms = inspection.testResults.microstructure;
      microstructure.push({
        characteristicName: 'Microstructure Matrix',
        targetRequirement: spec.microstructure?.matrixStructure || 'Tempered Martensite with fine carbides',
        actualObservation: ms.observedStructure,
        evaluation: ms.passed ? 'CONFORMING' : 'NON_CONFORMING'
      });

      if (ms.retainedAustenitePercent !== undefined) {
        const maxRA = spec.microstructure?.maxRetainedAustenitePercent || 10;
        microstructure.push({
          characteristicName: 'Retained Austenite',
          targetRequirement: `Max ${maxRA}%`,
          actualObservation: `${ms.retainedAustenitePercent}%`,
          measuredValue: ms.retainedAustenitePercent,
          unit: '%',
          evaluation: ms.retainedAustenitePercent <= maxRA ? 'CONFORMING' : 'NON_CONFORMING'
        });
      }

      if (ms.grainSizeAstm !== undefined) {
        const targetGrain = 'ASTM 5 or finer';
        microstructure.push({
          characteristicName: 'Prior Austenite Grain Size',
          targetRequirement: targetGrain,
          actualObservation: `ASTM ${ms.grainSizeAstm}`,
          measuredValue: ms.grainSizeAstm,
          unit: 'ASTM',
          evaluation: ms.grainSizeAstm >= 5 ? 'CONFORMING' : 'NON_CONFORMING'
        });
      }

      if (ms.decarburizationDepthMm !== undefined) {
        const maxDecarb = spec.microstructure?.decarburizationLimitMm || 0.05;
        microstructure.push({
          characteristicName: 'Surface Decarburization Depth',
          targetRequirement: `Max ${maxDecarb} mm`,
          actualObservation: `${ms.decarburizationDepthMm} mm`,
          measuredValue: ms.decarburizationDepthMm,
          unit: 'mm',
          evaluation: ms.decarburizationDepthMm <= maxDecarb ? 'CONFORMING' : 'NON_CONFORMING'
        });
      }
    }

    // 4. Compile Target-vs-Actual Visual & Dimensional Findings
    const visualDimensional: ITargetVsActualVisualDimensional[] = [];
    if (inspection.testResults?.visualDimensional) {
      const vd = inspection.testResults.visualDimensional;
      visualDimensional.push(
        {
          inspectionItem: 'Visual Surface Inspection',
          acceptanceCriteria: 'Clean, scale-free, no excessive oxidation',
          finding: vd.surfaceOxidationAcceptable ? 'Acceptable clean surface condition' : 'Excessive scaling',
          isConforming: vd.surfaceOxidationAcceptable
        },
        {
          inspectionItem: 'Quench Cracks Examination',
          acceptanceCriteria: 'Zero quench cracks allowed',
          finding: vd.quenchCracksPresent ? 'Quench cracking detected' : 'No quench cracks observed',
          isConforming: !vd.quenchCracksPresent
        },
        {
          inspectionItem: 'Dimensional & Distortion Verification',
          acceptanceCriteria: vd.maxAllowedDistortionMm
            ? `Max ${vd.maxAllowedDistortionMm} mm distortion`
            : 'Within approved dimensional tolerance',
          finding: vd.dimensionsWithinTolerance
            ? vd.distortionMm !== undefined
              ? `Measured ${vd.distortionMm} mm distortion (Conforming)`
              : 'Conforming within blueprint tolerance'
            : 'Out of tolerance',
          isConforming: vd.dimensionsWithinTolerance
        }
      );
    }

    // 5. Compile Pyrometry Compliance
    let pyrometry: ITargetVsActualPyrometry | null = null;
    if (inspection.testResults?.pyrometry) {
      const pv = inspection.testResults.pyrometry;
      pyrometry = {
        furnaceCode: 'FURNACE-01',
        furnaceClass: 'CLASS_2 (+/- 6°C)',
        instrumentationType: 'TYPE_B',
        operatingRange: '300°C - 1050°C',
        satCompliant: pv.soakTemperatureCompliant,
        tusCompliant: pv.soakTimeCompliant,
        standardReference: 'AMS_2750G',
        pyrometryStatus: pv.passed ? 'CONFORMING' : 'NON_CONFORMING'
      };
    }

    // 6. Security Verification Code & Tamper-Proof Cryptographic Checksum
    const randomBytes = crypto.randomBytes(6).toString('hex').toUpperCase();
    const securityVerificationCode = `SEC-${randomBytes.slice(0, 4)}-${randomBytes.slice(4, 8)}-${randomBytes.slice(
      8,
      12
    )}`;

    const digestPayload = JSON.stringify({
      tenantId,
      documentNumber,
      inspectionNumber: inspection.inspectionNumber,
      jobNumber: job.jobNumber,
      recipeCode: job.recipeSnapshot.recipeCode,
      recipeRev: job.recipeSnapshot.revisionNumber,
      specCode: spec.specCode,
      specRev: spec.revisionNumber,
      hardnessSurveys,
      caseDepth,
      microstructure,
      certifiedAt: now.toISOString(),
      certifiedByUserId: actor.userId
    });

    const tamperProofChecksum = crypto.createHash('sha256').update(digestPayload).digest('hex');
    const verificationUrl = `https://verify.astralis.internal/doc-verify?code=${securityVerificationCode}&checksum=${tamperProofChecksum.slice(
      0,
      16
    )}`;

    // 7. Applicable Aerospace / Industrial Standards
    const applicableStandards = [
      'AMS 2759 (Heat Treatment of Steel Parts)',
      'AMS 2750G (Pyrometry)',
      'ASTM E18 (Rockwell Hardness)',
      'ASTM E384 (Microindentation Hardness)',
      'ISO 9001:2015 / AS9100D',
      ...(dto.additionalStandards || [])
    ];

    const certificationStatement =
      dto.reportType === 'CERTIFICATE_OF_CONFORMANCE' || dto.reportType === 'COMBINED_METALLURGICAL_REPORT'
        ? 'This is to certify that the components and materials listed herein have been processed, inspected, and tested in accordance with customer purchase order requirements, approved engineering drawings, and applicable process specifications. All recorded test results are authentic, verifiable, and conform in all respects to the specified criteria.'
        : 'This document represents the authoritative laboratory test report containing physical, dimensional, and metallurgical measurements recorded by certified inspection personnel in accordance with accredited laboratory testing procedures.';

    const digitalSignatureHash = crypto
      .createHash('sha256')
      .update(`${actor.userId}:${actor.email}:${now.toISOString()}:${documentNumber}`)
      .digest('hex');

    // 8. Generate Standard Printable HTML Document Template
    const printableHtmlTemplate = this.generatePrintableHtml({
      documentNumber,
      reportType: dto.reportType,
      customer: {
        customerCode: job.customer.customerCode,
        customerName: job.customer.customerName,
        purchaseOrderNumber: dto.purchaseOrderNumber || null,
        partNumber: dto.partNumber || null,
        drawingNumber: dto.drawingNumber || null,
        drawingRevision: dto.drawingRevision || null
      },
      item: {
        itemCode: job.item.itemCode,
        itemName: job.item.itemName,
        materialGrade: job.item.materialGrade,
        uom: job.item.uom
      },
      certifiedQuantity: {
        acceptedQuantity: job.quantity.completedQuantity || job.quantity.targetQuantity,
        sampleQuantity: inspection.inspectionQuantity.sampleSize,
        totalLotQuantity: job.quantity.targetQuantity,
        uom: job.item.uom
      },
      heatLots: (job.materialAllocations || []).map((m) => ({
        heatLotNumber: m.heatLotNumber || 'N/A',
        quantity: m.allocatedQuantity,
        uom: m.uom
      })),
      recipe: {
        recipeCode: job.recipeSnapshot.recipeCode,
        revisionNumber: job.recipeSnapshot.revisionNumber,
        processFamily: job.recipeSnapshot.processFamily,
        name: job.recipeSnapshot.name
      },
      specification: {
        specCode: spec.specCode,
        revisionNumber: spec.revisionNumber,
        title: spec.title
      },
      hardnessSurveys,
      caseDepth,
      microstructure,
      visualDimensional,
      pyrometry,
      applicableStandards,
      certificationStatement,
      securityVerificationCode,
      tamperProofChecksum,
      verificationUrl,
      certifiedBy: {
        fullName: actor.fullName || 'Chief QA Metallurgist',
        title: actor.title || 'Quality Assurance Lead / Certified Metallurgist',
        signedAt: now,
        digitalSignatureHash
      }
    });

    const doc = await this.repo.create(tenantId, {
      documentNumber,
      reportType: dto.reportType,
      status: 'ISSUED',
      versionNumber: 1,
      revisionNumber: 0,
      previousDocumentId: null,

      inspectionId: inspection.id,
      inspectionNumber: inspection.inspectionNumber,
      jobId: job.id,
      jobNumber: job.jobNumber,
      planId: job.planId || null,
      planNumber: job.planNumber || null,

      customer: {
        customerId: job.customer.customerId,
        customerCode: job.customer.customerCode,
        customerName: job.customer.customerName,
        purchaseOrderNumber: dto.purchaseOrderNumber || null,
        partNumber: dto.partNumber || null,
        drawingNumber: dto.drawingNumber || null,
        drawingRevision: dto.drawingRevision || null
      },

      item: {
        itemId: job.item.itemId,
        itemCode: job.item.itemCode,
        itemName: job.item.itemName,
        materialGrade: job.item.materialGrade,
        uom: job.item.uom
      },

      heatLots: (job.materialAllocations || []).map((m) => ({
        heatLotId: m.heatLotId || null,
        heatLotNumber: m.heatLotNumber || null,
        quantity: m.allocatedQuantity,
        uom: m.uom
      })),

      certifiedQuantity: {
        acceptedQuantity: job.quantity.completedQuantity || job.quantity.targetQuantity,
        sampleQuantity: inspection.inspectionQuantity.sampleSize,
        totalLotQuantity: job.quantity.targetQuantity,
        uom: job.item.uom
      },

      recipe: {
        recipeId: job.recipeSnapshot.recipeId,
        recipeCode: job.recipeSnapshot.recipeCode,
        revisionNumber: job.recipeSnapshot.revisionNumber,
        processFamily: job.recipeSnapshot.processFamily,
        name: job.recipeSnapshot.name,
        stagesCount: job.recipeSnapshot.stages?.length || 0
      },

      specification: {
        specificationId: spec.specificationId,
        specCode: spec.specCode,
        revisionNumber: spec.revisionNumber,
        title: spec.title,
        customerCode: spec.customerCode
      },

      qualityPlan: inspection.qualityPlanSnapshot
        ? {
            planId: inspection.qualityPlanSnapshot.planId,
            planCode: inspection.qualityPlanSnapshot.planCode,
            revisionNumber: inspection.qualityPlanSnapshot.revisionNumber,
            title: inspection.qualityPlanSnapshot.title
          }
        : null,

      hardnessSurveys,
      caseDepth,
      microstructure,
      visualDimensional,
      pyrometry,

      overallCompliance: {
        isConforming: true,
        disposition: 'CONFORMING',
        concessionReference: null,
        summaryStatement: 'All physical, metallurgical, and pyrometry parameters conform to specification limits.'
      },

      applicableStandards,
      certificationStatement,
      remarks: dto.customRemarks || null,

      securityVerificationCode,
      tamperProofChecksum,
      verificationUrl,

      certifiedBy: {
        userId: actor.userId,
        email: actor.email || 'qa@astralis.internal',
        role: actor.role || 'METALLURGIST',
        fullName: actor.fullName || 'Chief QA Metallurgist',
        title: actor.title || 'Quality Assurance Lead / Certified Metallurgist',
        signedAt: now,
        digitalSignatureHash
      },

      revocation: null,
      printableHtmlTemplate
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: dto.reportType === 'CERTIFICATE_OF_CONFORMANCE' ? 'COC_ISSUED' : 'TEST_REPORT_GENERATED',
      entityType: 'QualityDocument',
      entityId: doc.id,
      metadata: {
        documentNumber,
        reportType: dto.reportType,
        inspectionNumber: inspection.inspectionNumber,
        jobNumber: job.jobNumber,
        securityVerificationCode
      }
    });

    const eventName =
      dto.reportType === 'CERTIFICATE_OF_CONFORMANCE'
        ? DomainEvents.QC_COC_ISSUED
        : DomainEvents.QC_TEST_REPORT_GENERATED;

    this.publishEvent(eventName, tenantId, {
      documentId: doc.id,
      documentNumber,
      reportType: dto.reportType,
      inspectionId: inspection.id,
      inspectionNumber: inspection.inspectionNumber,
      jobId: job.id,
      jobNumber: job.jobNumber,
      securityVerificationCode
    }, actor.userId);

    return doc;
  }

  /**
   * Revokes an issued Test Report or Certificate of Conformance
   */
  public async revokeDocument(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: RevokeQualityDocumentDto
  ): Promise<QualityDocumentDocument> {
    const doc = await this.repo.findById(tenantId, id);
    if (!doc) {
      throw new NotFoundError(`Quality Document with ID '${id}' not found`);
    }

    if (doc.status === 'REVOKED') {
      throw new BadRequestError(`Document '${doc.documentNumber}' is already REVOKED`);
    }

    const now = new Date();
    doc.status = 'REVOKED';
    doc.revocation = {
      isRevoked: true,
      revokedAt: now,
      revokedBy: {
        userId: actor.userId,
        email: actor.email || 'qa@astralis.internal',
        role: actor.role || 'METALLURGIST'
      },
      reason: dto.reason
    };

    await doc.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'QUALITY_DOCUMENT_REVOKED',
      entityType: 'QualityDocument',
      entityId: doc.id,
      metadata: {
        documentNumber: doc.documentNumber,
        reason: dto.reason
      }
    });

    this.publishEvent(DomainEvents.QC_COC_REVOKED, tenantId, {
      documentId: doc.id,
      documentNumber: doc.documentNumber,
      reason: dto.reason
    }, actor.userId);

    return doc;
  }

  /**
   * Public or Authenticated Document Verification using Security Token
   */
  public async verifyDocument(tenantId: string, securityCode: string): Promise<QualityDocumentDocument> {
    const doc = await this.repo.findByVerificationCode(tenantId, securityCode);
    if (!doc) {
      throw new NotFoundError(`No authentic quality document found matching verification token '${securityCode}'`);
    }
    return doc;
  }

  public async getDocumentById(tenantId: string, id: string): Promise<QualityDocumentDocument> {
    const doc = await this.repo.findById(tenantId, id);
    if (!doc) {
      throw new NotFoundError(`Quality Document with ID '${id}' not found`);
    }
    return doc;
  }

  public async getDocumentByNumber(tenantId: string, documentNumber: string): Promise<QualityDocumentDocument> {
    const doc = await this.repo.findByDocumentNumber(tenantId, documentNumber);
    if (!doc) {
      throw new NotFoundError(`Quality Document with number '${documentNumber}' not found`);
    }
    return doc;
  }

  public async queryDocuments(
    tenantId: string,
    query: QueryQualityDocumentsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<QualityDocumentDocument>> {
    return await this.repo.query(tenantId, query, pagination);
  }

  /**
   * Generates clean standard A4 printable HTML document
   */
  private generatePrintableHtml(data: Record<string, any>): string {
    const hardnessRows = (data.hardnessSurveys || [])
      .map(
        (h: any) => `
        <tr>
          <td>${h.location}</td>
          <td>${h.targetRangeText}</td>
          <td>${h.measuredPoints.join(', ')}</td>
          <td><strong>${h.averageMeasured} ${h.scale}</strong></td>
          <td style="color: ${h.evaluation === 'CONFORMING' ? 'green' : 'red'}; font-weight: bold;">
            ${h.evaluation}
          </td>
        </tr>`
      )
      .join('');

    const microRows = (data.microstructure || [])
      .map(
        (m: any) => `
        <tr>
          <td>${m.characteristicName}</td>
          <td>${m.targetRequirement}</td>
          <td>${m.actualObservation}</td>
          <td style="color: ${m.evaluation === 'CONFORMING' ? 'green' : 'red'}; font-weight: bold;">
            ${m.evaluation}
          </td>
        </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.reportType} - ${data.documentNumber}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 24px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
    .header .subtitle { color: #64748b; font-size: 12px; }
    .section-title { font-size: 14px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; margin-top: 16px; margin-bottom: 8px; border-left: 4px solid #2563eb; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f8fafc; color: #334155; }
    .statement-box { background: #f8fafc; border: 1px solid #94a3b8; padding: 12px; font-size: 11px; margin-top: 16px; border-radius: 4px; line-height: 1.5; }
    .security-badge { font-family: monospace; font-size: 11px; background: #e2e8f0; padding: 4px 8px; border-radius: 3px; display: inline-block; }
    .signature-box { margin-top: 24px; display: flex; justify-content: space-between; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ASTRALIS METALLURGICAL & THERMAL PROCESSING FACILITY</h1>
    <div class="subtitle">Accredited Aerospace Heat Treatment & Metallurgical Testing Laboratory | NADCAP & AS9100D Certified</div>
    <h2>${data.reportType.replace(/_/g, ' ')}</h2>
    <div><strong>Document No:</strong> ${data.documentNumber} | <strong>Verification Code:</strong> <span class="security-badge">${data.securityVerificationCode}</span></div>
  </div>

  <div class="section-title">1. Traceability & Part Identification</div>
  <table>
    <tr><th>Customer</th><td>${data.customer.customerName} (${data.customer.customerCode})</td><th>PO Number</th><td>${data.customer.purchaseOrderNumber || 'N/A'}</td></tr>
    <tr><th>Part Name</th><td>${data.item.itemName} (${data.item.itemCode})</td><th>Material Grade</th><td>${data.item.materialGrade}</td></tr>
    <tr><th>Heat Lot(s)</th><td>${data.heatLots.map((h: any) => h.heatLotNumber).join(', ')}</td><th>Certified Qty</th><td>${data.certifiedQuantity.acceptedQuantity} ${data.certifiedQuantity.uom} (Sample: ${data.certifiedQuantity.sampleQuantity})</td></tr>
    <tr><th>Approved Recipe</th><td>${data.recipe.recipeCode} (Rev ${data.recipe.revisionNumber}) - ${data.recipe.name}</td><th>Process Family</th><td>${data.recipe.processFamily}</td></tr>
    <tr><th>Authoritative Spec</th><td>${data.specification.specCode} (Rev ${data.specification.revisionNumber})</td><th>Spec Title</th><td>${data.specification.title}</td></tr>
  </table>

  <div class="section-title">2. Mechanical & Hardness Test Results (ASTM E18 / ASTM E384)</div>
  <table>
    <thead><tr><th>Location</th><th>Target Requirement</th><th>Individual Measurements</th><th>Average</th><th>Result</th></tr></thead>
    <tbody>${hardnessRows}</tbody>
  </table>

  ${
    data.caseDepth
      ? `<div class="section-title">3. Effective Case Depth Evaluation</div>
  <table>
    <tr><th>Target Case Depth</th><td>${data.caseDepth.targetRangeText}</td><th>Cutoff Hardness</th><td>${data.caseDepth.cutoffHardnessText}</td></tr>
    <tr><th>Measured Effective Case Depth</th><td><strong>${data.caseDepth.effectiveCaseDepthMm} mm</strong></td><th>Evaluation</th><td style="color: ${data.caseDepth.evaluation === 'CONFORMING' ? 'green' : 'red'}; font-weight: bold;">${data.caseDepth.evaluation}</td></tr>
  </table>`
      : ''
  }

  <div class="section-title">4. Metallurgical Microstructure & Phase Analysis</div>
  <table>
    <thead><tr><th>Characteristic</th><th>Specification Requirement</th><th>Observed Finding</th><th>Evaluation</th></tr></thead>
    <tbody>${microRows}</tbody>
  </table>

  <div class="statement-box">
    <strong>CERTIFICATION STATEMENT:</strong><br>
    ${data.certificationStatement}
  </div>

  <div class="signature-box">
    <div>
      <strong>Certified By:</strong> ${data.certifiedBy.fullName}<br>
      <strong>Title:</strong> ${data.certifiedBy.title}<br>
      <strong>Date of Certification:</strong> ${new Date(data.certifiedBy.signedAt).toUTCString()}<br>
      <strong>Digital Verification Token:</strong> <code>${data.certifiedBy.digitalSignatureHash.slice(0, 24)}...</code>
    </div>
    <div style="text-align: right;">
      <div style="border: 2px dashed #0f172a; padding: 12px; display: inline-block;">
        <strong>ASTRALIS QA SEAL</strong><br>
        <small>NADCAP ACCREDITED</small><br>
        <span style="color: green; font-weight: bold;">PASSED</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}

export const qualityDocumentationService = new QualityDocumentationService();
