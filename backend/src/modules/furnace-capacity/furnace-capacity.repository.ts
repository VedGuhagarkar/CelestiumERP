import { BaseRepository } from '../../core/repository/base.repository.js';
import {
  FurnaceDocument,
  FurnaceAllocationDocument
} from './furnace-capacity.types.js';
import { FurnaceModel } from './furnace.model.js';
import { FurnaceAllocationModel } from './furnace-allocation.model.js';

class FurnaceAllocationRepository extends BaseRepository<FurnaceAllocationDocument> {
  constructor() {
    super(FurnaceAllocationModel);
  }
}

export interface IFurnaceCapacityRepository {
  findFurnaceByCode(tenantId: string, code: string): Promise<FurnaceDocument | null>;
  findFurnaceById(tenantId: string, id: string): Promise<FurnaceDocument | null>;
  findFurnaces(tenantId: string, filter: any): Promise<FurnaceDocument[]>;
  createFurnace(tenantId: string, data: Partial<FurnaceDocument>): Promise<FurnaceDocument>;
  updateFurnace(tenantId: string, id: string, update: any): Promise<FurnaceDocument | null>;

  generateNextAllocationNumber(tenantId: string): Promise<string>;
  findOverlappingAllocations(
    tenantId: string,
    furnaceId: string,
    start: Date,
    end: Date,
    excludeId?: string
  ): Promise<FurnaceAllocationDocument[]>;
  findAllocationsInPeriod(
    tenantId: string,
    furnaceId: string,
    start: Date,
    end: Date
  ): Promise<FurnaceAllocationDocument[]>;
  createAllocation(
    tenantId: string,
    data: Partial<FurnaceAllocationDocument>
  ): Promise<FurnaceAllocationDocument>;
  findAllocationById(tenantId: string, id: string): Promise<FurnaceAllocationDocument | null>;
  updateAllocation(
    tenantId: string,
    id: string,
    update: any
  ): Promise<FurnaceAllocationDocument | null>;
}

export class FurnaceCapacityRepository
  extends BaseRepository<FurnaceDocument>
  implements IFurnaceCapacityRepository
{
  private allocationRepo = new FurnaceAllocationRepository();

  constructor() {
    super(FurnaceModel);
  }

  public async findFurnaceByCode(tenantId: string, code: string): Promise<FurnaceDocument | null> {
    return this.findOne(tenantId, { furnaceCode: code.toUpperCase() });
  }

  public async findFurnaceById(tenantId: string, id: string): Promise<FurnaceDocument | null> {
    return this.findById(tenantId, id);
  }

  public async findFurnaces(tenantId: string, filter: any = {}): Promise<FurnaceDocument[]> {
    return this.find(tenantId, filter);
  }

  public async createFurnace(
    tenantId: string,
    data: Partial<FurnaceDocument>
  ): Promise<FurnaceDocument> {
    return this.create(tenantId, data);
  }

  public async updateFurnace(
    tenantId: string,
    id: string,
    update: any
  ): Promise<FurnaceDocument | null> {
    return this.updateById(tenantId, id, update);
  }

  public async generateNextAllocationNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `FNA-${yearMonth}-`;

    const latest = await FurnaceAllocationModel.findOne({
      tenantId,
      allocationNumber: { $regex: `^${prefix}` }
    })
      .sort({ allocationNumber: -1 })
      .exec();

    if (!latest) {
      return `${prefix}0001`;
    }

    const currentSeq = parseInt(latest.allocationNumber.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async findOverlappingAllocations(
    tenantId: string,
    furnaceId: string,
    start: Date,
    end: Date,
    excludeId?: string
  ): Promise<FurnaceAllocationDocument[]> {
    const query: any = {
      tenantId,
      furnaceId,
      status: { $in: ['BOOKED', 'IN_PROGRESS'] },
      isDeleted: false,
      startTime: { $lt: end },
      endTime: { $gt: start }
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    return FurnaceAllocationModel.find(query).exec();
  }

  public async findAllocationsInPeriod(
    tenantId: string,
    furnaceId: string,
    start: Date,
    end: Date
  ): Promise<FurnaceAllocationDocument[]> {
    return FurnaceAllocationModel.find({
      tenantId,
      furnaceId,
      status: { $in: ['BOOKED', 'IN_PROGRESS', 'COMPLETED'] },
      isDeleted: false,
      startTime: { $gte: start, $lte: end }
    }).exec();
  }

  public async createAllocation(
    tenantId: string,
    data: Partial<FurnaceAllocationDocument>
  ): Promise<FurnaceAllocationDocument> {
    return this.allocationRepo.create(tenantId, data);
  }

  public async findAllocationById(
    tenantId: string,
    id: string
  ): Promise<FurnaceAllocationDocument | null> {
    return this.allocationRepo.findById(tenantId, id);
  }

  public async updateAllocation(
    tenantId: string,
    id: string,
    update: any
  ): Promise<FurnaceAllocationDocument | null> {
    return this.allocationRepo.updateById(tenantId, id, update);
  }
}

export const furnaceCapacityRepository = new FurnaceCapacityRepository();
