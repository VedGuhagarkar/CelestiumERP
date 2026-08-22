import { Document } from 'mongoose';

export type DispatchStatus =
  | 'DRAFT'
  | 'QUALITY_VERIFIED'
  | 'SCHEDULED'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export type TransportMode = 'ROAD' | 'AIR' | 'SEA' | 'RAIL' | 'CUSTOMER_PICKUP';

export type DeliveryCondition = 'CONFORMING' | 'DAMAGED' | 'SHORTAGE';

export interface IActorSnapshot {
  userId: string;
  email?: string;
  role?: string;
}

export interface IDispatchLinePackageDetails {
  packagingType: string;
  packageCount: number;
  grossWeightKg?: number;
  netWeightKg?: number;
  palletNumber?: string;
}

export interface IDispatchQualityVerification {
  isQualityApproved: boolean;
  inspectionId?: string;
  inspectionNumber?: string;
  cocId?: string;
  cocNumber?: string;
  testReportNumber?: string;
  verifiedAt?: Date;
  verifiedBy?: IActorSnapshot;
  verificationNotes?: string;
}

export interface IDispatchLine {
  lineId: string;
  finishedGoodsId: string;
  fgLotNumber: string;
  jobId: string;
  jobNumber: string;
  heatLotNumber?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  materialGrade?: string;
  dispatchedQuantity: number;
  uom: string;
  packageDetails?: IDispatchLinePackageDetails;
  qualityVerification?: IDispatchQualityVerification;
  notes?: string;
}

export interface IDispatchCustomer {
  customerId: string;
  customerCode: string;
  customerName: string;
  destinationAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  purchaseOrderNumber?: string;
}

export interface IDispatchCarrier {
  carrierName?: string;
  transportMode: TransportMode;
  trackingNumber?: string;
  freightBillNumber?: string;
}

export interface IDispatchVehicle {
  vehicleNumber?: string;
  vehicleType?: string;
  ewayBillNumber?: string;
  sealNumber?: string;
}

export interface IDispatchDriver {
  driverName?: string;
  driverPhone?: string;
  driverLicenseNumber?: string;
}

export interface IDispatchTimeline {
  createdAt: Date;
  qualityVerifiedAt?: Date;
  scheduledDepartureTime?: Date;
  approvedAt?: Date;
  actualDepartureTime?: Date;
  estimatedArrivalTime?: Date;
  actualDeliveryTime?: Date;
  cancelledAt?: Date;
}

export interface IDispatchApprovals {
  approvedBy?: IActorSnapshot;
  approvedAt?: Date;
  approvalNotes?: string;
}

export interface IDispatchGatePass {
  gatePassNumber?: string;
  securityOfficerName?: string;
  issuedAt?: Date;
  sealNumber?: string;
}

export interface IDispatchProofOfDelivery {
  receiverName?: string;
  receiverSignatureRef?: string;
  podDocumentUrl?: string;
  receivedQuantity?: number;
  receivedCondition: DeliveryCondition;
  podRecordedAt?: Date;
  remarks?: string;
}

export interface IDispatchCancellation {
  cancelledBy?: IActorSnapshot;
  cancellationReason: string;
  cancelledAt: Date;
}

export interface IDispatchHistoryEntry {
  fromStatus: DispatchStatus;
  toStatus: DispatchStatus;
  timestamp: Date;
  performedBy: IActorSnapshot;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface IDispatchConsignment {
  tenantId: string;
  dispatchNumber: string;
  deliveryChallanNumber?: string;
  status: DispatchStatus;
  customer: IDispatchCustomer;
  lines: IDispatchLine[];
  totalQuantity: number;
  totalPackages: number;
  totalNetWeightKg?: number;
  totalGrossWeightKg?: number;
  carrier: IDispatchCarrier;
  vehicle?: IDispatchVehicle;
  driver?: IDispatchDriver;
  timeline: IDispatchTimeline;
  approvals?: IDispatchApprovals;
  gatePass?: IDispatchGatePass;
  proofOfDelivery?: IDispatchProofOfDelivery;
  cancellation?: IDispatchCancellation;
  history: IDispatchHistoryEntry[];
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DispatchConsignmentDocument extends IDispatchConsignment, Document {}

// DTOs
export interface CreateDispatchLineDto {
  finishedGoodsId: string;
  dispatchedQuantity: number;
  packageDetails?: IDispatchLinePackageDetails;
  notes?: string;
}

export interface CreateDispatchDto {
  customerId: string;
  purchaseOrderNumber?: string;
  destinationAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  transportMode?: TransportMode;
  carrierName?: string;
  scheduledDepartureTime?: string;
  lines: CreateDispatchLineDto[];
  notes?: string;
}

export interface VerifyDispatchQualityDto {
  verificationNotes?: string;
}

export interface ScheduleDispatchDto {
  scheduledDepartureTime: string;
  estimatedArrivalTime?: string;
  carrierName?: string;
  transportMode?: TransportMode;
  trackingNumber?: string;
  freightBillNumber?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  ewayBillNumber?: string;
  driverName?: string;
  driverPhone?: string;
  driverLicenseNumber?: string;
  notes?: string;
}

export interface ApproveDispatchDto {
  approvalNotes?: string;
}

export interface DepartDispatchDto {
  securityOfficerName: string;
  sealNumber?: string;
  vehicleNumber?: string;
  driverName?: string;
  actualDepartureTime?: string;
  notes?: string;
}

export interface DeliverDispatchDto {
  receiverName: string;
  receivedQuantity?: number;
  receivedCondition: DeliveryCondition;
  receiverSignatureRef?: string;
  podDocumentUrl?: string;
  actualDeliveryTime?: string;
  remarks?: string;
}

export interface CancelDispatchDto {
  cancellationReason: string;
}

export interface QueryDispatchesDto {
  status?: DispatchStatus;
  customerId?: string;
  customerCode?: string;
  jobNumber?: string;
  heatLotNumber?: string;
  dispatchNumber?: string;
  deliveryChallanNumber?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}
