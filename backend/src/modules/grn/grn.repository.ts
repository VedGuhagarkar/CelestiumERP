import mongoose, { FilterQuery, Model } from 'mongoose';
import { MaterialReceiptModel, GRNModel, GRNUnitModel } from './grn.model.js';
import {
  MaterialReceiptDocument,
  GRNDocument,
  GRNUnitDocument,
  QueryGrnDto,
  QueryGrnUnitDto,
  MaterialReceiptStatus,
  IStorageMovement
} from './grn.types.js';

export interface IGRNRepository {
  // Receipt operations
  createReceipt(tenantId: string, data: Partial<MaterialReceiptDocument>): Promise<MaterialReceiptDocument>;
  findReceiptById(tenantId: string, id: string): Promise<MaterialReceiptDocument | null>;
  findReceiptByNumber(tenantId: string, receiptNumber: string): Promise<MaterialReceiptDocument | null>;
  findReceiptByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<MaterialReceiptDocument | null>;
  updateReceipt(tenantId: string, id: string, data: Partial<MaterialReceiptDocument>): Promise<MaterialReceiptDocument | null>;
  atomicStoreReceipt(
    tenantId: string,
    receiptId: string,
    expectedStatuses: MaterialReceiptStatus[],
    updateData: Partial<MaterialReceiptDocument> & Record<string, any>,
    newMovement: IStorageMovement,
    requiredAvailableQuantity?: number
  ): Promise<MaterialReceiptDocument | null>;
  generateNextReceiptNumber(tenantId: string): Promise<string>;
  atomicTransitionReceiptToGrnCreated(tenantId: string, receiptId: string): Promise<MaterialReceiptDocument | null>;
  queryReceipts(tenantId: string, query: { poId?: string; status?: string; search?: string }): Promise<MaterialReceiptDocument[]>;

  // GRN operations
  createGrn(tenantId: string, data: Partial<GRNDocument>): Promise<GRNDocument>;
  findGrnById(tenantId: string, id: string): Promise<GRNDocument | null>;
  findGrnByNumber(tenantId: string, grnNumber: string): Promise<GRNDocument | null>;
  findGrnByPoNumber(tenantId: string, poNumber: string): Promise<GRNDocument | null>;
  findGrnsByPoId(tenantId: string, poId: string): Promise<GRNDocument[]>;
  findGrnByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<GRNDocument | null>;
  updateGrn(tenantId: string, id: string, data: Partial<GRNDocument>): Promise<GRNDocument | null>;
  generateNextGrnNumber(tenantId: string): Promise<string>;
  queryGrns(tenantId: string, query: QueryGrnDto): Promise<{ grns: GRNDocument[]; total: number }>;

  // GRN Unit operations
  createGrnUnits(tenantId: string, units: Array<Partial<GRNUnitDocument>>): Promise<GRNUnitDocument[]>;
  findUnitByIdentifier(tenantId: string, unitIdentifier: string): Promise<GRNUnitDocument | null>;
  findUnitsByGrnId(tenantId: string, grnId: string): Promise<GRNUnitDocument[]>;
  findUnitsByPoId(tenantId: string, poId: string): Promise<GRNUnitDocument[]>;
  queryUnits(tenantId: string, query: QueryGrnUnitDto): Promise<{ units: GRNUnitDocument[]; total: number }>;
  queryAvailableUnitsForPlanning(tenantId: string, itemId?: string, recipeId?: string, materialGrade?: string): Promise<GRNUnitDocument[]>;
  allocateUnit(
    tenantId: string,
    unitIdentifier: string,
    planId: string,
    planNumber: string,
    jobId?: string
  ): Promise<GRNUnitDocument | null>;
  checkUnitImmutability(tenantId: string, unitIdentifier: string): Promise<boolean>;
  updateUnitStatus(
    tenantId: string,
    unitIdentifier: string,
    status: GRNUnitDocument['status'],
    allocatedPlanId?: string,
    allocatedPlanNumber?: string
  ): Promise<GRNUnitDocument | null>;
}

export class GRNRepository implements IGRNRepository {
  constructor(
    private readonly receiptModel: Model<MaterialReceiptDocument> = MaterialReceiptModel,
    private readonly grnModel: Model<GRNDocument> = GRNModel,
    private readonly unitModel: Model<GRNUnitDocument> = GRNUnitModel
  ) {}

  // --- Receipt Operations ---

  public async createReceipt(tenantId: string, data: Partial<MaterialReceiptDocument>): Promise<MaterialReceiptDocument> {
    const doc = new this.receiptModel({ ...data, tenantId });
    return doc.save();
  }

  public async findReceiptById(tenantId: string, id: string): Promise<MaterialReceiptDocument | null> {
    return this.receiptModel.findOne({ tenantId, _id: id, isDeleted: false }).exec();
  }

  public async findReceiptByNumber(tenantId: string, receiptNumber: string): Promise<MaterialReceiptDocument | null> {
    return this.receiptModel.findOne({ tenantId, receiptNumber: receiptNumber.toUpperCase().trim(), isDeleted: false }).exec();
  }

  public async findReceiptByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<MaterialReceiptDocument | null> {
    return this.receiptModel.findOne({ tenantId, idempotencyKey: idempotencyKey.trim(), isDeleted: false }).exec();
  }

  public async updateReceipt(tenantId: string, id: string, data: Partial<MaterialReceiptDocument>): Promise<MaterialReceiptDocument | null> {
    return this.receiptModel.findOneAndUpdate({ tenantId, _id: id, isDeleted: false }, { $set: data }, { new: true }).exec();
  }

  public async atomicStoreReceipt(
    tenantId: string,
    receiptId: string,
    expectedStatuses: MaterialReceiptStatus[],
    updateData: Partial<MaterialReceiptDocument> & Record<string, any>,
    newMovement: IStorageMovement,
    requiredAvailableQuantity?: number
  ): Promise<MaterialReceiptDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(receiptId)) {
      return null;
    }

    const filter: FilterQuery<MaterialReceiptDocument> = {
      tenantId,
      _id: receiptId,
      status: { $in: expectedStatuses },
      isDeleted: false
    };

    if (requiredAvailableQuantity !== undefined && requiredAvailableQuantity > 0) {
      filter.$or = [
        { remainingQuantityToStore: { $gte: requiredAvailableQuantity } },
        { remainingQuantityToStore: { $exists: false } }
      ];
    }

    return this.receiptModel
      .findOneAndUpdate(
        filter,
        {
          $set: updateData,
          $push: { movementHistory: newMovement }
        },
        { new: true }
      )
      .exec();
  }

  public async atomicTransitionReceiptToGrnCreated(
    tenantId: string,
    receiptId: string
  ): Promise<MaterialReceiptDocument | null> {
    const filter: FilterQuery<MaterialReceiptDocument> = {
      tenantId,
      _id: receiptId,
      status: 'STORED',
      isDeleted: false
    };

    return this.receiptModel
      .findOneAndUpdate(
        filter,
        { $set: { status: 'GRN_CREATED' } },
        { new: true }
      )
      .exec();
  }

  public async generateNextReceiptNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const prefix = `RCPT-${yearMonth}-`;

    const latest = await this.receiptModel
      .findOne({ tenantId, receiptNumber: new RegExp(`^${prefix}`) })
      .sort({ receiptNumber: -1 })
      .exec();

    if (!latest || !latest.receiptNumber) {
      return `${prefix}0001`;
    }

    const parts = latest.receiptNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async queryReceipts(tenantId: string, query: { poId?: string; status?: string; search?: string }): Promise<MaterialReceiptDocument[]> {
    const filter: FilterQuery<MaterialReceiptDocument> = { tenantId, isDeleted: false };
    if (query.poId) filter.poId = query.poId;
    if (query.status) filter.status = query.status;
    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { receiptNumber: searchRegex },
        { poNumber: searchRegex },
        { supplierName: searchRegex },
        { supplierChallanNumber: searchRegex }
      ];
    }
    return this.receiptModel.find(filter).sort({ createdAt: -1 }).limit(100).exec();
  }

  // --- GRN Operations ---

  public async createGrn(tenantId: string, data: Partial<GRNDocument>): Promise<GRNDocument> {
    const doc = new this.grnModel({ ...data, tenantId });
    return doc.save();
  }

  public async findGrnById(tenantId: string, id: string): Promise<GRNDocument | null> {
    if (!id || typeof id !== 'string') return null;
    const isObjectId = mongoose.isValidObjectId(id);
    const filter: FilterQuery<GRNDocument> = {
      tenantId,
      isDeleted: false,
      ...(isObjectId
        ? { $or: [{ _id: id }, { grnNumber: id.toUpperCase().trim() }] }
        : { grnNumber: id.toUpperCase().trim() })
    };
    return this.grnModel.findOne(filter).exec();
  }

  public async findGrnByNumber(tenantId: string, grnNumber: string): Promise<GRNDocument | null> {
    return this.grnModel.findOne({ tenantId, grnNumber: grnNumber.toUpperCase().trim(), isDeleted: false }).exec();
  }

  public async findGrnByPoNumber(tenantId: string, poNumber: string): Promise<GRNDocument | null> {
    return this.grnModel.findOne({ tenantId, poNumber: poNumber.toUpperCase().trim(), isDeleted: false }).exec();
  }

  public async findGrnsByPoId(tenantId: string, poId: string): Promise<GRNDocument[]> {
    return this.grnModel.find({ tenantId, poId, isDeleted: false }).sort({ createdAt: -1 }).exec();
  }

  public async findGrnByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<GRNDocument | null> {
    return this.grnModel.findOne({ tenantId, idempotencyKey: idempotencyKey.trim(), isDeleted: false }).exec();
  }

  public async updateGrn(tenantId: string, id: string, data: Partial<GRNDocument>): Promise<GRNDocument | null> {
    return this.grnModel.findOneAndUpdate({ tenantId, _id: id, isDeleted: false }, { $set: data }, { new: true }).exec();
  }

  public async generateNextGrnNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const prefix = `GRN-${yearMonth}-`;

    const latest = await this.grnModel
      .findOne({ tenantId, grnNumber: new RegExp(`^${prefix}`) })
      .sort({ grnNumber: -1 })
      .exec();

    if (!latest || !latest.grnNumber) {
      return `${prefix}0001`;
    }

    const parts = latest.grnNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    const nextSeq = isNaN(lastSeq) ? 1 : lastSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async queryGrns(
    tenantId: string,
    query: QueryGrnDto
  ): Promise<{ grns: GRNDocument[]; total: number }> {
    const filter: FilterQuery<GRNDocument> = { tenantId, isDeleted: false };

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { grnNumber: searchRegex },
        { poNumber: searchRegex },
        { receiptNumber: searchRegex },
        { supplierName: searchRegex },
        { supplierChallanNumber: searchRegex }
      ];
    }

    if (query.poNumber) {
      filter.poNumber = query.poNumber.toUpperCase().trim();
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.supplierName) {
      filter.supplierName = new RegExp(query.supplierName, 'i');
    }

    if (query.supplierChallanNumber) {
      filter.supplierChallanNumber = query.supplierChallanNumber.toUpperCase().trim();
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [grns, total] = await Promise.all([
      this.grnModel
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.grnModel.countDocuments(filter).exec()
    ]);

    return { grns, total };
  }

  // --- GRN Unit Operations ---

  public async createGrnUnits(tenantId: string, units: Array<Partial<GRNUnitDocument>>): Promise<GRNUnitDocument[]> {
    const docs = units.map((u) => ({ ...u, tenantId }));
    return (await this.unitModel.insertMany(docs)) as unknown as GRNUnitDocument[];
  }

  public async findUnitByIdentifier(tenantId: string, unitIdentifier: string): Promise<GRNUnitDocument | null> {
    return this.unitModel.findOne({ tenantId, unitIdentifier: unitIdentifier.toUpperCase().trim(), isDeleted: false }).exec();
  }

  public async queryUnits(
    tenantId: string,
    query: QueryGrnUnitDto
  ): Promise<{ units: GRNUnitDocument[]; total: number }> {
    const filter: FilterQuery<GRNUnitDocument> = { tenantId, isDeleted: false };

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { unitIdentifier: searchRegex },
        { grnNumber: searchRegex },
        { poNumber: searchRegex },
        { itemCode: searchRegex },
        { recipeCode: searchRegex },
        { supplierHeatNumber: searchRegex }
      ];
    }

    if (query.poNumber) filter.poNumber = query.poNumber.toUpperCase().trim();
    if (query.grnNumber) filter.grnNumber = query.grnNumber.toUpperCase().trim();
    if (query.itemCode) filter.itemCode = query.itemCode.toUpperCase().trim();
    if (query.recipeId) filter.recipeId = query.recipeId;
    if (query.recipeCode) filter.recipeCode = query.recipeCode.toUpperCase().trim();
    if (query.status) filter.status = query.status;
    if (query.supplierHeatNumber) filter.supplierHeatNumber = query.supplierHeatNumber.toUpperCase().trim();

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [units, total] = await Promise.all([
      this.unitModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.unitModel.countDocuments(filter).exec()
    ]);

    return { units, total };
  }

  public async findUnitsByGrnId(tenantId: string, grnId: string): Promise<GRNUnitDocument[]> {
    return this.unitModel.find({ tenantId, grnId, isDeleted: false }).sort({ createdAt: 1 }).exec();
  }

  public async findUnitsByPoId(tenantId: string, poId: string): Promise<GRNUnitDocument[]> {
    return this.unitModel.find({ tenantId, poId, isDeleted: false }).sort({ createdAt: 1 }).exec();
  }

  public async queryAvailableUnitsForPlanning(
    tenantId: string,
    itemId?: string,
    recipeId?: string,
    materialGrade?: string
  ): Promise<GRNUnitDocument[]> {
    if (mongoose.connection.readyState === 0) return [];

    const filter: FilterQuery<GRNUnitDocument> = {
      tenantId,
      status: 'AVAILABLE_FOR_PLANNING',
      isDeleted: false
    };

    if (itemId) filter.itemId = itemId;
    if (recipeId) filter.recipeId = recipeId;
    if (materialGrade) filter.materialGrade = materialGrade.toUpperCase().trim();

    return this.unitModel.find(filter).sort({ createdAt: 1 }).exec();
  }

  public async allocateUnit(
    tenantId: string,
    unitIdentifier: string,
    planId: string,
    planNumber: string,
    jobId?: string
  ): Promise<GRNUnitDocument | null> {
    const unitId = unitIdentifier.toUpperCase().trim();
    const updated = await this.unitModel.findOneAndUpdate(
      {
        tenantId,
        unitIdentifier: unitId,
        status: 'AVAILABLE_FOR_PLANNING',
        isDeleted: false
      },
      {
        $set: {
          status: 'ALLOCATED_TO_PLAN',
          allocatedPlanId: planId,
          allocatedPlanNumber: planNumber,
          allocatedJobId: jobId
        }
      },
      { new: true }
    ).exec();

    if (updated) {
      await this.grnModel.updateOne(
        { tenantId, 'units.unitIdentifier': unitId },
        {
          $set: {
            'units.$.status': 'ALLOCATED_TO_PLAN',
            'units.$.allocatedPlanId': planId,
            'units.$.allocatedPlanNumber': planNumber,
            'units.$.allocatedJobId': jobId
          }
        }
      ).exec();
    }

    return updated;
  }

  public async checkUnitImmutability(tenantId: string, unitIdentifier: string): Promise<boolean> {
    const unit = await this.findUnitByIdentifier(tenantId, unitIdentifier);
    if (!unit) return false;
    return unit.status !== 'AVAILABLE_FOR_PLANNING';
  }

  public async updateUnitStatus(
    tenantId: string,
    unitIdentifier: string,
    status: GRNUnitDocument['status'],
    allocatedPlanId?: string,
    allocatedPlanNumber?: string
  ): Promise<GRNUnitDocument | null> {
    const unitId = unitIdentifier.toUpperCase().trim();
    const update: any = { status };
    if (allocatedPlanId !== undefined) update.allocatedPlanId = allocatedPlanId;
    if (allocatedPlanNumber !== undefined) update.allocatedPlanNumber = allocatedPlanNumber;

    const doc = await this.unitModel.findOneAndUpdate(
      { tenantId, unitIdentifier: unitId, isDeleted: false },
      { $set: update },
      { new: true }
    ).exec();

    if (doc) {
      const embeddedUpdate: any = { 'units.$.status': status };
      if (allocatedPlanId !== undefined) embeddedUpdate['units.$.allocatedPlanId'] = allocatedPlanId;
      if (allocatedPlanNumber !== undefined) embeddedUpdate['units.$.allocatedPlanNumber'] = allocatedPlanNumber;

      await this.grnModel.updateOne(
        { tenantId, 'units.unitIdentifier': unitId },
        { $set: embeddedUpdate }
      ).exec();
    }

    return doc;
  }
}

export const grnRepository = new GRNRepository();
