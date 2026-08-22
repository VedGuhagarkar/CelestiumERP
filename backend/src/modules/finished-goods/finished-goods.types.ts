import { Document } from 'mongoose';
import { UnitOfMeasure } from '../item/item.types.js';

export type FinishedGoodsStatus =
  | 'AWAITING_QC_RELEASE'
  | 'RELEASED_FOR_DISPATCH'
  | 'QUARANTINED'
  | 'RESERVED_FOR_DISPATCH'
  | 'FULLY_DISPATCHED';

export interface QualityReleaseInfo {
  isReleased: boolean;
  releasedAt?: Date;
  releasedByActorId?: string;
  releasedByActorEmail?: string;
  cocNumber?: string;
  inspectionReportId?: string;
  releaseNotes?: string;
}

export interface FinishedGoodsMovement {
  fromLocation: string;
  toLocation: string;
  quantity: number;
  movedAt: Date;
  movedByActorId: string;
  reason?: string;
}

export interface IFinishedGoods {
  tenantId: string;
  fgLotNumber: string;
  jobCardId: string;
  jobCardNumber: string;
  heatLotNumber?: string;
  customerCode: string;
  itemId: string;
  itemCode: string;
  description?: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  dispatchedQuantity: number;
  uom: UnitOfMeasure;
  location: string;
  status: FinishedGoodsStatus;
  qualityRelease: QualityReleaseInfo;
  movementHistory: FinishedGoodsMovement[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinishedGoodsDocument extends IFinishedGoods, Document {}

export interface InwardFinishedGoodsDto {
  jobCardId: string;
  jobCardNumber: string;
  heatLotNumber?: string;
  customerCode: string;
  itemId: string;
  description?: string;
  totalQuantity: number;
  location: string;
}

export interface ReleaseFinishedGoodsDto {
  cocNumber?: string;
  inspectionReportId?: string;
  releaseNotes: string;
}

export interface ReserveFinishedGoodsDto {
  quantity: number;
  deliveryChallanNumber?: string;
  comments?: string;
}

export interface ReleaseReservationDto {
  quantity: number;
  comments?: string;
}

export interface MoveFinishedGoodsLocationDto {
  destinationLocation: string;
  reason?: string;
}

export interface FinishedGoodsFilterQuery {
  search?: string;
  jobCardNumber?: string;
  heatLotNumber?: string;
  customerCode?: string;
  itemId?: string;
  itemCode?: string;
  status?: FinishedGoodsStatus;
  location?: string;
  isReleased?: boolean;
}
