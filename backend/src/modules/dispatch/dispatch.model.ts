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
    finishedGoodsId: { type: String, required: true },
    fgLotNumber: { type: String, required: true },
    jobId: { type: String, required: true },
    jobNumber: { type: String, required: true },
    heatLotNumber: { type: String },
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true },
    itemName: { type: String, required: true },
    materialGrade: { type: String },
    dispatchedQuantity: { type: Number, required: true, min: 0.001 },
    uom: { type: String, required: true, default: 'PCS' },
    packageDetails: { type: PackageDetailsSchema },
    qualityVerification: { type: QualityVerificationSchema },
    notes: { type: String }
  },
  { _id: false }
);

const DispatchCustomerSchema = new Schema(
  {
    customerId: { type: String, required: true },
    customerCode: { type: String, required: true },
    customerName: { type: String, required: true },
    destinationAddress: { type: String },
    contactPerson: { type: String },
    contactPhone: { type: String },
    purchaseOrderNumber: { type: String }
  },
  { _id: false }
);

const DispatchCarrierSchema = new Schema(
  {
    carrierName: { type: String },
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

const DispatchConsignmentSchema = new Schema<DispatchConsignmentDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    dispatchNumber: { type: String, required: true, uppercase: true },
    deliveryChallanNumber: { type: String, uppercase: true },
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
    vehicle: { type: DispatchVehicleSchema },
    driver: { type: DispatchDriverSchema },
    timeline: { type: DispatchTimelineSchema, required: true, default: () => ({ createdAt: new Date() }) },
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
DispatchConsignmentSchema.index({ tenantId: 1, 'customer.customerId': 1, status: 1 });
DispatchConsignmentSchema.index({ tenantId: 1, 'lines.jobId': 1 });
DispatchConsignmentSchema.index({ tenantId: 1, 'lines.heatLotNumber': 1 });

export const DispatchConsignmentModel =
  mongoose.models.DispatchConsignment ||
  mongoose.model<DispatchConsignmentDocument>('DispatchConsignment', DispatchConsignmentSchema);
