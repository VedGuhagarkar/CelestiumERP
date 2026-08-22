import { BaseRepository } from '../../core/repository/base.repository.js';
import { MaterialReservationDocument } from './material-requirements.types.js';
import { MaterialReservationModel } from './material-reservation.model.js';

export interface IMaterialRequirementsRepository {
  generateNextReservationNumber(tenantId: string): Promise<string>;
  findReservationByNumber(tenantId: string, reservationNumber: string): Promise<MaterialReservationDocument | null>;
  findActiveReservationsByPlan(tenantId: string, planId: string): Promise<MaterialReservationDocument[]>;
  findActiveReservationsByTarget(
    tenantId: string,
    targetType: string,
    targetId: string
  ): Promise<MaterialReservationDocument[]>;
  findReservationsByItem(tenantId: string, itemCode: string): Promise<MaterialReservationDocument[]>;
  findById(tenantId: string, id: string): Promise<MaterialReservationDocument | null>;
  create(tenantId: string, data: Partial<MaterialReservationDocument>): Promise<MaterialReservationDocument>;
  updateById(tenantId: string, id: string, update: any): Promise<MaterialReservationDocument | null>;
}

export class MaterialRequirementsRepository
  extends BaseRepository<MaterialReservationDocument>
  implements IMaterialRequirementsRepository
{
  constructor() {
    super(MaterialReservationModel);
  }

  public async generateNextReservationNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `RES-${yearMonth}-`;

    const latestReservation = await this.model
      .findOne({ tenantId, reservationNumber: { $regex: `^${prefix}` } })
      .sort({ reservationNumber: -1 })
      .exec();

    if (!latestReservation) {
      return `${prefix}0001`;
    }

    const currentSeq = parseInt(latestReservation.reservationNumber.replace(prefix, ''), 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public async findReservationByNumber(
    tenantId: string,
    reservationNumber: string
  ): Promise<MaterialReservationDocument | null> {
    return this.model
      .findOne({ tenantId, reservationNumber: reservationNumber.toUpperCase(), isDeleted: false })
      .exec();
  }

  public async findActiveReservationsByPlan(
    tenantId: string,
    planId: string
  ): Promise<MaterialReservationDocument[]> {
    return this.model
      .find({
        tenantId,
        planId,
        status: 'ACTIVE',
        isDeleted: false
      })
      .exec();
  }

  public async findActiveReservationsByTarget(
    tenantId: string,
    targetType: string,
    targetId: string
  ): Promise<MaterialReservationDocument[]> {
    return this.model
      .find({
        tenantId,
        targetType,
        targetId,
        status: 'ACTIVE',
        isDeleted: false
      })
      .exec();
  }

  public async findReservationsByItem(
    tenantId: string,
    itemCode: string
  ): Promise<MaterialReservationDocument[]> {
    return this.model
      .find({
        tenantId,
        itemCode: itemCode.toUpperCase(),
        isDeleted: false
      })
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const materialRequirementsRepository = new MaterialRequirementsRepository();
