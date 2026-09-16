import mongoose, { Schema } from 'mongoose';
import { DispatchConsignmentDocument } from './dispatch.types.js';

const ActorSnapshotSchema = new Schema(
  {
    userId: { type: String, required: true },
    email: { type: String },
    role: { type: String }
  },
  { _id: false }
);

const PackageDetailsSchema = new Schema(
  {
    packagingType: { type: String, required: true, default: 'PALLET' },
    packageCount: { type: Number, required: true, default: 1 },
    grossWeightKg: { type: Number },
    netWeightKg: { type: Number },
    palletNumber: { type: String }
  },
  { _id: false }
);

const QualityVerificationSchema = new Schema(
  {
    isQualityApproved: { type: Boolean, required: true, default: false },
    inspectionId: { type: String },
    inspectionNumber: { type: String },
    cocId: { type: String },
    cocNumber: { type: String },
    testReportNumber: { type: String },
    verifiedAt: { type: Date },
    verifiedBy: { type: ActorSnapshotSchema },
    verificationNotes: { type: String }
  },
  { _id: false }
);

const DispatchLineSchema = new Schema(
  {
    lineId: { type: String, required: true },
    serialNumber: { type: Number },
    finishedGoodsId: { type: String, required: true },
    fgLotNumber: { type: String, required: true },
    jobId: { type: String, required: true },
    jobNumber: { type: String, required: true },
    heatLotNumber: { type: String },
    batchLotNumber: { type: String },
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true },
    partNumber: { type: String },
    itemName: { type: String, required: true },
    partName: { type: String },
    partDescription: { type: String },
    materialGrade: { type: String },
    heatTreatmentProcess: { type: String },
    dispatchedQuantity: { type: Number, required: true, min: 0.001 },
    quantity: { type: Number },
    uom: { type: String, required: true, default: 'PCS' },
    unitOfMeasure: { type: String },
    packageDetails: { type: PackageDetailsSchema },
    qualityVerification: { type: QualityVerificationSchema },
    notes: { type: String }
  },
  { _id: false }
);

const OutwardChallanItemSchema = new Schema(
  {
    serialNumber: { type: Number, required: true },
    partName: { type: String, required: true },
    partDescription: { type: String },
    partNumber: { type: String, required: true },
    materialGrade: { type: String, required: true },
    heatTreatmentProcess: { type: String, required: true },
    batchLotNumber: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitOfMeasure: { type: String, required: true, default: 'PCS' }
  },
  { _id: false }
);

const OutwardChallanHeatTreatmentSchema = new Schema(
  {
    furnaceEquipment: { type: String, required: true },
    furnaceId: { type: String },
    furnaceCode: { type: String },
    hardnessSpecification: { type: String, required: true },
    hardnessSpecificationDetails: {
      minHardness: { type: Number },
      maxHardness: { type: Number },
      scale: { type: String }
    },
    actualHardness: { type: String, required: true },
    actualHardnessValue: { type: Number },
    caseDepth: { type: String, required: true },
    effectiveCaseDepthMm: { type: Number },
    quantityReceived: { type: Number, required: true, min: 0 },
    quantityDelivered: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const DispatchCustomerSchema = new Schema(
  {
    customerId: { type: String, required: true },
    customerCode: { type: String, required: true },
    customerName: { type: String, required: true },
    destinationAddress: { type: String },
    address: { type: String },
    gstin: { type: String, uppercase: true },
    contactEmail: { type: String, lowercase: true },
    contactPerson: { type: String },
    contactPhone: { type: String },
    purchaseOrderNumber: { type: String }
  },
  { _id: false }
);

const DispatchCarrierSchema = new Schema(
  {
    carrierName: { type: String },
    transporter: { type: String },
    transportMode: {
      type: String,
      required: true,
      enum: ['ROAD', 'AIR', 'SEA', 'RAIL', 'CUSTOMER_PICKUP'],
      default: 'ROAD'
    },
    trackingNumber: { type: String },
    freightBillNumber: { type: String }
  },
  { _id: false }
);

const DispatchVehicleSchema = new Schema(
  {
    vehicleNumber: { type: String },
    vehicleType: { type: String },
    ewayBillNumber: { type: String },
    sealNumber: { type: String }
  },
  { _id: false }
);

const DispatchDriverSchema = new Schema(
  {
    driverName: { type: String },
    driverPhone: { type: String },
    driverLicenseNumber: { type: String }
  },
  { _id: false }
);

const DispatchTimelineSchema = new Schema(
  {
    createdAt: { type: Date, required: true, default: Date.now },
    qualityVerifiedAt: { type: Date },
    scheduledDepartureTime: { type: Date },
    approvedAt: { type: Date },
    actualDepartureTime: { type: Date },
    estimatedArrivalTime: { type: Date },
    actualDeliveryTime: { type: Date },
    cancelledAt: { type: Date }
  },
  { _id: false }
);

const DispatchApprovalsSchema = new Schema(
  {
    approvedBy: { type: ActorSnapshotSchema },
    approvedAt: { type: Date },
    approvalNotes: { type: String }
  },
  { _id: false }
);

const DispatchGatePassSchema = new Schema(
  {
    gatePassNumber: { type: String },
    securityOfficerName: { type: String },
    issuedAt: { type: Date },
    sealNumber: { type: String }
  },
  { _id: false }
);

const DispatchProofOfDeliverySchema = new Schema(
  {
    receiverName: { type: String },
    receiverSignatureRef: { type: String },
    podDocumentUrl: { type: String },
    receivedQuantity: { type: Number },
    receivedCondition: {
      type: String,
      enum: ['CONFORMING', 'DAMAGED', 'SHORTAGE'],
      default: 'CONFORMING'
    },
    podRecordedAt: { type: Date },
    remarks: { type: String }
  },
  { _id: false }
);

const DispatchCancellationSchema = new Schema(
  {
    cancelledBy: { type: ActorSnapshotSchema },
    cancellationReason: { type: String, required: true },
    cancelledAt: { type: Date, required: true, default: Date.now }
  },
  { _id: false }
);

const DispatchHistoryEntrySchema = new Schema(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    performedBy: { type: ActorSnapshotSchema, required: true },
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

const OutwardChallanHierarchySchema = new Schema(
  {
    poId: { type: String, required: true },
    poNumber: { type: String, required: true, uppercase: true },
    grnId: { type: String, required: true },
    grnNumber: { type: String, required: true, uppercase: true },
    batchOrderId: { type: String, required: true },
    batchOrderNumber: { type: String, required: true, uppercase: true },
    outwardChallanNumber: { type: String, required: true, uppercase: true },
    ocDate: { type: Date, required: true },
    customerName: { type: String },
    address: { type: String },
    gstin: { type: String, uppercase: true },
    contactEmail: { type: String, lowercase: true }
  },
  { _id: false }
);

const DeliveryInformationSchema = new Schema(
  {
    customerName: { type: String, required: true },
    address: { type: String, required: true },
    gstin: { type: String, uppercase: true },
    contactEmail: { type: String, lowercase: true }
  },
  { _id: false }
);

const OCUserReferenceSchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String },
    username: { type: String },
    email: { type: String },
    role: { type: String },
    designation: { type: String },
    preparedAt: { type: Date }
  },
  { _id: false }
);

const OCAuthorizedSignatorySchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String },
    username: { type: String },
    email: { type: String },
    role: { type: String },
    designation: { type: String },
    authorizedAt: { type: Date },
    signatureRef: { type: String }
  },
  { _id: false }
);

const CustomerAcknowledgementSchema = new Schema(
  {
    receivedBy: { type: String },
    signatureStampRef: { type: String },
    signatureRef: { type: String },
    stampRef: { type: String },
    date: { type: Date },
    acknowledgedDate: { type: Date },
    remarks: { type: String }
  },
  { _id: false }
);

const DispatchConsignmentSchema = new Schema<DispatchConsignmentDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    dispatchNumber: { type: String, required: true, uppercase: true },
    deliveryChallanNumber: { type: String, uppercase: true },
    outwardChallanNumber: { type: String, uppercase: true, trim: true },
    ocDate: { type: Date },
    batchOrderId: { type: String },
    batchOrderNumber: { type: String, uppercase: true },
    grnId: { type: String },
    grnNumber: { type: String, uppercase: true },
    poId: { type: String },
    poNumber: { type: String, uppercase: true },
    hierarchy: { type: OutwardChallanHierarchySchema },
    deliveryInformation: { type: DeliveryInformationSchema },
    items: { type: [OutwardChallanItemSchema], default: [] },
    heatTreatmentInformation: { type: OutwardChallanHeatTreatmentSchema },
    isOutwardChallan: { type: Boolean, default: false },
    status: {
      type: String,
      required: true,
      enum: [
        'DRAFT',
        'QUALITY_VERIFIED',
        'SCHEDULED',
        'APPROVED',
        'DISPATCHED',
        'DELIVERED',
        'CANCELLED'
      ],
      default: 'DRAFT',
      index: true
    },
    customer: { type: DispatchCustomerSchema, required: true },
    lines: { type: [DispatchLineSchema], default: [] },
    totalQuantity: { type: Number, required: true, min: 0, default: 0 },
    totalPackages: { type: Number, required: true, min: 0, default: 0 },
    totalNetWeightKg: { type: Number },
    totalGrossWeightKg: { type: Number },
    carrier: { type: DispatchCarrierSchema, required: true, default: () => ({ transportMode: 'ROAD' }) },
    transporter: { type: String },
    vehicle: { type: DispatchVehicleSchema },
    vehicleNumber: { type: String },
    dispatchDate: { type: Date },
    ewayBillNumber: { type: String },
    driver: { type: DispatchDriverSchema },
    timeline: { type: DispatchTimelineSchema, required: true, default: () => ({ createdAt: new Date() }) },
    dispatchedBy: { type: ActorSnapshotSchema },
    dispatchedAt: { type: Date },
    preparedBy: { type: OCUserReferenceSchema },
    authorizedSignatory: { type: OCAuthorizedSignatorySchema },
    customerAcknowledgement: { type: CustomerAcknowledgementSchema },
    approvals: { type: DispatchApprovalsSchema },
    gatePass: { type: DispatchGatePassSchema },
    proofOfDelivery: { type: DispatchProofOfDeliverySchema },
    cancellation: { type: DispatchCancellationSchema },
    history: { type: [DispatchHistoryEntrySchema], default: [] },
    notes: { type: String },
    isDeleted: { type: Boolean, required: true, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

DispatchConsignmentSchema.index({ tenantId: 1, dispatchNumber: 1 }, { unique: true });
DispatchConsignmentSchema.index({ tenantId: 1, deliveryChallanNumber: 1 });
DispatchConsignmentSchema.index({ tenantId: 1, outwardChallanNumber: 1 });
DispatchConsignmentSchema.index({ tenantId: 1, batchOrderId: 1 });
DispatchConsignmentSchema.index({ tenantId: 1, grnId: 1 });
DispatchConsignmentSchema.index({ tenantId: 1, poId: 1 });
DispatchConsignmentSchema.index({ tenantId: 1, 'customer.customerId': 1, status: 1 });
DispatchConsignmentSchema.index({ tenantId: 1, 'lines.jobId': 1 });
DispatchConsignmentSchema.index({ tenantId: 1, 'lines.heatLotNumber': 1 });
DispatchConsignmentSchema.index({ tenantId: 1, 'authorizedSignatory.userId': 1 });

export const DispatchConsignmentModel =
  mongoose.models.DispatchConsignment ||
  mongoose.model<DispatchConsignmentDocument>('DispatchConsignment', DispatchConsignmentSchema);
