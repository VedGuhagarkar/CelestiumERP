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

export function validateTransporter(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  const meaningless = /^(na|n\/a|none|null|nil|unknown|test|---|--|\.\.\.|\.|\_)$/i;
  if (meaningless.test(trimmed)) return false;
  const alphanumericCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
  return alphanumericCount >= 2;
}

export function validateVehicleNumber(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim().toUpperCase();
  if (trimmed.length < 5 || trimmed.length > 20) return false;
  const meaningless = /^(invalid|unknown|placeholder|vehicle|truck|car|none|null|n\/a|\?\?\?)$/i;
  if (meaningless.test(trimmed)) return false;

  const indianFormat = /^[A-Z]{2}[ -]?[0-9]{1,2}(?:[ -]?[A-Z]{1,3})?[ -]?[0-9]{4}$/;
  const fleetFormat = /^[A-Z0-9- ]{5,20}$/;
  const hasLetters = /[A-Z]/.test(trimmed);
  const hasDigits = /[0-9]/.test(trimmed);

  return indianFormat.test(trimmed) || (fleetFormat.test(trimmed) && hasLetters && hasDigits);
}

export function validateEwayBillNumber(val?: string | null): boolean {
  if (val === undefined || val === null || val === '') return true; // Optional
  const trimmed = val.trim();
  const numeric12 = /^\d{12}$/;
  const ewbPattern = /^EWB-[A-Z0-9-]{6,16}$/i;
  const alphanumeric12to18 = /^[A-Z0-9]{12,18}$/i;
  return numeric12.test(trimmed) || ewbPattern.test(trimmed) || alphanumeric12to18.test(trimmed);
}

export function validateDispatchDate(val?: any): boolean {
  if (!val) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

export const physicalDispatchSchema = z
  .object({
    transporter: z.string().optional(),
    carrierName: z.string().optional(),
    vehicleNumber: z.string({ required_error: 'Vehicle number is required' }).min(1, 'Vehicle number is required'),
    dispatchDate: z.any({ required_error: 'Dispatch date is required' }),
    ewayBillNumber: z.string().optional().nullable(),
    securityOfficerName: z.string().optional(),
    sealNumber: z.string().optional(),
    remarks: z.string().optional(),
    notes: z.string().optional(),
    driverName: z.string().optional(),
    driverPhone: z.string().optional(),
    driverLicenseNumber: z.string().optional(),
    transportMode: TransportModeEnum.optional().default('ROAD')
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const rawTransporter = data.transporter || data.carrierName;
    if (!rawTransporter || !validateTransporter(rawTransporter)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transporter'],
        message: 'A valid transporter name is required (min 2 meaningful characters, no placeholders)'
      });
    }

    if (!data.vehicleNumber || !validateVehicleNumber(data.vehicleNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vehicleNumber'],
        message: 'A valid vehicle registration number is required (e.g. MH-12-AB-9901 or standard fleet pattern)'
      });
    }

    if (!validateDispatchDate(data.dispatchDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dispatchDate'],
        message: 'A valid dispatch date is required'
      });
    }

    if (data.ewayBillNumber !== undefined && data.ewayBillNumber !== null && data.ewayBillNumber !== '') {
      if (!validateEwayBillNumber(data.ewayBillNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ewayBillNumber'],
          message: 'Invalid E-Way Bill format. Must be a 12-digit numeric or standard E-Way Bill identifier'
        });
      }
    }
  });

export const departDispatchSchema = z
  .object({
    transporter: z.string().optional(),
    carrierName: z.string().optional(),
    vehicleNumber: z.string().optional(),
    dispatchDate: z.any().optional(),
    ewayBillNumber: z.string().optional().nullable(),
    securityOfficerName: z.string().min(2, 'Security officer name is required for gate clearance').optional(),
    sealNumber: z.string().optional(),
    actualDepartureTime: z.string().optional(),
    notes: z.string().optional(),
    remarks: z.string().optional()
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const rawTransporter = data.transporter || data.carrierName;
    if (rawTransporter && !validateTransporter(rawTransporter)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transporter'],
        message: 'Invalid transporter name provided'
      });
    }
    if (data.vehicleNumber && !validateVehicleNumber(data.vehicleNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vehicleNumber'],
        message: 'Invalid vehicle number format provided'
      });
    }
    if (data.dispatchDate && !validateDispatchDate(data.dispatchDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dispatchDate'],
        message: 'Invalid dispatch date provided'
      });
    }
    if (data.ewayBillNumber && !validateEwayBillNumber(data.ewayBillNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ewayBillNumber'],
        message: 'Invalid E-Way Bill format'
      });
    }
  });

export const authorizeDispatchSchema = z.object({
  signatoryUserId: z.string().optional(),
  authorizedSignatoryId: z.string().optional(),
  signatureRef: z.string().optional(),
  designation: z.string().optional(),
  approvalNotes: z.string().optional(),
  notes: z.string().optional()
});

export const customerAcknowledgementSchema = z.object({
  receivedBy: z.string().optional(),
  signatureStampRef: z.string().optional(),
  signatureRef: z.string().optional(),
  stampRef: z.string().optional(),
  date: z.any().optional(),
  acknowledgedDate: z.any().optional(),
  remarks: z.string().optional(),
  receivedQuantity: z.number().positive().optional(),
  receivedCondition: DeliveryConditionEnum.optional(),
  podDocumentUrl: z.string().optional()
});

export const deliverDispatchSchema = z.object({
  receiverName: z.string().optional(),
  receivedBy: z.string().optional(),
  receivedQuantity: z.number().positive().optional(),
  receivedCondition: DeliveryConditionEnum.default('CONFORMING').optional(),
  receiverSignatureRef: z.string().optional(),
  signatureStampRef: z.string().optional(),
  signatureRef: z.string().optional(),
  stampRef: z.string().optional(),
  podDocumentUrl: z.string().optional(),
  actualDeliveryTime: z.string().optional(),
  date: z.any().optional(),
  acknowledgedDate: z.any().optional(),
  remarks: z.string().optional()
});

export const cancelDispatchSchema = z.object({
  cancellationReason: z.string().min(5, 'A clear cancellation reason is mandatory (min 5 chars)')
});

export const createOutwardChallanSchema = z
  .object({
    batchOrderId: z.string().min(1, 'Batch Order ID is required'),
    grnId: z.string().optional(),
    poId: z.string().optional(),
    transporter: z.string().optional(),
    carrierName: z.string().optional(),
    transportMode: TransportModeEnum.optional().default('ROAD'),
    vehicleNumber: z.string().optional(),
    driverName: z.string().optional(),
    destinationAddress: z.string().optional(),
    packageDetails: PackageDetailsSchema.optional(),
    notes: z.string().optional(),
    preparedById: z.string().optional(),
    authorizedSignatoryId: z.string().optional(),
    signatureRef: z.string().optional()
  })
  .passthrough()
  .superRefine((data: any, ctx) => {
    const rawTransporter = data.transporter || data.carrierName;
    if (rawTransporter !== undefined && !validateTransporter(rawTransporter)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transporter'],
        message: 'Invalid transporter provided'
      });
    }
    if (data.vehicleNumber !== undefined && !validateVehicleNumber(data.vehicleNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vehicleNumber'],
        message: 'Invalid vehicle number format provided'
      });
    }
    if (
      data.ewayBillNumber !== undefined &&
      data.ewayBillNumber !== null &&
      data.ewayBillNumber !== '' &&
      !validateEwayBillNumber(data.ewayBillNumber)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ewayBillNumber'],
        message: 'Invalid E-Way Bill format'
      });
    }
  });

export const queryDispatchesSchema = z.object({
  status: DispatchStatusEnum.optional(),
  customerId: z.string().optional(),
  customerCode: z.string().optional(),
  jobNumber: z.string().optional(),
  heatLotNumber: z.string().optional(),
  dispatchNumber: z.string().optional(),
  deliveryChallanNumber: z.string().optional(),
  outwardChallanNumber: z.string().optional(),
  batchOrderId: z.string().optional(),
  grnId: z.string().optional(),
  poId: z.string().optional(),
  isOutwardChallan: z.coerce.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});
