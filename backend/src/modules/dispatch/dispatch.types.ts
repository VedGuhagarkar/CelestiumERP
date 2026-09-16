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

export interface IOCUserReference {
  userId: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  designation?: string;
  preparedAt?: Date;
}

export interface IOCAuthorizedSignatory {
  userId: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  designation?: string;
  authorizedAt?: Date;
  signatureRef?: string;
}

export interface ICustomerAcknowledgement {
  receivedBy?: string;
  signatureStampRef?: string;
  signatureRef?: string;
  stampRef?: string;
  date?: Date;
  acknowledgedDate?: Date;
  remarks?: string;
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

export interface IOutwardChallanItem {
  serialNumber: number;
  partName: string;
  partDescription?: string;
  partNumber: string;
  materialGrade: string;
  heatTreatmentProcess: string;
  batchLotNumber: string;
  quantity: number;
  unitOfMeasure: string;
}

export interface IOutwardChallanHeatTreatment {
  furnaceEquipment: string;
  furnaceId?: string;
  furnaceCode?: string;
  hardnessSpecification: string;
  hardnessSpecificationDetails?: {
    minHardness?: number;
    maxHardness?: number;
    scale?: string;
  };
  actualHardness: string;
  actualHardnessValue?: number;
  caseDepth: string;
  effectiveCaseDepthMm?: number;
  quantityReceived: number;
  quantityDelivered: number;
}

export interface IDispatchLine {
  lineId: string;
  serialNumber?: number;
  finishedGoodsId: string;
  fgLotNumber: string;
  jobId: string;
  jobNumber: string;
  heatLotNumber?: string;
  batchLotNumber?: string;
  itemId: string;
  itemCode: string;
  partNumber?: string;
  itemName: string;
  partName?: string;
  partDescription?: string;
  materialGrade?: string;
  heatTreatmentProcess?: string;
  dispatchedQuantity: number;
  quantity?: number;
  uom: string;
  unitOfMeasure?: string;
  packageDetails?: IDispatchLinePackageDetails;
  qualityVerification?: IDispatchQualityVerification;
  notes?: string;
}

export interface IDispatchCustomer {
  customerId: string;
  customerCode: string;
  customerName: string;
  destinationAddress?: string;
  address?: string;
  gstin?: string;
  contactEmail?: string | null;
  contactPerson?: string;
  contactPhone?: string;
  purchaseOrderNumber?: string;
}

export interface IDispatchDeliveryInformation {
  customerName: string;
  address: string;
  gstin?: string;
  contactEmail?: string | null;
}

export interface IDispatchCarrier {
  carrierName?: string;
  transporter?: string;
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

export interface IOutwardChallanHierarchy {
  poId: string;
  poNumber: string;
  grnId: string;
  grnNumber: string;
  batchOrderId: string;
  batchOrderNumber: string;
  outwardChallanNumber: string;
  ocDate: Date;
  customerName?: string;
  address?: string;
  gstin?: string;
  contactEmail?: string | null;
}

export interface IDispatchConsignment {
  tenantId: string;
  dispatchNumber: string;
  deliveryChallanNumber?: string;
  outwardChallanNumber?: string;
  ocDate?: Date;
  batchOrderId?: string;
  batchOrderNumber?: string;
  grnId?: string;
  grnNumber?: string;
  poId?: string;
  poNumber?: string;
  hierarchy?: IOutwardChallanHierarchy;
  deliveryInformation?: IDispatchDeliveryInformation;
  items?: IOutwardChallanItem[];
  heatTreatmentInformation?: IOutwardChallanHeatTreatment;
  isOutwardChallan?: boolean;
  status: DispatchStatus;
  customer: IDispatchCustomer;
  lines: IDispatchLine[];
  totalQuantity: number;
  totalPackages: number;
  totalNetWeightKg?: number;
  totalGrossWeightKg?: number;
  carrier: IDispatchCarrier;
  transporter?: string;
  vehicle?: IDispatchVehicle;
  vehicleNumber?: string;
  dispatchDate?: Date;
  ewayBillNumber?: string;
  driver?: IDispatchDriver;
  timeline: IDispatchTimeline;
  dispatchedBy?: IActorSnapshot;
  dispatchedAt?: Date;
  preparedBy?: IOCUserReference;
  authorizedSignatory?: IOCAuthorizedSignatory;
  customerAcknowledgement?: ICustomerAcknowledgement;
  approvals?: IDispatchApprovals;
  gatePass?: IDispatchGatePass;
  proofOfDelivery?: IDispatchProofOfDelivery;
  cancellation?: IDispatchCancellation;
  history: IDispatchHistoryEntry[];
  notes?: string;
  printCount?: number;
  printedAt?: Date;
  printedBy?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrintableOutwardChallanResult {
  outwardChallan: IDispatchConsignment;
  htmlReport: string;
  htmlDocument?: string;
  printCount?: number;
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
  signatoryUserId?: string;
  authorizedSignatoryId?: string;
  signatureRef?: string;
}

export interface AuthorizeDispatchDto {
  signatoryUserId?: string;
  authorizedSignatoryId?: string;
  signatureRef?: string;
  designation?: string;
  approvalNotes?: string;
  notes?: string;
}

export interface CustomerAcknowledgementDto {
  receivedBy?: string;
  signatureStampRef?: string;
  signatureRef?: string;
  stampRef?: string;
  date?: string | Date;
  acknowledgedDate?: string | Date;
  remarks?: string;
  receivedQuantity?: number;
  receivedCondition?: DeliveryCondition;
  podDocumentUrl?: string;
}

export interface PhysicalDispatchDto {
  transporter?: string;
  carrierName?: string;
  vehicleNumber?: string;
  dispatchDate?: string | Date;
  ewayBillNumber?: string;
  securityOfficerName?: string;
  sealNumber?: string;
  remarks?: string;
  driverName?: string;
  driverPhone?: string;
  driverLicenseNumber?: string;
  transportMode?: TransportMode;
  notes?: string;
  dispatchedBy?: any; // Ignored if supplied by client in favor of authenticated actor
  authorizedSignatoryId?: string;
  authorizedSignatory?: any;
}

export interface DepartDispatchDto extends Partial<PhysicalDispatchDto> {
  actualDepartureTime?: string | Date;
  securityOfficerName?: string;
  sealNumber?: string;
  remarks?: string;
}

export interface DeliverDispatchDto extends CustomerAcknowledgementDto {
  actualDeliveryTime?: string | Date;
  receiverName?: string;
  receiverSignatureRef?: string;
  podDocumentUrl?: string;
  receivedQuantity?: number;
  receivedCondition?: DeliveryCondition;
  remarks?: string;
}

export interface CancelDispatchDto {
  cancellationReason: string;
}

export interface CreateOutwardChallanDto {
  batchOrderId: string;
  grnId?: string;
  poId?: string;
  carrierName?: string;
  transportMode?: TransportMode;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  destinationAddress?: string;
  packageDetails?: IDispatchLinePackageDetails;
  notes?: string;
  // Optional client-supplied fields (must be ignored or rejected by backend in favor of authoritative BO/GRN data)
  customerName?: string;
  customer?: any;
  address?: string;
  gstin?: string;
  contactEmail?: string | null;
  ocDate?: string | Date;
  items?: any[];
  heatTreatmentInformation?: any;
  heatTreatment?: any;
  furnaceEquipment?: string;
  hardnessSpecification?: string;
  actualHardness?: string;
  caseDepth?: string;
  quantity?: number;
  dispatchedQuantity?: number;
  quantityReceived?: number;
  quantityDelivered?: number;
  recipeId?: string;
  recipeCode?: string;
  materialGrade?: string;
  partNumber?: string;
  partName?: string;
  partDescription?: string;
  serialNumber?: number;
  batchLotNumber?: string;
  preparedById?: string;
  preparedBy?: any;
  authorizedSignatoryId?: string;
  authorizedSignatory?: any;
  signatureRef?: string;
}

export interface QueryDispatchesDto {
  status?: DispatchStatus;
  customerId?: string;
  customerCode?: string;
  jobNumber?: string;
  heatLotNumber?: string;
  dispatchNumber?: string;
  deliveryChallanNumber?: string;
  outwardChallanNumber?: string;
  batchOrderId?: string;
  grnId?: string;
  poId?: string;
  isOutwardChallan?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
}
