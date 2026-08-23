import mongoose from 'mongoose';
import { FinishedGoodsModel, FinishedGoodsDocument } from './finished-goods.model.js';
import { IFinishedGoods, FinishedGoodsFilterQuery } from './finished-goods.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface IFinishedGoodsRepository {
  create(tenantId: string, data: Partial<IFinishedGoods>): Promise<FinishedGoodsDocument>;
  findById(tenantId: string, id: string): Promise<FinishedGoodsDocument | null>;
  findByLotNumber(tenantId: string, fgLotNumber: string): Promise<FinishedGoodsDocument | null>;
  findByJobCardNumber(tenantId: string, jobCardNumber: string): Promise<FinishedGoodsDocument[]>;
  update(
    tenantId: string,
    id: string,
    data: Partial<IFinishedGoods>
  ): Promise<FinishedGoodsDocument | null>;
  search(
    tenantId: string,
    filters: FinishedGoodsFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<FinishedGoodsDocument>>;
  generateFgLotNumber(tenantId: string): Promise<string>;
}

export class FinishedGoodsRepository implements IFinishedGoodsRepository {
  public async create(
    tenantId: string,
    data: Partial<IFinishedGoods>
  ): Promise<FinishedGoodsDocument> {
    const fgLotNumber = data.fgLotNumber || (await this.generateFgLotNumber(tenantId));

    return FinishedGoodsModel.create({
      ...data,
      tenantId,
      fgLotNumber,
      jobCardNumber: data.jobCardNumber?.toUpperCase(),
      customerCode: data.customerCode?.toUpperCase(),
      itemCode: data.itemCode?.toUpperCase(),
      heatLotNumber: data.heatLotNumber?.toUpperCase(),
      status: data.status || 'AWAITING_QC_RELEASE',
      availableQuantity: data.availableQuantity || 0,
      reservedQuantity: 0,
      dispatchedQuantity: 0,
      isDeleted: false
    });
  }

  public async findById(
    tenantId: string,
    id: string
  ): Promise<FinishedGoodsDocument | null> {
    if (!id || typeof id !== 'string') return null;
    if (mongoose.isValidObjectId(id)) {
      const byId = await FinishedGoodsModel.findOne({ tenantId, _id: id, isDeleted: false });
      if (byId) return byId;
    }
    return FinishedGoodsModel.findOne({
      tenantId,
      isDeleted: false,
      $or: [
        { fgLotNumber: id.toUpperCase() },
        { fgLotNumber: new RegExp(`^${id}$`, 'i') },
        { itemCode: new RegExp(`^${id}$`, 'i') },
        { jobCardNumber: new RegExp(`^${id}$`, 'i') }
      ]
    });
  }

  public async findByLotNumber(
    tenantId: string,
    fgLotNumber: string
  ): Promise<FinishedGoodsDocument | null> {
    return FinishedGoodsModel.findOne({
      tenantId,
      fgLotNumber: fgLotNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async findByJobCardNumber(
    tenantId: string,
    jobCardNumber: string
  ): Promise<FinishedGoodsDocument[]> {
    return FinishedGoodsModel.find({
      tenantId,
      jobCardNumber: jobCardNumber.toUpperCase(),
      isDeleted: false
    }).exec();
  }

  public async update(
    tenantId: string,
    id: string,
    data: Partial<IFinishedGoods>
  ): Promise<FinishedGoodsDocument | null> {
    return FinishedGoodsModel.findOneAndUpdate(
      { tenantId, _id: id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  public async search(
    tenantId: string,
    filters: FinishedGoodsFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<FinishedGoodsDocument>> {
    const query: Record<string, any> = { tenantId, isDeleted: false };

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { fgLotNumber: searchRegex },
        { jobCardNumber: searchRegex },
        { heatLotNumber: searchRegex },
        { customerCode: searchRegex },
        { itemCode: searchRegex },
        { location: searchRegex }
      ];
    }

    if (filters.jobCardNumber) {
      query.jobCardNumber = filters.jobCardNumber.toUpperCase();
    }

    if (filters.heatLotNumber) {
      query.heatLotNumber = filters.heatLotNumber.toUpperCase();
    }

    if (filters.customerCode) {
      query.customerCode = filters.customerCode.toUpperCase();
    }

    if (filters.itemId) {
      query.itemId = filters.itemId;
    }

    if (filters.itemCode) {
      query.itemCode = filters.itemCode.toUpperCase();
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.location) {
      query.location = new RegExp(filters.location, 'i');
    }

    if (filters.isReleased !== undefined) {
      query['qualityRelease.isReleased'] = filters.isReleased;
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      FinishedGoodsModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      FinishedGoodsModel.countDocuments(query).exec()
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateFgLotNumber(tenantId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `FG-${year}${month}-`;

    const count = await FinishedGoodsModel.countDocuments({
      tenantId,
      fgLotNumber: new RegExp(`^${prefix}`)
    }).exec();

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}${sequence}`;
  }
}

export const finishedGoodsRepository = new FinishedGoodsRepository();
