import { Document } from 'mongoose';
import { UnitOfMeasure } from '../item/item.types.js';

export type QuarantineTargetType = 'ITEM' | 'HEAT_LOT' | 'JOB_CARD' | 'FINISHED_GOODS';

export type QuarantineReasonCode =
  | 'SPECTROMETRY_CHEMISTRY_FAIL'
  | 'SURFACE_HARDNESS_FAIL'
  | 'CORE_HARDNESS_FAIL'
  | 'EFFECTIVE_CASE_DEPTH_FAIL'
  | 'MICROSTRUCTURE_NON_CONFORMANCE'
  | 'CRACK_OR_DISTORTION'
  | 'CUSTOMER_RETURN_NCR'
  | 'DOCUMENTATION_DISCREPANCY'
  | 'GENERAL_SUSPECT_HOLD';

export type QuarantineTriggerSource =
  | 'INSPECTION_FAILURE'
  | 'NCR'
  | 'RECEIVING_INSPECTION'
  | 'FURNACE_ABORT'
  | 'CUSTOMER_COMPLAINT'
  | 'MANUAL_HOLD';

export type QuarantineStatus =
  | 'ACTIVE_QUARANTINE'
  | 'RELEASED_TO_STOCK'
  | 'SCRAP_DISPOSITION'
  | 'RETURN_TO_SUPPLIER'
  | 'REWORK_APPROVED';

export interface IQuarantineRecord {
  tenantId: string;
  quarantineNumber: string;
  targetType: QuarantineTargetType;
  targetId: string;
  targetIdentifier: string;
  itemId: string;
  itemCode: string;
  location: string;
  originalLocation?: string;
  quantity: number;
  uom: UnitOfMeasure;
  reasonCode: QuarantineReasonCode;
  reasonDescription: string;
  triggerSource: QuarantineTriggerSource;
  triggerReferenceNumber?: string;
  status: QuarantineStatus;
  dispositionNotes?: string;
  dispositionActorId?: string;
  dispositionActorEmail?: string;
  dispositionDate?: Date;
  initiatedByActorId: string;
  initiatedByActorEmail?: string;
  initiatedAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuarantineRecordDocument extends IQuarantineRecord, Document {}

export interface PlaceInQuarantineDto {
  targetType: QuarantineTargetType;
  targetId: string;
  targetIdentifier: string;
  itemId: string;
  location: string;
  originalLocation?: string;
  quantity: number;
  reasonCode: QuarantineReasonCode;
  reasonDescription: string;
  triggerSource: QuarantineTriggerSource;
  triggerReferenceNumber?: string;
}

export interface ReleaseQuarantineDto {
  releaseNotes: string;
  targetLocation?: string;
}

export interface DispositionQuarantineDto {
  dispositionStatus: 'SCRAP_DISPOSITION' | 'RETURN_TO_SUPPLIER' | 'REWORK_APPROVED';
  dispositionNotes: string;
}

export interface QuarantineFilterQuery {
  search?: string;
  targetType?: QuarantineTargetType;
  targetIdentifier?: string;
  itemId?: string;
  itemCode?: string;
  status?: QuarantineStatus;
  reasonCode?: QuarantineReasonCode;
  triggerSource?: QuarantineTriggerSource;
}
