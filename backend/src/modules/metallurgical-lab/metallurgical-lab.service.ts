import { randomUUID } from 'crypto';
import {
  IMetallurgicalLabRepository,
  metallurgicalLabRepository
} from './metallurgical-lab.repository.js';
import {
  CreateLabTestRecordDto,
  AddHardnessMeasurementDto,
  AddHardnessTraverseDto,
  AddMicrostructureObservationDto,
  LockLabTestRecordDto,
  QueryLabTestRecordsDto,
  LaboratoryTestRecordDocument,
  IHardnessMeasurement,
  IHardnessTraverse,
  IMicrostructureObservation
} from './metallurgical-lab.types.js';
import { qualityInspectionRepository } from '../quality-inspection/quality-inspection.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEventBus } from '../../core/events/domain-event-bus.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
}

export class MetallurgicalLabService {
  private readonly eventBus = DomainEventBus.getInstance();

  constructor(
    private readonly repo: IMetallurgicalLabRepository = metallurgicalLabRepository
  ) {}

  public async createLabRecord(
    tenantId: string,
    actor: IActorContext,
    dto: CreateLabTestRecordDto
  ): Promise<LaboratoryTestRecordDocument> {
    const inspection = await qualityInspectionRepository.findById(tenantId, dto.inspectionId);
    if (!inspection || inspection.isDeleted) {
      throw new NotFoundError(`Quality Inspection with ID '${dto.inspectionId}' not found`);
    }

    if (inspection.status === 'APPROVED') {
      throw new BadRequestError(
        `Cannot create lab test record for already APPROVED inspection '${inspection.inspectionNumber}'`
      );
    }

    const recordNumber = await this.repo.generateNextRecordNumber(tenantId);
    const now = new Date();

    const heatLotNumber =
      dto.heatLotNumber ||
      (inspection.heatLots && inspection.heatLots[0]?.heatLotNumber) ||
      null;

    const record = await this.repo.create(tenantId, {
      recordNumber,
      inspectionId: inspection.id,
      inspectionNumber: inspection.inspectionNumber,
      jobId: inspection.jobId,
      jobNumber: inspection.jobNumber,
      heatLotNumber,
      materialGrade: inspection.item.materialGrade,
      status: 'DRAFT',
      hardnessMeasurements: [],
      hardnessTraverses: [],
      microstructureObservations: [],
      revision: 1,
      auditHistory: [
        {
          action: 'CREATE',
          performedBy: {
            userId: actor.userId,
            email: actor.email,
            role: actor.role
          },
          timestamp: now,
          details: `Lab test record created for Inspection '${inspection.inspectionNumber}'`
        }
      ],
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'CREATE_LAB_RECORD',
      entityType: 'METALLURGICAL_LAB_RECORD',
      entityId: record.id,
      afterState: record.toJSON ? record.toJSON() : record,
      metadata: {
        recordNumber: record.recordNumber,
        inspectionNumber: inspection.inspectionNumber,
        jobNumber: inspection.jobNumber
      }
    });

    return record;
  }

  public async getRecordById(
    tenantId: string,
    id: string
  ): Promise<LaboratoryTestRecordDocument> {
    const record = await this.repo.findById(tenantId, id);
    if (!record || record.isDeleted) {
      throw new NotFoundError(`Laboratory Test Record with ID '${id}' not found`);
    }
    return record;
  }

  public async getRecordsByInspectionId(
    tenantId: string,
    inspectionId: string
  ): Promise<LaboratoryTestRecordDocument[]> {
    return this.repo.findByInspectionId(tenantId, inspectionId);
  }

  public async getRecordsByJobId(
    tenantId: string,
    jobId: string
  ): Promise<LaboratoryTestRecordDocument[]> {
    return this.repo.findByJobId(tenantId, jobId);
  }

  public async queryRecords(
    tenantId: string,
    filters: QueryLabTestRecordsDto = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<LaboratoryTestRecordDocument>> {
    return this.repo.queryRecords(tenantId, filters, pagination);
  }

  public async addHardnessMeasurement(
    tenantId: string,
    actor: IActorContext,
    recordId: string,
    dto: AddHardnessMeasurementDto
  ): Promise<LaboratoryTestRecordDocument> {
    const record = await this.getRecordById(tenantId, recordId);
    this.assertRecordModifiable(record);

    const now = new Date();
    const sum = dto.readings.reduce((acc, val) => acc + val, 0);
    const averageValue = parseFloat((sum / dto.readings.length).toFixed(1));

    let passed: boolean | null = null;
    if (dto.targetMin !== undefined || dto.targetMax !== undefined) {
      const minPass = dto.targetMin === undefined || averageValue >= dto.targetMin;
      const maxPass = dto.targetMax === undefined || averageValue <= dto.targetMax;
      passed = minPass && maxPass;
    }

    const measurement: IHardnessMeasurement = {
      measurementId: randomUUID(),
      sampleTag: dto.sampleTag,
      location: dto.location,
      scale: dto.scale,
      readings: dto.readings,
      averageValue,
      testEquipmentCode: dto.testEquipmentCode || null,
      calibrationDueDate: dto.calibrationDueDate ? new Date(dto.calibrationDueDate) : null,
      targetMin: dto.targetMin !== undefined ? dto.targetMin : null,
      targetMax: dto.targetMax !== undefined ? dto.targetMax : null,
      passed,
      measuredBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: now,
      notes: dto.notes || null
    };

    record.hardnessMeasurements.push(measurement);
    record.auditHistory.push({
      action: 'ADD_HARDNESS',
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: now,
      details: `Added ${dto.scale} hardness survey on sample '${dto.sampleTag}' at ${dto.location} (Avg: ${averageValue} ${dto.scale})`
    });

    await record.save();

    this.eventBus.publish({
      name: DomainEvents.QC_MEASUREMENTS_RECORDED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        recordId: record.id,
        recordNumber: record.recordNumber,
        inspectionId: record.inspectionId,
        testType: 'HARDNESS',
        scale: dto.scale,
        averageValue
      }
    });

    return record;
  }

  public async addHardnessTraverse(
    tenantId: string,
    actor: IActorContext,
    recordId: string,
    dto: AddHardnessTraverseDto
  ): Promise<LaboratoryTestRecordDocument> {
    const record = await this.getRecordById(tenantId, recordId);
    this.assertRecordModifiable(record);

    const now = new Date();
    // Sort points by depth ascending
    const sortedPoints = [...dto.points].sort((a, b) => a.depthMm - b.depthMm);

    // Calculate Effective Case Depth (ECD) via linear interpolation
    const ecdMm = this.calculateEffectiveCaseDepth(sortedPoints, dto.cutoffHardness);

    // Calculate Total Case Depth (first point at or below core baseline or last point)
    let totalCaseDepthMm: number | null = null;
    if (dto.coreHardnessBaseline !== undefined) {
      const corePoint = sortedPoints.find((p) => p.measuredHardness <= dto.coreHardnessBaseline!);
      if (corePoint) {
        totalCaseDepthMm = corePoint.depthMm;
      }
    }

    let passed: boolean | null = null;
    if (dto.targetCaseDepthMinMm !== undefined || dto.targetCaseDepthMaxMm !== undefined) {
      const minPass = dto.targetCaseDepthMinMm === undefined || ecdMm >= dto.targetCaseDepthMinMm;
      const maxPass = dto.targetCaseDepthMaxMm === undefined || ecdMm <= dto.targetCaseDepthMaxMm;
      passed = minPass && maxPass;
    }

    const traverse: IHardnessTraverse = {
      traverseId: randomUUID(),
      sampleTag: dto.sampleTag,
      location: dto.location,
      scale: dto.scale,
      load: dto.load || null,
      cutoffHardness: dto.cutoffHardness,
      points: sortedPoints.map((p) => ({
        depthMm: p.depthMm,
        measuredHardness: p.measuredHardness,
        scale: p.scale || dto.scale,
        load: p.load || dto.load || null,
        xCoordMicrons: p.xCoordMicrons || null,
        yCoordMicrons: p.yCoordMicrons || null
      })),
      calculatedEffectiveCaseDepthMm: ecdMm,
      calculatedTotalCaseDepthMm: totalCaseDepthMm,
      coreHardnessBaseline: dto.coreHardnessBaseline !== undefined ? dto.coreHardnessBaseline : null,
      targetCaseDepthMinMm: dto.targetCaseDepthMinMm !== undefined ? dto.targetCaseDepthMinMm : null,
      targetCaseDepthMaxMm: dto.targetCaseDepthMaxMm !== undefined ? dto.targetCaseDepthMaxMm : null,
      passed,
      testEquipmentCode: dto.testEquipmentCode || null,
      measuredBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: now,
      notes: dto.notes || null
    };

    record.hardnessTraverses.push(traverse);
    record.auditHistory.push({
      action: 'ADD_TRAVERSE',
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: now,
      details: `Added microhardness traverse on '${dto.sampleTag}'. Cutoff: ${dto.cutoffHardness} ${dto.scale}, Calculated ECD: ${ecdMm} mm`
    });

    await record.save();

    this.eventBus.publish({
      name: DomainEvents.QC_MEASUREMENTS_RECORDED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        recordId: record.id,
        recordNumber: record.recordNumber,
        inspectionId: record.inspectionId,
        testType: 'CASE_DEPTH_TRAVERSE',
        effectiveCaseDepthMm: ecdMm,
        cutoffHardness: dto.cutoffHardness
      }
    });

    return record;
  }

  public async addMicrostructureObservation(
    tenantId: string,
    actor: IActorContext,
    recordId: string,
    dto: AddMicrostructureObservationDto
  ): Promise<LaboratoryTestRecordDocument> {
    const record = await this.getRecordById(tenantId, recordId);
    this.assertRecordModifiable(record);

    const now = new Date();

    let retainedAustenite: IMicrostructureObservation['retainedAustenite'] = null;
    if (dto.retainedAustenite) {
      const raMax = dto.retainedAustenite.acceptableMaxPercent;
      const raPassed = raMax !== undefined ? dto.retainedAustenite.measuredPercent <= raMax : null;
      retainedAustenite = {
        measuredPercent: dto.retainedAustenite.measuredPercent,
        testMethod: dto.retainedAustenite.testMethod,
        acceptableMaxPercent: raMax !== undefined ? raMax : null,
        passed: raPassed
      };
    }

    let grainSize: IMicrostructureObservation['grainSize'] = null;
    if (dto.grainSize) {
      const gsMin = dto.grainSize.targetMin;
      const gsMax = dto.grainSize.targetMax;
      const gsPassed =
        (gsMin === undefined || dto.grainSize.astmNumber >= gsMin) &&
        (gsMax === undefined || dto.grainSize.astmNumber <= gsMax);
      grainSize = {
        astmNumber: dto.grainSize.astmNumber,
        method: dto.grainSize.method,
        targetMin: gsMin !== undefined ? gsMin : null,
        targetMax: gsMax !== undefined ? gsMax : null,
        passed: gsPassed
      };
    }

    let decarburization: IMicrostructureObservation['decarburization'] = null;
    if (dto.decarburization) {
      const decarbMax = dto.decarburization.maxAllowedDepthMm;
      const decarbPassed = decarbMax !== undefined ? dto.decarburization.totalDecarbDepthMm <= decarbMax : null;
      decarburization = {
        type: dto.decarburization.type,
        completeDecarbDepthMm: dto.decarburization.completeDecarbDepthMm || null,
        partialDecarbDepthMm: dto.decarburization.partialDecarbDepthMm || null,
        totalDecarbDepthMm: dto.decarburization.totalDecarbDepthMm,
        maxAllowedDepthMm: decarbMax !== undefined ? decarbMax : null,
        passed: decarbPassed
      };
    }

    let carbideMorphology: IMicrostructureObservation['carbideMorphology'] = null;
    if (dto.carbideMorphology) {
      const carbidePassed = !dto.carbideMorphology.networkPresent && !dto.carbideMorphology.grainBoundaryPrecipitation;
      carbideMorphology = {
        rating: dto.carbideMorphology.rating,
        networkPresent: dto.carbideMorphology.networkPresent,
        grainBoundaryPrecipitation: dto.carbideMorphology.grainBoundaryPrecipitation,
        description: dto.carbideMorphology.description || null,
        passed: carbidePassed
      };
    }

    const observation: IMicrostructureObservation = {
      observationId: randomUUID(),
      sampleTag: dto.sampleTag,
      location: dto.location,
      magnification: dto.magnification,
      matrixStructure: dto.matrixStructure,
      retainedAustenite,
      grainSize,
      decarburization,
      carbideMorphology,
      inclusionsAstmE45: dto.inclusionsAstmE45 || null,
      micrographPhotoUrls: dto.micrographPhotoUrls || [],
      observedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: now,
      notes: dto.notes || null
    };

    record.microstructureObservations.push(observation);
    record.auditHistory.push({
      action: 'ADD_MICRO',
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: now,
      details: `Added microstructure observation on '${dto.sampleTag}' at ${dto.magnification}x: ${dto.matrixStructure}`
    });

    await record.save();

    this.eventBus.publish({
      name: DomainEvents.QC_MEASUREMENTS_RECORDED,
      tenantId,
      occurredAt: now,
      actorId: actor.userId,
      payload: {
        recordId: record.id,
        recordNumber: record.recordNumber,
        inspectionId: record.inspectionId,
        testType: 'MICROSTRUCTURE',
        matrixStructure: dto.matrixStructure,
        magnification: dto.magnification
      }
    });

    return record;
  }

  public async lockLabRecord(
    tenantId: string,
    actor: IActorContext,
    recordId: string,
    dto: LockLabTestRecordDto
  ): Promise<LaboratoryTestRecordDocument> {
    const record = await this.getRecordById(tenantId, recordId);
    if (record.status === 'LOCKED') {
      throw new BadRequestError(`Laboratory Test Record '${record.recordNumber}' is already LOCKED`);
    }

    const now = new Date();
    record.status = 'LOCKED';
    record.lockedAt = now;
    record.lockedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role
    };
    record.lockReason = dto.lockReason;
    record.revision += 1;

    record.auditHistory.push({
      action: 'LOCK',
      performedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role
      },
      timestamp: now,
      details: `Record permanently locked. Reason: ${dto.lockReason}`
    });

    await record.save();

    await auditService.record(tenantId, {
      actorId: actor.userId,
      action: 'LOCK_LAB_RECORD',
      entityType: 'METALLURGICAL_LAB_RECORD',
      entityId: record.id,
      afterState: record.toJSON ? record.toJSON() : record,
      metadata: {
        recordNumber: record.recordNumber,
        lockReason: dto.lockReason
      }
    });

    return record;
  }

  /**
   * Helper to compute Effective Case Depth (ECD) via linear interpolation
   * across depth-versus-hardness traverse measurements.
   */
  public calculateEffectiveCaseDepth(
    points: Array<{ depthMm: number; measuredHardness: number }>,
    cutoffHardness: number
  ): number {
    if (!points || points.length === 0) return 0;

    // Check if first point is already below cutoff
    if (points[0].measuredHardness < cutoffHardness) {
      return 0;
    }

    // Check if all points are above or equal to cutoff
    const allAbove = points.every((p) => p.measuredHardness >= cutoffHardness);
    if (allAbove) {
      return points[points.length - 1].depthMm;
    }

    // Find crossing interval where p_i >= cutoff and p_{i+1} < cutoff
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      if (p1.measuredHardness >= cutoffHardness && p2.measuredHardness < cutoffHardness) {
        const deltaH = p2.measuredHardness - p1.measuredHardness;
        const deltaD = p2.depthMm - p1.depthMm;

        if (deltaH === 0) {
          return p1.depthMm;
        }

        const interpolatedDepth = p1.depthMm + ((cutoffHardness - p1.measuredHardness) / deltaH) * deltaD;
        return parseFloat(interpolatedDepth.toFixed(3));
      }
    }

    return 0;
  }

  private assertRecordModifiable(record: LaboratoryTestRecordDocument): void {
    if (record.status === 'LOCKED') {
      throw new BadRequestError(
        `Laboratory Test Record '${record.recordNumber}' is LOCKED and cannot be modified. Lock reason: ${record.lockReason || 'Finalized'}`
      );
    }
  }
}

export const metallurgicalLabService = new MetallurgicalLabService();
