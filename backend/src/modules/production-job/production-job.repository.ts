import mongoose from 'mongoose';
import { BaseRepository } from '../../core/repository/base.repository.js';
import { ProductionJobDocument, JobStatus } from './production-job.types.js';
import { ProductionJobModel } from './production-job.model.js';
import { PaginatedResult, PaginationOptions } from '../../core/types/pagination.js';
import { BadRequestError } from '../../core/errors/app-error.js';

export interface IProductionJobRepository {
  generateNextJobNumber(tenantId: string): Promise<string>;
  generateNextBatchOrderNumber(tenantId: string): Promise<string>;
  findJobByNumber(tenantId: string, jobNumber: string): Promise<ProductionJobDocument | null>;
  findByPlanId(tenantId: string, planId: string): Promise<ProductionJobDocument[]>;
  findJobsByPlanId(tenantId: string, planId: string): Promise<ProductionJobDocument[]>;
  findByPoId(tenantId: string, poId: string): Promise<ProductionJobDocument[]>;
  findByGrnId(tenantId: string, grnId: string): Promise<ProductionJobDocument[]>;
  findInProductionJobsForPo(tenantId: string, poId: string): Promise<ProductionJobDocument[]>;
  findInProductionJobsForGrn(tenantId: string, grnId: string): Promise<ProductionJobDocument[]>;
  findByIdempotencyKey(
    tenantId: string,
    planIdOrKey: string,
    idempotencyKey?: string
  ): Promise<ProductionJobDocument | null>;
  queryJobs(
    tenantId: string,
    filters: any,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ProductionJobDocument>>;
  findActiveQueueJobs(tenantId: string, filters?: any): Promise<ProductionJobDocument[]>;
  findWaitingForProductionQueue(tenantId: string, filters?: any): Promise<ProductionJobDocument[]>;
  findInProductionQueue(tenantId: string, filters?: any): Promise<ProductionJobDocument[]>;
  findWaitingForInspectionQueue(tenantId: string, filters?: any): Promise<ProductionJobDocument[]>;
  findInInspectionQueue(tenantId: string, filters?: any): Promise<ProductionJobDocument[]>;
  findWaitingForDispatchQueue(tenantId: string, filters?: any): Promise<ProductionJobDocument[]>;
  findInspectionFailedQueue(tenantId: string, filters?: any): Promise<ProductionJobDocument[]>;
  atomicTakeForProduction(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null>;
  atomicApproveForInspection(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null>;
  atomicTakeForInspection(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null>;
  atomicApproveForDispatch(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null>;
  atomicFailInspection(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null>;
  findConflictingJobs(
    tenantId: string,
    furnaceId: string,
    startDate: Date,
    endDate: Date,
    excludeJobId?: string
  ): Promise<ProductionJobDocument[]>;
  findById(tenantId: string, id: string): Promise<ProductionJobDocument | null>;
  find(query?: any): Promise<ProductionJobDocument[]>;
  create(tenantId: string, data: Partial<ProductionJobDocument>): Promise<ProductionJobDocument>;
  updateById(tenantId: string, id: string, update: any): Promise<ProductionJobDocument | null>;
}

export class ProductionJobRepository
  extends BaseRepository<ProductionJobDocument>
  implements IProductionJobRepository
{
  constructor() {
    super(ProductionJobModel);
  }

  public override async findById(
    tenantId: string,
    id: string
  ): Promise<ProductionJobDocument | null> {
    if (!id || typeof id !== 'string') return null;
    if (mongoose.isValidObjectId(id)) {
      const doc = await super.findById(tenantId, id);
      if (doc) return doc;
    }
    return this.findOne(tenantId, {
      $or: [
        { jobNumber: id.toUpperCase() },
        { jobNumber: new RegExp(`^${id}$`, 'i') },
        { boNumber: id.toUpperCase() },
        { boNumber: new RegExp(`^${id}$`, 'i') }
      ]
    });
  }

  public override async updateById(
    tenantId: string,
    id: string,
    update: any,
    options: any = { new: true }
  ): Promise<ProductionJobDocument | null> {
    const existing = await this.findById(tenantId, id);
    if (existing) {
      const updateKeys = Object.keys(update?.$set || update);

      // Recipe snapshot is permanently immutable once established
      if (updateKeys.includes('recipeSnapshot') || Object.keys(update).some((k) => k.startsWith('recipeSnapshot'))) {
        throw new BadRequestError(
          `Recipe Protection Violation: Recipe snapshot and revision governing Batch Order '${existing.boNumber || existing.jobNumber}' are immutable and cannot be rewritten.`
        );
      }

      // In-Production Lock Interceptor
      if (existing.inProduction || (existing.workflowState as any)?.inProduction || existing.status === 'IN_PRODUCTION') {
        const inProdForbiddenFields = [
          'processDetails',
          'customer',
          'item',
          'poId',
          'poNumber',
          'grnId',
          'grnNumber',
          'boNumber',
          'batchOrderNumber',
          'recipeSnapshot',
          'specificationSnapshot',
          'materialAllocations',
          'planId',
          'planNumber',
          'timeline.plannedStartDate',
          'timeline.targetCompletionDate',
          'quantity.targetQuantity',
          'quantity.allocatedQuantity'
        ];
        const isAttemptingLockedField = inProdForbiddenFields.some((field) => updateKeys.includes(field));
        if (isAttemptingLockedField) {
          throw new BadRequestError(
            `In-Production Lock Violation: Batch Order '${existing.boNumber || existing.jobNumber}' is locked against modifications while in production. Only authorized production execution may modify production-owned fields.`
          );
        }
      }

      // Post-Production Historical Integrity Interceptor
      const isPostProduction =
        existing.waitingForInspection ||
        (existing.workflowState as any)?.waitingForInspection ||
        existing.inInspection ||
        (existing.workflowState as any)?.inInspection ||
        existing.waitingForDispatch ||
        (existing.workflowState as any)?.waitingForDispatch ||
        existing.dispatched ||
        (existing.workflowState as any)?.dispatched ||
        existing.inspection ||
        (existing.workflowState as any)?.inspection ||
        existing.status === 'WAITING_FOR_INSPECTION' ||
        existing.status === 'IN_INSPECTION' ||
        existing.status === 'WAITING_FOR_DISPATCH' ||
        existing.status === 'INSPECTION' ||
        existing.status === 'QUALITY_CHECK' ||
        existing.status === 'STORAGE' ||
        existing.status === 'READY_FOR_DISPATCH' ||
        existing.status === 'DISPATCHED' ||
        existing.status === 'COMPLETED';

      if (isPostProduction) {
        const postProdForbiddenFields = [
          'execution.furnaceCharge',
          'execution.stageProgress',
          'processDetails',
          'customer',
          'item',
          'poId',
          'poNumber',
          'grnId',
          'grnNumber',
          'boNumber',
          'batchOrderNumber',
          'recipeSnapshot',
          'specificationSnapshot',
          'materialAllocations',
          'planId',
          'planNumber',
          'timeline.plannedStartDate',
          'timeline.targetCompletionDate',
          'quantity.loadedQuantity',
          'quantity.completedQuantity',
          'quantity.scrappedQuantity',
          'quantity.targetQuantity',
          'quantity.allocatedQuantity',
          'assignedFurnaceId',
          'assignedOperatorId',
          'equipmentAssignment',
          'operatorAssignment'
        ];
        const isAttemptingPostProdField = postProdForbiddenFields.some((field) =>
          updateKeys.includes(field) ||
          updateKeys.some((k) => k === field || k.startsWith(field + '.'))
        );
        if (isAttemptingPostProdField) {
          throw new BadRequestError(
            `Post-Production Lock Violation: Batch Order '${existing.boNumber || existing.jobNumber}' is locked against modifications once production has completed and entered Quality Inspection.`
          );
        }
      }
    }
    return super.updateById(tenantId, id, update, options);
  }

  public async findInProductionJobsForPo(
    tenantId: string,
    poId: string
  ): Promise<ProductionJobDocument[]> {
    return this.model
      .find({
        tenantId,
        isDeleted: false,
        $and: [
          {
            $or: [{ poId }, { 'genealogy.whichPo.poId': poId }]
          },
          {
            $or: [
              { inProduction: true },
              { 'workflowState.inProduction': true },
              { status: 'IN_PRODUCTION' }
            ]
          }
        ]
      })
      .exec();
  }

  public async findInProductionJobsForGrn(
    tenantId: string,
    grnId: string
  ): Promise<ProductionJobDocument[]> {
    return this.model
      .find({
        tenantId,
        isDeleted: false,
        $and: [
          {
            $or: [{ grnId }, { 'genealogy.whichGrn.grnId': grnId }]
          },
          {
            $or: [
              { inProduction: true },
              { 'workflowState.inProduction': true },
              { status: 'IN_PRODUCTION' }
            ]
          }
        ]
      })
      .exec();
  }

  public async generateNextJobNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `JOB-${yearMonth}-`;

    const latest = await this.model
      .findOne({ tenantId, jobNumber: { $regex: `^${prefix}` } })
      .sort({ jobNumber: -1 })
      .exec();

    if (!latest) {
      return `${prefix}0001`;
    }

    const currentSeq = parseInt(latest.jobNumber.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async generateNextBatchOrderNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `BO-${yearMonth}-`;

    const latest = await this.model
      .findOne({
        tenantId,
        $or: [
          { boNumber: { $regex: `^${prefix}` } },
          { jobNumber: { $regex: `^${prefix}` } }
        ]
      })
      .sort({ boNumber: -1, jobNumber: -1, createdAt: -1 })
      .exec();

    if (!latest) {
      return `${prefix}0001`;
    }

    const numStr = latest.boNumber || latest.jobNumber || '';
    const parts = numStr.split('-');
    const currentSeq = parseInt(parts[parts.length - 1], 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async findByPoId(
    tenantId: string,
    poId: string
  ): Promise<ProductionJobDocument[]> {
    return this.model
      .find({ tenantId, poId, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findByGrnId(
    tenantId: string,
    grnId: string
  ): Promise<ProductionJobDocument[]> {
    return this.model
      .find({ tenantId, grnId, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findJobByNumber(
    tenantId: string,
    jobNumber: string
  ): Promise<ProductionJobDocument | null> {
    return this.model
      .findOne({ tenantId, jobNumber: jobNumber.toUpperCase(), isDeleted: false })
      .exec();
  }

  public async findByPlanId(
    tenantId: string,
    planId: string
  ): Promise<ProductionJobDocument[]> {
    return this.model
      .find({ tenantId, planId, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findJobsByPlanId(
    tenantId: string,
    planId: string
  ): Promise<ProductionJobDocument[]> {
    return this.findByPlanId(tenantId, planId);
  }

  public async findByIdempotencyKey(
    tenantId: string,
    planIdOrKey: string,
    idempotencyKey?: string
  ): Promise<ProductionJobDocument | null> {
    const key = idempotencyKey || planIdOrKey;
    const query: any = { tenantId, idempotencyKey: key, isDeleted: false };
    if (idempotencyKey && planIdOrKey) {
      query.planId = planIdOrKey;
    }
    return this.model.findOne(query).exec();
  }

  public async queryJobs(
    tenantId: string,
    filters: any,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ProductionJobDocument>> {
    const query: any = { tenantId, isDeleted: false };

    if (filters.status) query.status = filters.status;
    if (filters.furnaceId) query['equipmentAssignment.furnaceId'] = filters.furnaceId;
    if (filters.itemCode) query['item.itemCode'] = filters.itemCode.toUpperCase();
    if (filters.planId) query.planId = filters.planId;
    if (filters.poId) query.poId = filters.poId;
    if (filters.grnId) query.grnId = filters.grnId;
    if (filters.boNumber) query.$or = [{ boNumber: filters.boNumber }, { jobNumber: filters.boNumber }];
    if (filters.priority) query.priority = filters.priority;

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { jobNumber: searchRegex },
        { boNumber: searchRegex },
        { poNumber: searchRegex },
        { grnNumber: searchRegex },
        { planNumber: searchRegex },
        { 'item.itemCode': searchRegex },
        { 'item.itemName': searchRegex },
        { 'customer.customerName': searchRegex }
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort(pagination.sort || { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(query).exec()
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages
    };
  }

  public async findActiveQueueJobs(
    tenantId: string,
    filters: any = {}
  ): Promise<ProductionJobDocument[]> {
    return this.findWaitingForProductionQueue(tenantId, filters);
  }

  public async findWaitingForProductionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<ProductionJobDocument[]> {
    const query: any = {
      tenantId,
      $and: [
        {
          $or: [
            { 'workflowState.waitingForProduction': true },
            { waitingForProduction: true },
            { 'workflow.waitingForProduction': true }
          ]
        },
        {
          $or: [
            { status: 'WAITING_FOR_PRODUCTION' },
            { status: { $exists: false } }
          ]
        }
      ],
      'workflowState.inProduction': { $ne: true },
      inProduction: { $ne: true },
      'workflowState.waitingForInspection': { $ne: true },
      waitingForInspection: { $ne: true },
      isDeleted: false
    };

    if (filters.furnaceId) query['equipmentAssignment.furnaceId'] = filters.furnaceId;
    if (filters.priority) query.priority = filters.priority;

    return this.model
      .find(query)
      .sort({ priority: 1, 'timeline.targetCompletionDate': 1, createdAt: -1 })
      .exec();
  }

  public async findInProductionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<ProductionJobDocument[]> {
    const query: any = {
      tenantId,
      $or: [
        { inProduction: true },
        { status: 'IN_PRODUCTION' },
        { status: 'IN_PROGRESS' }
      ],
      waitingForInspection: { $ne: true },
      isDeleted: false
    };

    if (filters.furnaceId) query['equipmentAssignment.furnaceId'] = filters.furnaceId;

    return this.model
      .find(query)
      .sort({ 'timeline.actualStartDate': -1, updatedAt: -1 })
      .exec();
  }

  public async findWaitingForInspectionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<ProductionJobDocument[]> {
    const query: any = {
      tenantId,
      $and: [
        {
          $or: [
            { 'workflowState.waitingForInspection': true },
            { waitingForInspection: true },
            { 'workflow.waitingForInspection': true }
          ]
        }
      ],
      // Strictly exclude any incompatible workflow states
      'workflowState.inInspection': { $ne: true },
      inInspection: { $ne: true },
      'workflowState.waitingForDispatch': { $ne: true },
      waitingForDispatch: { $ne: true },
      'workflowState.dispatched': { $ne: true },
      dispatched: { $ne: true },
      'workflowState.inspection': { $ne: true },
      'workflowState.inProduction': { $ne: true },
      inProduction: { $ne: true },
      'workflowState.waitingForProduction': { $ne: true },
      status: {
        $nin: [
          'IN_PRODUCTION',
          'IN_INSPECTION',
          'WAITING_FOR_DISPATCH',
          'DISPATCHED',
          'COMPLETED',
          'CANCELLED',
          'INSPECTION'
        ]
      },
      isDeleted: false
    };

    if (filters.furnaceId) {
      query['equipmentAssignment.furnaceId'] = filters.furnaceId;
    }
    if (filters.customerId) {
      query.customerId = filters.customerId;
    }

    return this.model
      .find(query)
      .sort({ 'timeline.actualCompletionDate': -1, updatedAt: -1 })
      .exec();
  }

  public async atomicTakeForProduction(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null> {
    const identifierMatches: any[] = [{ jobNumber: jobId.toUpperCase() }, { boNumber: jobId.toUpperCase() }];
    if (mongoose.isValidObjectId(jobId)) {
      identifierMatches.unshift({ _id: jobId });
    }

    const filter: any = {
      tenantId,
      $or: identifierMatches,
      $and: [
        {
          $or: [
            { 'workflowState.waitingForProduction': true },
            { waitingForProduction: true },
            { 'workflow.waitingForProduction': true }
          ]
        }
      ],
      'workflowState.inProduction': { $ne: true },
      inProduction: { $ne: true },
      isDeleted: false
    };

    return this.model.findOneAndUpdate(filter, updateData, { new: true }).exec();
  }

  public async atomicApproveForInspection(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null> {
    const identifierMatches: any[] = [{ jobNumber: jobId.toUpperCase() }, { boNumber: jobId.toUpperCase() }];
    if (mongoose.isValidObjectId(jobId)) {
      identifierMatches.unshift({ _id: jobId });
    }

    const filter: any = {
      tenantId,
      $or: identifierMatches,
      isDeleted: false,
      $and: [
        {
          $or: [
            { inProduction: true },
            { 'workflowState.inProduction': true },
            { status: 'IN_PRODUCTION' },
            { status: 'IN_PROGRESS' }
          ]
        }
      ]
    };

    return this.model.findOneAndUpdate(filter, updateData, { new: true }).exec();
  }

  public async findInInspectionQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<ProductionJobDocument[]> {
    const query: any = {
      tenantId,
      $or: [
        { inInspection: true },
        { 'workflowState.inInspection': true },
        { status: 'IN_INSPECTION' }
      ],
      isDeleted: false
    };

    if (filters.furnaceId) query['equipmentAssignment.furnaceId'] = filters.furnaceId;

    return this.model
      .find(query)
      .sort({ updatedAt: -1 })
      .exec();
  }

  public async findWaitingForDispatchQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<ProductionJobDocument[]> {
    const query: any = {
      tenantId,
      $or: [
        { waitingForDispatch: true },
        { 'workflowState.waitingForDispatch': true },
        { status: 'WAITING_FOR_DISPATCH' },
        { status: 'STORAGE' },
        { status: 'READY_FOR_DISPATCH' }
      ],
      isDeleted: false
    };

    return this.model
      .find(query)
      .sort({ updatedAt: -1 })
      .exec();
  }

  public async findInspectionFailedQueue(
    tenantId: string,
    filters: any = {}
  ): Promise<ProductionJobDocument[]> {
    const query: any = {
      tenantId,
      $or: [
        { inspection: true },
        { 'workflowState.inspection': true },
        { status: 'INSPECTION' }
      ],
      isDeleted: false
    };

    return this.model
      .find(query)
      .sort({ updatedAt: -1 })
      .exec();
  }

  public async atomicTakeForInspection(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null> {
    const identifierMatches: any[] = [{ jobNumber: jobId.toUpperCase() }, { boNumber: jobId.toUpperCase() }];
    if (mongoose.isValidObjectId(jobId)) {
      identifierMatches.unshift({ _id: jobId });
    }

    const filter: any = {
      tenantId,
      $or: identifierMatches,
      isDeleted: false,
      $and: [
        {
          $or: [
            { 'workflowState.waitingForInspection': true },
            { waitingForInspection: true },
            { 'workflow.waitingForInspection': true },
            { status: 'WAITING_FOR_INSPECTION' },
            { status: 'QUALITY_CHECK' }
          ]
        }
      ],
      inInspection: { $ne: true },
      'workflowState.inInspection': { $ne: true },
      inProduction: { $ne: true },
      'workflowState.inProduction': { $ne: true },
      waitingForDispatch: { $ne: true },
      'workflowState.waitingForDispatch': { $ne: true },
      dispatched: { $ne: true },
      'workflowState.dispatched': { $ne: true },
      'workflowState.inspection': { $ne: true }
    };

    return this.model.findOneAndUpdate(filter, updateData, { new: true }).exec();
  }

  public async atomicApproveForDispatch(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null> {
    const identifierMatches: any[] = [{ jobNumber: jobId.toUpperCase() }, { boNumber: jobId.toUpperCase() }];
    if (mongoose.isValidObjectId(jobId)) {
      identifierMatches.unshift({ _id: jobId });
    }

    const filter: any = {
      tenantId,
      $or: identifierMatches,
      isDeleted: false,
      $and: [
        {
          $or: [
            { inInspection: true },
            { 'workflowState.inInspection': true },
            { status: 'IN_INSPECTION' }
          ]
        }
      ]
    };

    return this.model.findOneAndUpdate(filter, updateData, { new: true }).exec();
  }

  public async atomicFailInspection(
    tenantId: string,
    jobId: string,
    updateData: any
  ): Promise<ProductionJobDocument | null> {
    const identifierMatches: any[] = [{ jobNumber: jobId.toUpperCase() }, { boNumber: jobId.toUpperCase() }];
    if (mongoose.isValidObjectId(jobId)) {
      identifierMatches.unshift({ _id: jobId });
    }

    const filter: any = {
      tenantId,
      $or: identifierMatches,
      isDeleted: false,
      $and: [
        {
          $or: [
            { inInspection: true },
            { 'workflowState.inInspection': true },
            { status: 'IN_INSPECTION' }
          ]
        }
      ]
    };

    return this.model.findOneAndUpdate(filter, updateData, { new: true }).exec();
  }

  public async findConflictingJobs(
    tenantId: string,
    furnaceId: string,
    startDate: Date,
    endDate: Date,
    excludeJobId?: string
  ): Promise<ProductionJobDocument[]> {
    const query: any = {
      tenantId,
      'equipmentAssignment.furnaceId': furnaceId,
      status: { $in: ['SCHEDULED', 'IN_PROGRESS', 'IN_PRODUCTION', 'PAUSED'] },
      'timeline.plannedStartDate': { $lt: endDate },
      'timeline.targetCompletionDate': { $gt: startDate },
      isDeleted: false
    };

    if (excludeJobId) {
      query._id = { $ne: excludeJobId };
    }

    return this.model.find(query).exec();
  }
}

export const productionJobRepository = new ProductionJobRepository();
