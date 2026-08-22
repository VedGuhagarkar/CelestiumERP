import { BaseService } from '../../core/services/base.service.js';
import { IPyrometryRepository, pyrometryRepository } from './pyrometry.repository.js';
import { machineRepository, IMachineRepository } from '../machine/machine.repository.js';
import { auditService } from '../audit/audit.service.js';
import { DomainEvents } from '../../core/constants/events.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  ThermocoupleChannelDocument,
  CalibrationRecordDocument,
  TemperatureTelemetrySampleDocument,
  RegisterChannelDto,
  LogSensorCalibrationDto,
  LogTusSurveyDto,
  LogSatTestDto,
  ApproveCalibrationDto,
  LogTelemetryDto,
  QueryCalibrationsDto,
  QueryChannelsDto,
  MachinePyrometryComplianceStatus,
  ComplianceAlertLevel,
  IChannelReading
} from './pyrometry.types.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
  fullName?: string;
}

export class PyrometryService extends BaseService {
  constructor(
    private readonly repo: IPyrometryRepository = pyrometryRepository,
    private readonly machRepo: IMachineRepository = machineRepository
  ) {
    super('PyrometryService');
  }

  // ==================== Thermocouple Channel Management ====================

  public async registerChannel(
    tenantId: string,
    actor: IActorContext,
    dto: RegisterChannelDto
  ): Promise<ThermocoupleChannelDocument> {
    const existing = await this.repo.findChannelByChannelId(tenantId, dto.channelId);
    if (existing) {
      throw new ConflictError(`Thermocouple channel '${dto.channelId.toUpperCase()}' already exists`);
    }

    const machine = await this.machRepo.findById(tenantId, dto.machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${dto.machineId}' not found`);
    }

    const calibratedAt = new Date(dto.calibratedAt);
    const expiresAt = new Date(dto.expiresAt);

    if (calibratedAt > expiresAt) {
      throw new BadRequestError('calibratedAt cannot be after expiresAt');
    }

    const channel = await this.repo.createChannel(tenantId, {
      channelId: dto.channelId.toUpperCase(),
      machineId: machine.id,
      machineCode: machine.machineCode,
      furnaceZoneNumber: dto.furnaceZoneNumber,
      channelType: dto.channelType,
      thermocoupleType: dto.thermocoupleType,
      locationDescription: dto.locationDescription,
      sensorSerialNumber: dto.sensorSerialNumber,
      wireSpoolNumber: dto.wireSpoolNumber || null,
      calibrationOffsetC: dto.calibrationOffsetC || 0.0,
      correctionOffsets: dto.correctionOffsets || [],
      maxAllowedUsageCount: dto.maxAllowedUsageCount || null,
      currentUsageCount: 0,
      calibratedAt,
      expiresAt,
      isCalibrated: true,
      isActive: true,
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'THERMOCOUPLE_CHANNEL_REGISTERED',
      entityType: 'ThermocoupleChannel',
      entityId: channel.id,
      metadata: {
        channelId: channel.channelId,
        machineCode: machine.machineCode,
        channelType: channel.channelType
      }
    });

    return channel;
  }

  public async incrementChannelUsage(
    tenantId: string,
    channelId: string,
    usagesToAdd: number = 1
  ): Promise<ThermocoupleChannelDocument> {
    const channel = await this.repo.findChannelByChannelId(tenantId, channelId);
    if (!channel) {
      throw new NotFoundError(`Thermocouple channel '${channelId}' not found`);
    }

    channel.currentUsageCount += usagesToAdd;
    if (
      channel.maxAllowedUsageCount &&
      channel.currentUsageCount >= channel.maxAllowedUsageCount
    ) {
      channel.isCalibrated = false; // Exceeded maximum allowable usage per AMS 2750G
    }

    await channel.save();
    return channel;
  }

  public async queryChannels(
    tenantId: string,
    query: QueryChannelsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ThermocoupleChannelDocument>> {
    return await this.repo.queryChannels(tenantId, query, pagination);
  }

  // ==================== Sensor & Instrument Calibration ====================

  public async logSensorCalibration(
    tenantId: string,
    actor: IActorContext,
    dto: LogSensorCalibrationDto
  ): Promise<CalibrationRecordDocument> {
    const machine = await this.machRepo.findById(tenantId, dto.machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${dto.machineId}' not found`);
    }

    const calibrationNumber = await this.repo.generateNextCalibrationNumber(
      tenantId,
      dto.calibrationType
    );

    const overallPassed = dto.testPoints.every((p) => p.passed);

    const cal = await this.repo.createCalibration(tenantId, {
      calibrationNumber,
      calibrationType: dto.calibrationType,
      machineId: machine.id,
      machineCode: machine.machineCode,
      channelId: dto.channelId || null,
      standardReference: dto.standardReference,
      status: 'APPROVED', // Sensor calibrations logged by technicians are marked approved
      instrumentModel: dto.instrumentModel || null,
      instrumentSerial: dto.instrumentSerial || null,
      calibratedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role,
        technicianName: dto.technicianName,
        externalAgency: dto.externalAgency || null
      },
      masterStandardSerial: dto.masterStandardSerial,
      masterStandardExpiry: new Date(dto.masterStandardExpiry),
      testPoints: dto.testPoints,
      overallPassed,
      testDate: new Date(dto.testDate),
      expiryDate: new Date(dto.expiryDate),
      approvedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role,
        approvedAt: new Date(),
        comments: 'Verified against NIST traceable standard'
      },
      certificateNumber: dto.certificateNumber || null,
      notes: dto.notes || null
    });

    // If linked to a channel, update channel calibration expiry & offsets
    if (dto.channelId) {
      const channel = await this.repo.findChannelByChannelId(tenantId, dto.channelId);
      if (channel) {
        channel.calibratedAt = new Date(dto.testDate);
        channel.expiresAt = new Date(dto.expiryDate);
        channel.isCalibrated = overallPassed;
        channel.currentUsageCount = 0;
        channel.correctionOffsets = dto.testPoints.map((p) => ({
          setpointTempC: p.nominalTempC,
          rawReadingC: p.instrumentReadingC,
          correctedOffsetC: p.correctionOffsetC
        }));
        await channel.save();
      }
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SENSOR_CALIBRATION_RECORDED',
      entityType: 'CalibrationRecord',
      entityId: cal.id,
      metadata: {
        calibrationNumber,
        machineCode: machine.machineCode,
        channelId: dto.channelId
      }
    });

    this.publishEvent(DomainEvents.MACHINE_CALIBRATION_LOGGED, tenantId, {
      calibrationId: cal.id,
      calibrationNumber,
      machineId: machine.id,
      machineCode: machine.machineCode,
      calibrationType: dto.calibrationType
    }, actor.userId);

    return cal;
  }

  // ==================== Temperature Uniformity Survey (TUS) ====================

  public async logTusSurvey(
    tenantId: string,
    actor: IActorContext,
    dto: LogTusSurveyDto
  ): Promise<CalibrationRecordDocument> {
    const machine = await this.machRepo.findById(tenantId, dto.machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${dto.machineId}' not found`);
    }

    const calibrationNumber = await this.repo.generateNextCalibrationNumber(
      tenantId,
      'TUS_SURVEY'
    );

    // Validate uniformity tolerance against furnace class
    const maxAllowedSpread = this.getMaxSpreadForClass(dto.furnaceClass);
    const evaluatedTemps = dto.surveyTemperatures.map((st) => {
      const spread = Math.abs(st.maxObservedC - st.minObservedC);
      const isPassed = spread <= maxAllowedSpread;
      return {
        ...st,
        uniformitySpreadC: Math.round(spread * 10) / 10,
        maxAllowedSpreadC: maxAllowedSpread,
        passed: isPassed
      };
    });

    const overallPassed = evaluatedTemps.every((t) => t.passed);

    const cal = await this.repo.createCalibration(tenantId, {
      calibrationNumber,
      calibrationType: 'TUS_SURVEY',
      machineId: machine.id,
      machineCode: machine.machineCode,
      standardReference: dto.standardReference,
      status: 'DRAFT', // TUS surveys require formal QA signoff
      calibratedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role,
        technicianName: dto.technicianName,
        externalAgency: dto.externalAgency || null
      },
      masterStandardSerial: dto.masterStandardSerial,
      masterStandardExpiry: new Date(dto.masterStandardExpiry),
      tusRecord: {
        furnaceClass: dto.furnaceClass,
        operatingRangeMinC: dto.operatingRangeMinC,
        operatingRangeMaxC: dto.operatingRangeMaxC,
        surveyTemperatures: evaluatedTemps,
        surveySensorCount: dto.surveySensorCount,
        overallPassed,
        reportDocumentUrl: dto.reportDocumentUrl || null
      },
      overallPassed,
      testDate: new Date(dto.testDate),
      expiryDate: new Date(dto.expiryDate),
      certificateNumber: dto.certificateNumber || null,
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'TUS_SURVEY_LOGGED',
      entityType: 'CalibrationRecord',
      entityId: cal.id,
      metadata: {
        calibrationNumber,
        machineCode: machine.machineCode,
        furnaceClass: dto.furnaceClass,
        overallPassed
      }
    });

    return cal;
  }

  // ==================== System Accuracy Test (SAT) ====================

  public async logSatTest(
    tenantId: string,
    actor: IActorContext,
    dto: LogSatTestDto
  ): Promise<CalibrationRecordDocument> {
    const machine = await this.machRepo.findById(tenantId, dto.machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${dto.machineId}' not found`);
    }

    const calibrationNumber = await this.repo.generateNextCalibrationNumber(
      tenantId,
      'SAT_TEST'
    );

    const observedDiff = Math.abs(dto.furnaceControlReadingC - dto.testStandardReadingC);
    // AMS 2750G Table 13: Max allowed SAT difference is +/- 1.1°C or +/- 0.4% of temperature
    const maxAllowedDiff = Math.max(1.1, Math.round(dto.targetSetpointC * 0.004 * 10) / 10);
    const passed = observedDiff <= maxAllowedDiff;

    const cal = await this.repo.createCalibration(tenantId, {
      calibrationNumber,
      calibrationType: 'SAT_TEST',
      machineId: machine.id,
      machineCode: machine.machineCode,
      channelId: dto.channelId,
      standardReference: dto.standardReference,
      status: 'DRAFT', // Requires formal QA signoff
      calibratedBy: {
        userId: actor.userId,
        email: actor.email,
        role: actor.role,
        technicianName: dto.technicianName
      },
      masterStandardSerial: dto.masterStandardSerial,
      masterStandardExpiry: new Date(dto.masterStandardExpiry),
      satRecord: {
        satMethod: dto.satMethod,
        targetSetpointC: dto.targetSetpointC,
        furnaceControlReadingC: dto.furnaceControlReadingC,
        testStandardReadingC: dto.testStandardReadingC,
        observedDifferenceC: Math.round(observedDiff * 10) / 10,
        maxAllowedDifferenceC: maxAllowedDiff,
        passed
      },
      overallPassed: passed,
      testDate: new Date(dto.testDate),
      expiryDate: new Date(dto.expiryDate),
      certificateNumber: dto.certificateNumber || null,
      notes: dto.notes || null
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SAT_TEST_LOGGED',
      entityType: 'CalibrationRecord',
      entityId: cal.id,
      metadata: {
        calibrationNumber,
        machineCode: machine.machineCode,
        channelId: dto.channelId,
        passed
      }
    });

    return cal;
  }

  // ==================== Calibration Approval ====================

  public async approveCalibration(
    tenantId: string,
    actor: IActorContext,
    id: string,
    dto: ApproveCalibrationDto
  ): Promise<CalibrationRecordDocument> {
    const cal = await this.repo.findCalibrationById(tenantId, id);
    if (!cal) {
      throw new NotFoundError(`Calibration Record with ID '${id}' not found`);
    }

    if (cal.status === 'APPROVED') {
      throw new BadRequestError(`Calibration '${cal.calibrationNumber}' is already APPROVED`);
    }

    if (!cal.overallPassed) {
      throw new BadRequestError(
        `Cannot approve failed calibration '${cal.calibrationNumber}'. Out-of-tolerance results must be corrected before release.`
      );
    }

    const now = new Date();
    cal.status = 'APPROVED';
    cal.approvedBy = {
      userId: actor.userId,
      email: actor.email,
      role: actor.role,
      approvedAt: now,
      comments: dto.comments || null
    };

    await cal.save();

    // Update authoritative Machine Pyrometry Compliance
    const machine = await this.machRepo.findById(tenantId, cal.machineId);
    if (machine) {
      if (cal.calibrationType === 'TUS_SURVEY') {
        machine.pyrometryCompliance.lastTusDate = cal.testDate;
        machine.pyrometryCompliance.nextTusDueDate = cal.expiryDate;
        machine.pyrometryCompliance.isTusValid = true;
        if (cal.tusRecord?.furnaceClass) {
          machine.capabilities.furnaceClass = cal.tusRecord.furnaceClass;
        }
      } else if (cal.calibrationType === 'SAT_TEST') {
        machine.pyrometryCompliance.lastSatDate = cal.testDate;
        machine.pyrometryCompliance.nextSatDueDate = cal.expiryDate;
        machine.pyrometryCompliance.isSatValid = true;
      }
      await machine.save();
    }

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `${cal.calibrationType}_APPROVED`,
      entityType: 'CalibrationRecord',
      entityId: cal.id,
      metadata: {
        calibrationNumber: cal.calibrationNumber,
        machineCode: cal.machineCode
      }
    });

    this.publishEvent(DomainEvents.MACHINE_CALIBRATION_LOGGED, tenantId, {
      calibrationId: cal.id,
      calibrationNumber: cal.calibrationNumber,
      machineId: cal.machineId,
      machineCode: cal.machineCode,
      calibrationType: cal.calibrationType
    }, actor.userId);

    return cal;
  }

  // ==================== Real-time Temperature Telemetry ====================

  public async logTelemetrySample(
    tenantId: string,
    dto: LogTelemetryDto
  ): Promise<TemperatureTelemetrySampleDocument> {
    const machine = await this.machRepo.findById(tenantId, dto.machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${dto.machineId}' not found`);
    }

    const channels = await this.repo.findChannelsByMachineId(tenantId, machine.id);
    const channelsMap = new Map<string, ThermocoupleChannelDocument>();
    for (const c of channels) channelsMap.set(c.channelId, c);

    let isExcursionAlert = false;
    const excursionMessages: string[] = [];

    const channelReadings: IChannelReading[] = dto.channelReadings.map((r) => {
      const channel = channelsMap.get(r.channelId);
      const channelType = channel?.channelType || 'RECORDING';
      const offset = channel?.calibrationOffsetC || 0.0;
      const correctedReadingC = Math.round((r.rawReadingC + offset) * 10) / 10;

      let isOvertempAlert = false;
      if (r.setpointC && correctedReadingC > r.setpointC + 15) {
        isOvertempAlert = true;
        isExcursionAlert = true;
        excursionMessages.push(
          `Zone/Channel '${r.channelId}' exceeded setpoint (${r.setpointC}°C) with reading ${correctedReadingC}°C`
        );
      }

      if (correctedReadingC > machine.thermalLimits.maxOperatingTempC) {
        isOvertempAlert = true;
        isExcursionAlert = true;
        excursionMessages.push(
          `Channel '${r.channelId}' exceeded furnace maximum rating (${machine.thermalLimits.maxOperatingTempC}°C) with ${correctedReadingC}°C`
        );
      }

      return {
        channelId: r.channelId,
        channelType,
        setpointC: r.setpointC || null,
        rawReadingC: r.rawReadingC,
        correctedReadingC,
        isOvertempAlert
      };
    });

    const sample = await this.repo.createTelemetrySample(tenantId, {
      machineId: machine.id,
      machineCode: machine.machineCode,
      jobId: dto.jobId || null,
      jobNumber: dto.jobNumber || null,
      timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      channelReadings,
      vacuumLevelMbar: dto.vacuumLevelMbar || null,
      carbonPotentialPercent: dto.carbonPotentialPercent || null,
      atmosphereGasFlowScmh: dto.atmosphereGasFlowScmh || null,
      isExcursionAlert,
      excursionDetails: excursionMessages.length > 0 ? excursionMessages.join('; ') : null
    });

    return sample;
  }

  // ==================== Compliance Evaluation & Readiness Gating ====================

  /**
   * Evaluates end-to-end Pyrometry compliance for an equipment per AMS 2750G / CQI-9
   */
  public async evaluateMachineCompliance(
    tenantId: string,
    machineId: string,
    targetTempC?: number
  ): Promise<MachinePyrometryComplianceStatus> {
    const machine = await this.machRepo.findById(tenantId, machineId);
    if (!machine || machine.isDeleted) {
      throw new NotFoundError(`Machine with ID '${machineId}' not found`);
    }

    const now = new Date();
    const alerts: string[] = [];
    let isCompliant = true;

    // 1. TUS Validity Check
    const latestTus = await this.repo.findLatestApprovedCalibration(tenantId, machine.id, 'TUS_SURVEY');
    const tusExpiry = latestTus?.expiryDate || machine.pyrometryCompliance?.nextTusDueDate;
    const isTusValid = !!tusExpiry && new Date(tusExpiry) > now;
    const daysUntilTusExpiry = tusExpiry
      ? Math.round((new Date(tusExpiry).getTime() - now.getTime()) / 86400000)
      : -1;

    if (!isTusValid) {
      isCompliant = false;
      alerts.push(`Temperature Uniformity Survey (TUS) is OVERDUE for furnace '${machine.machineCode}'`);
    } else if (daysUntilTusExpiry <= 14) {
      alerts.push(`TUS will expire in ${daysUntilTusExpiry} days`);
    }

    if (
      targetTempC !== undefined &&
      latestTus?.tusRecord &&
      (targetTempC < latestTus.tusRecord.operatingRangeMinC ||
        targetTempC > latestTus.tusRecord.operatingRangeMaxC)
    ) {
      isCompliant = false;
      alerts.push(
        `Target process temperature (${targetTempC}°C) is outside certified TUS operating range [${latestTus.tusRecord.operatingRangeMinC}°C - ${latestTus.tusRecord.operatingRangeMaxC}°C]`
      );
    }

    // 2. SAT Validity Check
    const latestSat = await this.repo.findLatestApprovedCalibration(tenantId, machine.id, 'SAT_TEST');
    const satExpiry = latestSat?.expiryDate || machine.pyrometryCompliance?.nextSatDueDate;
    const isSatValid = !!satExpiry && new Date(satExpiry) > now;
    const daysUntilSatExpiry = satExpiry
      ? Math.round((new Date(satExpiry).getTime() - now.getTime()) / 86400000)
      : -1;

    if (!isSatValid) {
      isCompliant = false;
      alerts.push(`System Accuracy Test (SAT) is OVERDUE for furnace '${machine.machineCode}'`);
    }

    // 3. Sensor Channels Calibration Check
    const channels = await this.repo.findChannelsByMachineId(tenantId, machine.id);
    const expiredChannels: Array<{
      channelId: string;
      channelType: any;
      expiresAt: Date;
    }> = [];

    let controlChannelsValid = true;
    let overtempChannelsValid = true;

    for (const c of channels) {
      const isExpired = new Date(c.expiresAt) <= now || !c.isCalibrated;
      if (isExpired) {
        expiredChannels.push({
          channelId: c.channelId,
          channelType: c.channelType,
          expiresAt: c.expiresAt
        });

        if (c.channelType === 'CONTROL') {
          controlChannelsValid = false;
          isCompliant = false;
          alerts.push(`Control thermocouple channel '${c.channelId}' calibration has EXPIRED`);
        } else if (c.channelType === 'OVERTEMPERATURE') {
          overtempChannelsValid = false;
          isCompliant = false;
          alerts.push(`Overtemperature channel '${c.channelId}' calibration has EXPIRED`);
        }
      }
    }

    let overallAlertLevel: ComplianceAlertLevel = 'COMPLIANT';
    if (!isTusValid) overallAlertLevel = 'TUS_OVERDUE';
    else if (!isSatValid) overallAlertLevel = 'SAT_OVERDUE';
    else if (expiredChannels.length > 0) overallAlertLevel = 'SENSOR_EXPIRED';
    else if (daysUntilTusExpiry <= 14) overallAlertLevel = 'TUS_EXPIRING_SOON';

    return {
      machineId: machine.id,
      machineCode: machine.machineCode,
      pyrometryStandard: machine.capabilities.pyrometryStandard,
      furnaceClass: machine.capabilities.furnaceClass,
      instrumentationType: machine.capabilities.instrumentationType,
      isCompliant,
      overallAlertLevel,
      tusStatus: {
        isValid: isTusValid,
        lastTusDate: latestTus?.testDate || machine.pyrometryCompliance?.lastTusDate,
        nextTusDueDate: tusExpiry ? new Date(tusExpiry) : null,
        operatingRangeMinC: latestTus?.tusRecord?.operatingRangeMinC,
        operatingRangeMaxC: latestTus?.tusRecord?.operatingRangeMaxC,
        daysUntilExpiry: daysUntilTusExpiry
      },
      satStatus: {
        isValid: isSatValid,
        lastSatDate: latestSat?.testDate || machine.pyrometryCompliance?.lastSatDate,
        nextSatDueDate: satExpiry ? new Date(satExpiry) : null,
        daysUntilExpiry: daysUntilSatExpiry
      },
      channelStatus: {
        totalChannels: channels.length,
        controlChannelsValid,
        overtempChannelsValid,
        expiredChannels
      },
      alerts
    };
  }

  /**
   * Production Gating: Validates machine pyrometry readiness before scheduling or starting cycle
   */
  public async validateMachinePyrometryReadiness(
    tenantId: string,
    machineId: string,
    targetTempC?: number
  ): Promise<void> {
    const compliance = await this.evaluateMachineCompliance(tenantId, machineId, targetTempC);
    if (!compliance.isCompliant) {
      throw new BadRequestError(
        `Machine '${compliance.machineCode}' failed Pyrometry Compliance Readiness: ${compliance.alerts.join('; ')}`
      );
    }
  }

  public async getCalibrationById(
    tenantId: string,
    id: string
  ): Promise<CalibrationRecordDocument> {
    const cal = await this.repo.findCalibrationById(tenantId, id);
    if (!cal) {
      throw new NotFoundError(`Calibration Record with ID '${id}' not found`);
    }
    return cal;
  }

  public async queryCalibrations(
    tenantId: string,
    query: QueryCalibrationsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CalibrationRecordDocument>> {
    return await this.repo.queryCalibrations(tenantId, query, pagination);
  }

  public async getJobTelemetry(
    tenantId: string,
    jobId: string
  ): Promise<TemperatureTelemetrySampleDocument[]> {
    return await this.repo.findTelemetryByJobId(tenantId, jobId);
  }

  // --- Helper Methods ---

  private getMaxSpreadForClass(furnaceClass: any): number {
    switch (furnaceClass) {
      case 'CLASS_1':
        return 3.0; // +/- 3°C
      case 'CLASS_2':
        return 6.0; // +/- 6°C
      case 'CLASS_3':
        return 8.0; // +/- 8°C
      case 'CLASS_4':
        return 10.0; // +/- 10°C
      case 'CLASS_5':
        return 14.0; // +/- 14°C
      default:
        return 10.0;
    }
  }
}

export const pyrometryService = new PyrometryService();
