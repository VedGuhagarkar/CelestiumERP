import { BaseRepository } from '../../core/repository/base.repository.js';
import {
  WorkforceMemberDocument,
  WorkforceShiftAllocationDocument
} from './workforce-capacity.types.js';
import { WorkforceMemberModel } from './workforce-member.model.js';
import { WorkforceShiftAllocationModel } from './workforce-shift-allocation.model.js';

class WorkforceShiftAllocationRepository extends BaseRepository<WorkforceShiftAllocationDocument> {
  constructor() {
    super(WorkforceShiftAllocationModel);
  }
}

export interface IWorkforceCapacityRepository {
  findEmployeeByCode(tenantId: string, code: string): Promise<WorkforceMemberDocument | null>;
  findEmployeeById(tenantId: string, id: string): Promise<WorkforceMemberDocument | null>;
  findEmployees(tenantId: string, filter: any): Promise<WorkforceMemberDocument[]>;
  createEmployee(tenantId: string, data: Partial<WorkforceMemberDocument>): Promise<WorkforceMemberDocument>;
  updateEmployee(tenantId: string, id: string, update: any): Promise<WorkforceMemberDocument | null>;

  generateNextAllocationNumber(tenantId: string): Promise<string>;
  findEmployeeAllocationsOnDate(
    tenantId: string,
    employeeId: string,
    date: Date,
    shift?: string
  ): Promise<WorkforceShiftAllocationDocument[]>;
  findAllocationsForShift(
    tenantId: string,
    date: Date,
    shift: string
  ): Promise<WorkforceShiftAllocationDocument[]>;
  createAllocation(
    tenantId: string,
    data: Partial<WorkforceShiftAllocationDocument>
  ): Promise<WorkforceShiftAllocationDocument>;
  findAllocationById(
    tenantId: string,
    id: string
  ): Promise<WorkforceShiftAllocationDocument | null>;
  updateAllocation(
    tenantId: string,
    id: string,
    update: any
  ): Promise<WorkforceShiftAllocationDocument | null>;
}

export class WorkforceCapacityRepository
  extends BaseRepository<WorkforceMemberDocument>
  implements IWorkforceCapacityRepository
{
  private allocationRepo = new WorkforceShiftAllocationRepository();

  constructor() {
    super(WorkforceMemberModel);
  }

  public async findEmployeeByCode(
    tenantId: string,
    code: string
  ): Promise<WorkforceMemberDocument | null> {
    return this.findOne(tenantId, { employeeCode: code.toUpperCase() });
  }

  public async findEmployeeById(
    tenantId: string,
    id: string
  ): Promise<WorkforceMemberDocument | null> {
    return this.findById(tenantId, id);
  }

  public async findEmployees(
    tenantId: string,
    filter: any = {}
  ): Promise<WorkforceMemberDocument[]> {
    return this.find(tenantId, filter);
  }

  public async createEmployee(
    tenantId: string,
    data: Partial<WorkforceMemberDocument>
  ): Promise<WorkforceMemberDocument> {
    return this.create(tenantId, data);
  }

  public async updateEmployee(
    tenantId: string,
    id: string,
    update: any
  ): Promise<WorkforceMemberDocument | null> {
    return this.updateById(tenantId, id, update);
  }

  public async generateNextAllocationNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `WFA-${yearMonth}-`;

    const latest = await WorkforceShiftAllocationModel.findOne({
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

  public async findEmployeeAllocationsOnDate(
    tenantId: string,
    employeeId: string,
    date: Date,
    shift?: string
  ): Promise<WorkforceShiftAllocationDocument[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const query: any = {
      tenantId,
      employeeId,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
      isDeleted: false,
      date: { $gte: startOfDay, $lte: endOfDay }
    };

    if (shift) {
      query.shift = shift;
    }

    return WorkforceShiftAllocationModel.find(query).exec();
  }

  public async findAllocationsForShift(
    tenantId: string,
    date: Date,
    shift: string
  ): Promise<WorkforceShiftAllocationDocument[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return WorkforceShiftAllocationModel.find({
      tenantId,
      shift,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
      isDeleted: false,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).exec();
  }

  public async createAllocation(
    tenantId: string,
    data: Partial<WorkforceShiftAllocationDocument>
  ): Promise<WorkforceShiftAllocationDocument> {
    return this.allocationRepo.create(tenantId, data);
  }

  public async findAllocationById(
    tenantId: string,
    id: string
  ): Promise<WorkforceShiftAllocationDocument | null> {
    return this.allocationRepo.findById(tenantId, id);
  }

  public async updateAllocation(
    tenantId: string,
    id: string,
    update: any
  ): Promise<WorkforceShiftAllocationDocument | null> {
    return this.allocationRepo.updateById(tenantId, id, update);
  }
}

export const workforceCapacityRepository = new WorkforceCapacityRepository();
