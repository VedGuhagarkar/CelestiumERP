import {
  ThermocoupleChannelModel,
  CalibrationRecordModel,
  TemperatureTelemetrySampleModel
} from './pyrometry.model.js';
import {
  ThermocoupleChannelDocument,
  CalibrationRecordDocument,
  TemperatureTelemetrySampleDocument,
  QueryCalibrationsDto,
  QueryChannelsDto,
  CalibrationType
} from './pyrometry.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IPyrometryRepository {
  // Channels
  createChannel(
    tenantId: string,
    data: Partial<ThermocoupleChannelDocument>
  ): Promise<ThermocoupleChannelDocument>;
  findChannelById(tenantId: string, id: string): Promise<ThermocoupleChannelDocument | null>;
  findChannelByChannelId(tenantId: string, channelId: string): Promise<ThermocoupleChannelDocument | null>;
  findChannelsByMachineId(tenantId: string, machineId: string): Promise<ThermocoupleChannelDocument[]>;
  updateChannel(
    tenantId: string,
    id: string,
    data: Partial<ThermocoupleChannelDocument>
  ): Promise<ThermocoupleChannelDocument | null>;
  queryChannels(
    tenantId: string,
    query: QueryChannelsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ThermocoupleChannelDocument>>;

  // Calibrations
  createCalibration(
    tenantId: string,
    data: Partial<CalibrationRecordDocument>
  ): Promise<CalibrationRecordDocument>;
  findCalibrationById(tenantId: string, id: string): Promise<CalibrationRecordDocument | null>;
  findLatestApprovedCalibration(
    tenantId: string,
    machineId: string,
    type: CalibrationType
  ): Promise<CalibrationRecordDocument | null>;
  updateCalibration(
    tenantId: string,
    id: string,
    data: Partial<CalibrationRecordDocument>
  ): Promise<CalibrationRecordDocument | null>;
  queryCalibrations(
    tenantId: string,
    query: QueryCalibrationsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CalibrationRecordDocument>>;
  generateNextCalibrationNumber(tenantId: string, type: CalibrationType): Promise<string>;

  // Telemetry
  createTelemetrySample(
    tenantId: string,
    data: Partial<TemperatureTelemetrySampleDocument>
  ): Promise<TemperatureTelemetrySampleDocument>;
  findTelemetryByJobId(
    tenantId: string,
    jobId: string,
    limit?: number
  ): Promise<TemperatureTelemetrySampleDocument[]>;
  findLatestTelemetryByMachineId(
    tenantId: string,
    machineId: string
  ): Promise<TemperatureTelemetrySampleDocument | null>;
}

export class PyrometryRepository implements IPyrometryRepository {
  // --- Channels ---

  public async createChannel(
    tenantId: string,
    data: Partial<ThermocoupleChannelDocument>
  ): Promise<ThermocoupleChannelDocument> {
    const channel = new ThermocoupleChannelModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await channel.save();
  }

  public async findChannelById(
    tenantId: string,
    id: string
  ): Promise<ThermocoupleChannelDocument | null> {
    return await ThermocoupleChannelModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findChannelByChannelId(
    tenantId: string,
    channelId: string
  ): Promise<ThermocoupleChannelDocument | null> {
    return await ThermocoupleChannelModel.findOne({
      tenantId,
      channelId: channelId.toUpperCase(),
      isDeleted: false
    });
  }

  public async findChannelsByMachineId(
    tenantId: string,
    machineId: string
  ): Promise<ThermocoupleChannelDocument[]> {
    return await ThermocoupleChannelModel.find({
      tenantId,
      machineId,
      isDeleted: false,
      isActive: true
    }).sort({ furnaceZoneNumber: 1, channelType: 1 });
  }

  public async updateChannel(
    tenantId: string,
    id: string,
    data: Partial<ThermocoupleChannelDocument>
  ): Promise<ThermocoupleChannelDocument | null> {
    return await ThermocoupleChannelModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async queryChannels(
    tenantId: string,
    query: QueryChannelsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ThermocoupleChannelDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.machineId) filter.machineId = query.machineId;
    if (query.channelType) filter.channelType = query.channelType;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    if (query.search) {
      filter.$or = [
        { channelId: { $regex: query.search, $options: 'i' } },
        { machineCode: { $regex: query.search, $options: 'i' } },
        { sensorSerialNumber: { $regex: query.search, $options: 'i' } },
        { locationDescription: { $regex: query.search, $options: 'i' } }
      ];
    }

    const total = await ThermocoupleChannelModel.countDocuments(filter);
    const sort = pagination.sort || { furnaceZoneNumber: 1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await ThermocoupleChannelModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // --- Calibrations ---

  public async createCalibration(
    tenantId: string,
    data: Partial<CalibrationRecordDocument>
  ): Promise<CalibrationRecordDocument> {
    const cal = new CalibrationRecordModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await cal.save();
  }

  public async findCalibrationById(
    tenantId: string,
    id: string
  ): Promise<CalibrationRecordDocument | null> {
    return await CalibrationRecordModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findLatestApprovedCalibration(
    tenantId: string,
    machineId: string,
    type: CalibrationType
  ): Promise<CalibrationRecordDocument | null> {
    return await CalibrationRecordModel.findOne({
      tenantId,
      machineId,
      calibrationType: type,
      status: 'APPROVED',
      isDeleted: false
    }).sort({ testDate: -1 });
  }

  public async updateCalibration(
    tenantId: string,
    id: string,
    data: Partial<CalibrationRecordDocument>
  ): Promise<CalibrationRecordDocument | null> {
    return await CalibrationRecordModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async queryCalibrations(
    tenantId: string,
    query: QueryCalibrationsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CalibrationRecordDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.machineId) filter.machineId = query.machineId;
    if (query.channelId) filter.channelId = query.channelId;
    if (query.calibrationType) filter.calibrationType = query.calibrationType;
    if (query.status) filter.status = query.status;

    if (query.search) {
      filter.$or = [
        { calibrationNumber: { $regex: query.search, $options: 'i' } },
        { machineCode: { $regex: query.search, $options: 'i' } },
        { masterStandardSerial: { $regex: query.search, $options: 'i' } },
        { certificateNumber: { $regex: query.search, $options: 'i' } }
      ];
    }

    const total = await CalibrationRecordModel.countDocuments(filter);
    const sort = pagination.sort || { testDate: -1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await CalibrationRecordModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateNextCalibrationNumber(
    tenantId: string,
    type: CalibrationType
  ): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    let prefix = `CAL-${yearMonth}-`;
    if (type === 'TUS_SURVEY') prefix = `TUS-${yearMonth}-`;
    else if (type === 'SAT_TEST') prefix = `SAT-${yearMonth}-`;

    const latest = await CalibrationRecordModel.findOne({
      tenantId,
      calibrationNumber: { $regex: `^${prefix}` }
    })
      .sort({ calibrationNumber: -1 })
      .select('calibrationNumber')
      .lean();

    let seq = 1;
    if (latest && (latest as any).calibrationNumber) {
      const parts = (latest as any).calibrationNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // --- Telemetry ---

  public async createTelemetrySample(
    tenantId: string,
    data: Partial<TemperatureTelemetrySampleDocument>
  ): Promise<TemperatureTelemetrySampleDocument> {
    const sample = new TemperatureTelemetrySampleModel({
      ...data,
      tenantId
    });
    return await sample.save();
  }

  public async findTelemetryByJobId(
    tenantId: string,
    jobId: string,
    limit: number = 100
  ): Promise<TemperatureTelemetrySampleDocument[]> {
    return await TemperatureTelemetrySampleModel.find({
      tenantId,
      jobId
    })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  public async findLatestTelemetryByMachineId(
    tenantId: string,
    machineId: string
  ): Promise<TemperatureTelemetrySampleDocument | null> {
    return await TemperatureTelemetrySampleModel.findOne({
      tenantId,
      machineId
    }).sort({ timestamp: -1 });
  }
}

export const pyrometryRepository = new PyrometryRepository();
