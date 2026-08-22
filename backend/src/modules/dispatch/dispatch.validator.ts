import { z } from 'zod';

export const TransportModeEnum = z.enum(['ROAD', 'AIR', 'SEA', 'RAIL', 'CUSTOMER_PICKUP']);

export const DeliveryConditionEnum = z.enum(['CONFORMING', 'DAMAGED', 'SHORTAGE']);

export const DispatchStatusEnum = z.enum([
  'DRAFT',
  'QUALITY_VERIFIED',
  'SCHEDULED',
  'APPROVED',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED'
]);

export const PackageDetailsSchema = z.object({
  packagingType: z.string().min(1, 'Packaging type is required').default('PALLET'),
  packageCount: z.number().int().positive('Package count must be a positive integer').default(1),
  grossWeightKg: z.number().positive('Gross weight must be positive').optional(),
  netWeightKg: z.number().positive('Net weight must be positive').optional(),
  palletNumber: z.string().optional()
});

export const CreateDispatchLineSchema = z.object({
  finishedGoodsId: z.string().min(1, 'Finished goods ID is required'),
  dispatchedQuantity: z.number().positive('Dispatched quantity must be greater than 0'),
  packageDetails: PackageDetailsSchema.optional(),
  notes: z.string().optional()
});

export const createDispatchSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  purchaseOrderNumber: z.string().optional(),
  destinationAddress: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  transportMode: TransportModeEnum.optional().default('ROAD'),
  carrierName: z.string().optional(),
  scheduledDepartureTime: z.string().datetime().optional(),
  lines: z.array(CreateDispatchLineSchema).min(1, 'At least one dispatch item line is required'),
  notes: z.string().optional()
});

export const verifyDispatchQualitySchema = z.object({
  verificationNotes: z.string().optional()
});

export const scheduleDispatchSchema = z.object({
  scheduledDepartureTime: z.string().datetime({ message: 'Valid ISO datetime required for scheduledDepartureTime' }),
  estimatedArrivalTime: z.string().datetime().optional(),
  carrierName: z.string().optional(),
  transportMode: TransportModeEnum.optional().default('ROAD'),
  trackingNumber: z.string().optional(),
  freightBillNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  ewayBillNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  driverLicenseNumber: z.string().optional(),
  notes: z.string().optional()
});

export const approveDispatchSchema = z.object({
  approvalNotes: z.string().optional()
});

export const departDispatchSchema = z.object({
  securityOfficerName: z.string().min(2, 'Security officer name is required for gate clearance'),
  sealNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  actualDepartureTime: z.string().datetime().optional(),
  notes: z.string().optional()
});

export const deliverDispatchSchema = z.object({
  receiverName: z.string().min(2, 'Receiver name is required for Proof of Delivery'),
  receivedQuantity: z.number().positive().optional(),
  receivedCondition: DeliveryConditionEnum.default('CONFORMING'),
  receiverSignatureRef: z.string().optional(),
  podDocumentUrl: z.string().optional(),
  actualDeliveryTime: z.string().datetime().optional(),
  remarks: z.string().optional()
});

export const cancelDispatchSchema = z.object({
  cancellationReason: z.string().min(5, 'A clear cancellation reason is mandatory (min 5 chars)')
});

export const queryDispatchesSchema = z.object({
  status: DispatchStatusEnum.optional(),
  customerId: z.string().optional(),
  customerCode: z.string().optional(),
  jobNumber: z.string().optional(),
  heatLotNumber: z.string().optional(),
  dispatchNumber: z.string().optional(),
  deliveryChallanNumber: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});
