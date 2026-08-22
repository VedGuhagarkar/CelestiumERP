import mongoose from 'mongoose';
import { MachineModel } from './machine.model.js';
import {
  MachineDocument,
  QueryMachinesDto,
  MachineFleetSummary,
  MachineStatus,
  MachineCategory
} from './machine.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IMachineRepository {
  create(tenantId: string, data: Partial<MachineDocument>): Promise<MachineDocument>;
  findById(tenantId: string, id: string): Promise<MachineDocument | null>;
  findByCode(tenantId: string, machineCode: string): Promise<MachineDocument | null>;
  update(tenantId: string, id: string, data: Partial<MachineDocument>): Promise<MachineDocument | null>;
  delete(tenantId: string, id: string): Promise<MachineDocument | null>;
  query(
    tenantId: string,
    query: QueryMachinesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<MachineDocument>>;
  findCapableMachines(
    tenantId: string,
    criteria: {
      processFamily?: string;
      targetTemperatureC?: number;
      requiredLoadWeightKg?: number;
      status?: MachineStatus;
    }
  ): Promise<MachineDocument[]>;
  getFleetSummary(tenantId: string): Promise<MachineFleetSummary>;
}

export class MachineRepository implements IMachineRepository {
  public async create(tenantId: string, data: Partial<MachineDocument>): Promise<MachineDocument> {
    const machine = new MachineModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await machine.save();
  }

  public async findById(tenantId: string, id: string): Promise<MachineDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || mongoose.connection.readyState === 0) {
      return null;
    }
    return await MachineModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findByCode(tenantId: string, machineCode: string): Promise<MachineDocument | null> {
    if (mongoose.connection.readyState === 0) {
      return null;
    }
    return await MachineModel.findOne({
      tenantId,
      machineCode: machineCode.toUpperCase(),
      isDeleted: false
    });
  }

  public async update(
    tenantId: string,
    id: string,
    data: Partial<MachineDocument>
  ): Promise<MachineDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await MachineModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async delete(tenantId: string, id: string): Promise<MachineDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await MachineModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: { isDeleted: true, status: 'OFFLINE' } },
      { new: true }
    );
  }

  public async query(
    tenantId: string,
    query: QueryMachinesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<MachineDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    if (query.processFamily) {
      filter['capabilities.supportedProcessFamilies'] = query.processFamily;
    }
    if (query.plant) filter['location.plant'] = query.plant;
    if (query.bay) filter['location.bay'] = query.bay;

    if (query.targetTemperatureC !== undefined) {
      const temp = Number(query.targetTemperatureC);
      filter['thermalLimits.minOperatingTempC'] = { $lte: temp };
      filter['thermalLimits.maxOperatingTempC'] = { $gte: temp };
    }

    if (query.requiredLoadWeightKg !== undefined) {
      const weight = Number(query.requiredLoadWeightKg);
      filter['workingDimensions.maxLoadWeightKg'] = { $gte: weight };
    }

    if (query.search) {
      filter.$or = [
        { machineCode: { $regex: query.search, $options: 'i' } },
        { name: { $regex: query.search, $options: 'i' } },
        { 'technicalSpecs.manufacturer': { $regex: query.search, $options: 'i' } },
        { 'technicalSpecs.modelNumber': { $regex: query.search, $options: 'i' } },
        { 'location.bay': { $regex: query.search, $options: 'i' } }
      ];
    }

    const total = await MachineModel.countDocuments(filter);
    const sort = pagination.sort || { machineCode: 1 };
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;

    const data = await MachineModel.find(filter)
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

  public async findCapableMachines(
    tenantId: string,
    criteria: {
      processFamily?: string;
      targetTemperatureC?: number;
      requiredLoadWeightKg?: number;
      status?: MachineStatus;
    }
  ): Promise<MachineDocument[]> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (criteria.processFamily) {
      filter['capabilities.supportedProcessFamilies'] = criteria.processFamily;
    }

    if (criteria.targetTemperatureC !== undefined) {
      filter['thermalLimits.minOperatingTempC'] = { $lte: criteria.targetTemperatureC };
      filter['thermalLimits.maxOperatingTempC'] = { $gte: criteria.targetTemperatureC };
    }

    if (criteria.requiredLoadWeightKg !== undefined) {
      filter['workingDimensions.maxLoadWeightKg'] = { $gte: criteria.requiredLoadWeightKg };
    }

    if (criteria.status) {
      filter.status = criteria.status;
    }

    return await MachineModel.find(filter).sort({ machineCode: 1 });
  }

  public async getFleetSummary(tenantId: string): Promise<MachineFleetSummary> {
    const machines = await MachineModel.find({ tenantId, isDeleted: false });

    const statusCounts: Record<MachineStatus, number> = {
      IDLE: 0,
      RUNNING: 0,
      MAINTENANCE: 0,
      BREAKDOWN: 0,
      OFFLINE: 0,
      CALIBRATING: 0
    };

    const categoryCounts: Record<MachineCategory, number> = {
      FURNACE_VACUUM: 0,
      FURNACE_ATMOSPHERE_SEALED_QUENCH: 0,
      FURNACE_PIT: 0,
      FURNACE_BOX: 0,
      FURNACE_CONTINUOUS_BELT: 0,
      FURNACE_INDUCTION: 0,
      QUENCH_TANK: 0,
      TEMPERING_OVEN: 0,
      CRYOGENIC_CHAMBER: 0,
      WASHING_LINE: 0,
      SHOT_BLASTER: 0,
      STRAIGHTENING_PRESS: 0,
      AUXILIARY_EQUIPMENT: 0
    };

    let totalLoadCapacityKg = 0;
    let compliantCount = 0;
    let overdueCount = 0;

    for (const m of machines) {
      if (statusCounts[m.status] !== undefined) {
        statusCounts[m.status]++;
      }
      if (categoryCounts[m.category] !== undefined) {
        categoryCounts[m.category]++;
      }

      totalLoadCapacityKg += m.workingDimensions?.maxLoadWeightKg || 0;

      if (m.pyrometryCompliance?.isTusValid && m.pyrometryCompliance?.isSatValid) {
        compliantCount++;
      } else {
        overdueCount++;
      }
    }

    const availableCount = statusCounts.IDLE + statusCounts.RUNNING;
    const fleetAvailabilityPercent =
      machines.length > 0 ? Math.round((availableCount / machines.length) * 1000) / 10 : 0;

    return {
      totalMachines: machines.length,
      statusCounts,
      categoryCounts,
      totalLoadCapacityKg,
      fleetAvailabilityPercent,
      pyrometryCompliance: {
        compliantCount,
        overdueCount
      }
    };
  }
}

export const machineRepository = new MachineRepository();
