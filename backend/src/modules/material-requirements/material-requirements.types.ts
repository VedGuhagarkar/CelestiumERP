import { Document } from 'mongoose';

export type ReservationStatus = 'ACTIVE' | 'CONSUMED' | 'RELEASED';
export type ReservationTargetType = 'HEAT_LOT' | 'INVENTORY_ITEM';

export type ShortageSeverity = 'NONE' | 'PARTIAL' | 'CRITICAL';

export interface IMaterialRequirement {
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade: string;
  uom: string;
  totalRequiredQuantity: number;
  totalAvailableQuantity: number;
  totalReservedQuantity: number;
  totalQuarantinedQuantity: number;
  netShortageQuantity: number;
  severity: ShortageSeverity;
  impactedPlans: {
    planId: string;
    planNumber: string;
    customerCode: string;
    requiredQuantity: number;
    targetCompletionDate: Date;
    priority: string;
  }[];
}

export interface IMaterialReservation {
  reservationNumber: string;
  tenantId: string;
  planId: string;
  planNumber: string;
  jobCardId?: string | null;
  jobCardNumber?: string | null;
  targetType: ReservationTargetType;
  targetId: string; // HeatLot ID or Item ID
  targetIdentifier: string; // HeatLot number or Item code
  itemId: string;
  itemCode: string;
  materialGrade: string;
  reservedQuantity: number;
  uom: string;
  status: ReservationStatus;
  reservedByActorId: string;
  releasedByActorId?: string | null;
  releaseReason?: string | null;
  releasedAt?: Date | null;
  consumedAt?: Date | null;
  notes?: string | null;
  isDeleted: boolean;
}

export interface MaterialReservationDocument extends IMaterialReservation, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalculateRequirementsDto {
  planIds?: string[];
  itemCodes?: string[];
  startDate?: string;
  endDate?: string;
}

export interface CreateReservationDto {
  planId: string;
  jobCardId?: string;
  targetType: ReservationTargetType;
  targetId: string; // HeatLot ID or Item ID
  reservedQuantity: number;
  notes?: string;
}

export interface ReleaseReservationDto {
  reason: string;
}

export interface QueryShortageDto {
  itemCode?: string;
  materialGrade?: string;
  severity?: ShortageSeverity;
  page?: number;
  limit?: number;
}
