import { TenantModel, TenantDocument } from './tenant.model.js';
import { CreateTenantDto, UpdateTenantDto, TenantStatus } from './tenant.types.js';
import { NotFoundError } from '../../core/errors/app-error.js';

export interface ITenantRepository {
  findById(id: string): Promise<TenantDocument | null>;
  findByCode(code: string): Promise<TenantDocument | null>;
  create(dto: CreateTenantDto): Promise<TenantDocument>;
  update(id: string, dto: UpdateTenantDto): Promise<TenantDocument>;
  updateStatus(id: string, status: TenantStatus): Promise<TenantDocument>;
  findAll(): Promise<TenantDocument[]>;
}

export class TenantRepository implements ITenantRepository {
  public async findById(id: string): Promise<TenantDocument | null> {
    return TenantModel.findById(id).exec();
  }

  public async findByCode(code: string): Promise<TenantDocument | null> {
    return TenantModel.findOne({ code: code.toUpperCase() }).exec();
  }

  public async create(dto: CreateTenantDto): Promise<TenantDocument> {
    const tenant = new TenantModel({
      ...dto,
      code: dto.code.toUpperCase()
    });
    return tenant.save();
  }

  public async update(id: string, dto: UpdateTenantDto): Promise<TenantDocument> {
    const updated = await TenantModel.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
    if (!updated) {
      throw new NotFoundError(`Tenant with id '${id}' not found`);
    }
    return updated;
  }

  public async updateStatus(id: string, status: TenantStatus): Promise<TenantDocument> {
    const updated = await TenantModel.findByIdAndUpdate(id, { $set: { status } }, { new: true }).exec();
    if (!updated) {
      throw new NotFoundError(`Tenant with id '${id}' not found`);
    }
    return updated;
  }

  public async findAll(): Promise<TenantDocument[]> {
    return TenantModel.find().sort({ createdAt: -1 }).exec();
  }
}

export const tenantRepository = new TenantRepository();
