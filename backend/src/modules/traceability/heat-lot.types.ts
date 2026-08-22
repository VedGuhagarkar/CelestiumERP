import { Document } from 'mongoose';
import { UnitOfMeasure } from '../item/item.types.js';

export type HeatLotStatus =
  | 'INWARDED'
  | 'QUARANTINED'
  | 'RELEASED'
  | 'CONSUMED'
  | 'EXHAUSTED'
  | 'REJECTED';

export type LineageSourceType =
  | 'RAW_MILL_HEAT'
  | 'INGOT_SPLIT'
  | 'RE_MELT'
  | 'INTERNAL_RECLASSIFICATION';

export interface ChemicalComposition {
  [element: string]: number;
}

export interface HeatLotAllocation {
  allocationId: string;
  jobCardId: string;
  jobCardNumber: string;
  customerCode?: string;
  quantity: number;
  allocatedAt: Date;
  status: 'RESERVED' | 'ISSUED' | 'RELEASED' | 'CANCELLED';
}

export interface HeatLotConsumption {
  transactionId: string;
  jobCardId: string;
  jobCardNumber: string;
  customerCode?: string;
  furnaceId?: string;
  batchNumber?: string;
  quantityConsumed: number;
  consumedAt: Date;
  operatorId: string;
}

export interface HeatLotLineage {
  parentHeatLotIds?: string[];
  childHeatLotIds?: string[];
  sourceType: LineageSourceType;
  notes?: string;
}

export interface IHeatLot {
  tenantId: string;
  heatLotNumber: string;
  itemId: string;
  itemCode: string;
  materialGrade: string;
  supplierHeatNumber: string;
  supplierLotNumber?: string;
  supplierName?: string;
  mtrNumber?: string;
  chemicalComposition?: ChemicalComposition;
  receivedDate: Date;
  receivedQuantity: number;
  uom: UnitOfMeasure;
  currentQuantity: number;
  allocatedQuantity: number;
  consumedQuantity: number;
  storageLocation: string;
  status: HeatLotStatus;
  quarantineReason?: string;
  testCertReferences: string[];
  allocations: HeatLotAllocation[];
  consumptionHistory: HeatLotConsumption[];
  lineage: HeatLotLineage;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HeatLotDocument extends IHeatLot, Document {}

export interface InwardHeatLotDto {
  heatLotNumber?: string;
  itemId: string;
  itemCode?: string;
  materialGrade: string;
  supplierHeatNumber: string;
  supplierLotNumber?: string;
  supplierName?: string;
  mtrNumber?: string;
  chemicalComposition?: ChemicalComposition;
  receivedDate?: Date;
  receivedQuantity: number;
  uom: UnitOfMeasure;
  storageLocation: string;
  status?: HeatLotStatus;
  quarantineReason?: string;
  testCertReferences?: string[];
  lineage?: {
    parentHeatLotIds?: string[];
    sourceType?: LineageSourceType;
    notes?: string;
  };
}

export interface AllocateHeatLotDto {
  jobCardId: string;
  jobCardNumber: string;
  customerCode?: string;
  quantity: number;
}

export interface ConsumeHeatLotDto {
  jobCardId: string;
  jobCardNumber: string;
  customerCode?: string;
  furnaceId?: string;
  batchNumber?: string;
  quantity: number;
  operatorId: string;
}

export interface QuarantineHeatLotDto {
  quarantineReason: string;
}

export interface ReleaseHeatLotDto {
  releaseNotes?: string;
}

export interface HeatLotFilterQuery {
  search?: string;
  itemId?: string;
  itemCode?: string;
  materialGrade?: string;
  supplierHeatNumber?: string;
  mtrNumber?: string;
  status?: HeatLotStatus;
  storageLocation?: string;
}

export interface ForwardTraceResult {
  heatLot: IHeatLot;
  downstreamJobs: Array<{
    jobCardId: string;
    jobCardNumber: string;
    customerCode?: string;
    furnaceId?: string;
    batchNumber?: string;
    quantityConsumed: number;
    consumedAt: Date;
  }>;
  childHeatLots: IHeatLot[];
}

export interface BackwardTraceResult {
  jobCardNumber: string;
  matchedHeatLots: Array<{
    heatLotNumber: string;
    supplierHeatNumber: string;
    supplierName?: string;
    mtrNumber?: string;
    materialGrade: string;
    chemicalComposition?: ChemicalComposition;
    receivedDate: Date;
    quantityConsumed: number;
    consumedAt: Date;
  }>;
}
