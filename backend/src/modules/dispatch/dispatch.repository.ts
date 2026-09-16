import mongoose from 'mongoose';
import { DispatchConsignmentModel } from './dispatch.model.js';
import {
  DispatchConsignmentDocument,
  QueryDispatchesDto
} from './dispatch.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import { CounterModel } from '../../core/models/counter.model.js';

export interface IDispatchRepository {
  create(
    tenantId: string,
    data: Partial<DispatchConsignmentDocument>
  ): Promise<DispatchConsignmentDocument>;
  findById(tenantId: string, id: string): Promise<DispatchConsignmentDocument | null>;
  findByDispatchNumber(
    tenantId: string,
    dispatchNumber: string
  ): Promise<DispatchConsignmentDocument | null>;
  findByDeliveryChallanNumber(
    tenantId: string,
    deliveryChallanNumber: string
  ): Promise<DispatchConsignmentDocument | null>;
  findByOutwardChallanNumber(
    tenantId: string,
    outwardChallanNumber: string
  ): Promise<DispatchConsignmentDocument | null>;
  findByBatchOrderId(
    tenantId: string,
    batchOrderId: string
  ): Promise<DispatchConsignmentDocument | null>;
  update(
    tenantId: string,
    id: string,
    data: Partial<DispatchConsignmentDocument>
  ): Promise<DispatchConsignmentDocument | null>;
  query(
    tenantId: string,
    query: QueryDispatchesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<DispatchConsignmentDocument>>;
  generateNextDispatchNumber(tenantId: string): Promise<string>;
  generateNextDeliveryChallanNumber(tenantId: string): Promise<string>;
  generateNextGatePassNumber(tenantId: string): Promise<string>;
  generateNextOutwardChallanNumber(tenantId: string): Promise<string>;
}

export class DispatchRepository implements IDispatchRepository {
  public async create(
    tenantId: string,
    data: Partial<DispatchConsignmentDocument>
  ): Promise<DispatchConsignmentDocument> {
    const consignment = new DispatchConsignmentModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await consignment.save();
  }

  public async findById(
    tenantId: string,
    id: string
  ): Promise<DispatchConsignmentDocument | null> {
    if (!id || typeof id !== 'string' || mongoose.connection.readyState === 0) {
      return null;
    }
    const isObjectId = mongoose.Types.ObjectId.isValid(id) && id.length === 24;
    return await DispatchConsignmentModel.findOne({
      tenantId,
      isDeleted: false,
      $or: [
        ...(isObjectId ? [{ _id: id }] : []),
        { id },
        { dispatchNumber: id.toUpperCase() },
        { outwardChallanNumber: id.toUpperCase() },
        { deliveryChallanNumber: id.toUpperCase() }
      ]
    });
  }

  public async findByDispatchNumber(
    tenantId: string,
    dispatchNumber: string
  ): Promise<DispatchConsignmentDocument | null> {
    if (mongoose.connection.readyState === 0) {
      return null;
    }
    return await DispatchConsignmentModel.findOne({
      tenantId,
      dispatchNumber: dispatchNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async findByDeliveryChallanNumber(
    tenantId: string,
    deliveryChallanNumber: string
  ): Promise<DispatchConsignmentDocument | null> {
    if (mongoose.connection.readyState === 0) {
      return null;
    }
    return await DispatchConsignmentModel.findOne({
      tenantId,
      deliveryChallanNumber: deliveryChallanNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async findByOutwardChallanNumber(
    tenantId: string,
    outwardChallanNumber: string
  ): Promise<DispatchConsignmentDocument | null> {
    if (mongoose.connection.readyState === 0) {
      return null;
    }
    return await DispatchConsignmentModel.findOne({
      tenantId,
      outwardChallanNumber: outwardChallanNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async findByBatchOrderId(
    tenantId: string,
    batchOrderId: string
  ): Promise<DispatchConsignmentDocument | null> {
    if (mongoose.connection.readyState === 0) {
      return null;
    }
    return await DispatchConsignmentModel.findOne({
      tenantId,
      $or: [
        { batchOrderId },
        { 'lines.jobId': batchOrderId }
      ],
      isDeleted: false
    });
  }

  public async update(
    tenantId: string,
    id: string,
    data: Partial<DispatchConsignmentDocument>
  ): Promise<DispatchConsignmentDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || mongoose.connection.readyState === 0) {
      return null;
    }
    return await DispatchConsignmentModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async query(
    tenantId: string,
    query: QueryDispatchesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<DispatchConsignmentDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.status) filter.status = query.status;
    if (query.customerId) filter['customer.customerId'] = query.customerId;
    if (query.customerCode) filter['customer.customerCode'] = query.customerCode.toUpperCase();
    if (query.dispatchNumber) filter.dispatchNumber = new RegExp(query.dispatchNumber, 'i');
    if (query.deliveryChallanNumber) filter.deliveryChallanNumber = new RegExp(query.deliveryChallanNumber, 'i');
    if (query.outwardChallanNumber) filter.outwardChallanNumber = new RegExp(query.outwardChallanNumber, 'i');
    if (query.batchOrderId) {
      filter.$or = [{ batchOrderId: query.batchOrderId }, { 'lines.jobId': query.batchOrderId }];
    }
    if (query.grnId) filter.grnId = query.grnId;
    if (query.poId) filter.poId = query.poId;
    if (query.isOutwardChallan !== undefined) filter.isOutwardChallan = query.isOutwardChallan;
    if (query.jobNumber) filter['lines.jobNumber'] = new RegExp(query.jobNumber, 'i');
    if (query.heatLotNumber) filter['lines.heatLotNumber'] = new RegExp(query.heatLotNumber, 'i');

    if (query.startDate || query.endDate) {
      filter['timeline.createdAt'] = {};
      if (query.startDate) filter['timeline.createdAt'].$gte = new Date(query.startDate);
      if (query.endDate) filter['timeline.createdAt'].$lte = new Date(query.endDate);
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { dispatchNumber: searchRegex },
        { deliveryChallanNumber: searchRegex },
        { 'customer.customerName': searchRegex },
        { 'customer.customerCode': searchRegex },
        { 'lines.jobNumber': searchRegex },
        { 'lines.fgLotNumber': searchRegex }
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      DispatchConsignmentModel.find(filter)
        .sort({ 'timeline.createdAt': -1 })
        .skip(skip)
        .limit(limit),
      DispatchConsignmentModel.countDocuments(filter)
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateNextDispatchNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `DSP-${yearMonth}-`;

    if (mongoose.connection.readyState === 0) {
      return `${prefix}0001`;
    }

    const latest: any = await DispatchConsignmentModel.findOne({
      tenantId,
      dispatchNumber: new RegExp(`^${prefix}`)
    })
      .sort({ dispatchNumber: -1 })
      .lean();

    let seq = 1;
    if (latest && latest.dispatchNumber) {
      const parts = latest.dispatchNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  public async generateNextDeliveryChallanNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `DC-${yearMonth}-`;

    if (mongoose.connection.readyState === 0) {
      return `${prefix}0001`;
    }

    const latest: any = await DispatchConsignmentModel.findOne({
      tenantId,
      deliveryChallanNumber: new RegExp(`^${prefix}`)
    })
      .sort({ deliveryChallanNumber: -1 })
      .lean();

    let seq = 1;
    if (latest && latest.deliveryChallanNumber) {
      const parts = latest.deliveryChallanNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  public async generateNextGatePassNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `GP-${yearMonth}-`;

    if (mongoose.connection.readyState === 0) {
      return `${prefix}0001`;
    }

    const latest: any = await DispatchConsignmentModel.findOne({
      tenantId,
      'gatePass.gatePassNumber': new RegExp(`^${prefix}`)
    })
      .sort({ 'gatePass.gatePassNumber': -1 })
      .lean();

    let seq = 1;
    if (latest && latest.gatePass?.gatePassNumber) {
      const parts = latest.gatePass.gatePassNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  public async generateNextOutwardChallanNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `OC-${yearMonth}-`;
    const domain = `OC_${yearMonth}`;

    if (mongoose.connection.readyState === 1) {
      try {
        const counter = await CounterModel.findOneAndUpdate(
          { tenantId, domain },
          { $inc: { seq: 1 } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        ).exec();

        if (counter && typeof counter.seq === 'number') {
          return `${prefix}${String(counter.seq).padStart(4, '0')}`;
        }
      } catch {
        // Fallback to query
      }

      try {
        const latest: any = await DispatchConsignmentModel.findOne({
          tenantId,
          outwardChallanNumber: new RegExp(`^${prefix}`)
        })
          .sort({ outwardChallanNumber: -1 })
          .lean();

        let seq = 1;
        if (latest && latest.outwardChallanNumber) {
          const parts = latest.outwardChallanNumber.split('-');
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) seq = lastSeq + 1;
        }

        return `${prefix}${String(seq).padStart(4, '0')}`;
      } catch {
        return `${prefix}0001`;
      }
    }

    return `${prefix}0001`;
  }
}

export const dispatchRepository = new DispatchRepository();
