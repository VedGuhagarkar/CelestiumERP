import { z } from 'zod';
import { ValidationSchema } from '../../core/middleware/validate.middleware.js';

const jobStatusEnum = z.enum([
  'WAITING_FOR_PRODUCTION',
  'IN_PRODUCTION',
  'WAITING_FOR_INSPECTION',
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'IN_PROGRESS',
  'PAUSED',
  'QUALITY_CHECK',
  'STORAGE',
  'READY_FOR_DISPATCH',
  'DISPATCHED',
  'COMPLETED',
  'CANCELLED'
]);

const jobPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'AOG_CRITICAL']);

const shiftEnum = z.enum([
  'SHIFT_1_MORNING',
  'SHIFT_2_EVENING',
  'SHIFT_3_NIGHT',
  'GENERAL_DAY',
  'SHIFT_A',
  'SHIFT_B',
  'SHIFT_C'
]);

const stageProgressTypeEnum = z.enum(['PREHEAT', 'SOAK', 'QUENCH', 'TEMPER', 'OTHER']);

const downtimeCategoryEnum = z.enum([
  'MECHANICAL_FAILURE',
  'ELECTRICAL_FAILURE',
  'ATMOSPHERE_LOSS',
  'POWER_OUTAGE',
  'OPERATOR_BREAK',
  'PLANNED_STOP',
  'UNPLANNED_STOP',
  'PROCESS_ABORT',
  'OTHER'
]);

const productionLogTypeEnum = z.enum([
  'SHIFT_HANDOVER',
  'OPERATOR_NOTE',
  'PYROMETRY_READING',
  'ATMOSPHERE_ADJUSTMENT',
  'ANOMALY_REPORT'
]);

export const processRowStatusEnum = z.enum([
  'BLANK',
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED'
]);

export const processDetailRowValidatorSchema = z
  .object({
    serialNumber: z.number().int().min(1).max(15).optional(),
    partId: z.string().trim().nullable().optional(),
    partCode: z.string().trim().nullable().optional(),
    partName: z.string().trim().nullable().optional(),
    process: z.string().trim().nullable().optional(),
    recipeId: z.string().trim().nullable().optional(),
    recipeCode: z.string().trim().nullable().optional(),
    minhardness: z.number().min(0, 'minhardness must be non-negative').nullable().optional(),
    maxhardness: z.number().min(0, 'maxhardness must be non-negative').nullable().optional(),
    userId: z.string().trim().nullable().optional(),
    userName: z.string().trim().nullable().optional(),
    status: processRowStatusEnum.optional().default('BLANK'),
    notes: z.string().trim().max(1000).nullable().optional()
  })
  .superRefine((data, ctx) => {
    if (
      data.minhardness !== undefined &&
      data.minhardness !== null &&
      data.maxhardness !== undefined &&
      data.maxhardness !== null &&
      data.maxhardness < data.minhardness
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxhardness must be greater than or equal to minhardness',
        path: ['maxhardness']
      });
    }
  });

export const createBatchOrderSchema: ValidationSchema = {
  body: z
    .object({
      poId: z.string().trim().min(1, 'Purchase Order ID (poId) is required'),
      grnId: z.string().trim().min(1, 'Goods Receipt Note ID (grnId) is required'),
      itemId: z.string().trim().min(1, 'Part / Item ID (itemId) is required'),
      recipeId: z.string().trim().min(1, 'Recipe ID (recipeId) is required').optional(),
      specificationId: z.string().trim().optional(),
      targetQuantity: z.number().optional(),
      quantity: z.number().optional(),
      weight: z.number().optional(),
      weightKg: z.number().optional(),
      dueDate: z.string().or(z.date()).optional(),
      priority: jobPriorityEnum.optional().default('NORMAL'),
      plannedStartDate: z.string().or(z.date()).optional(),
      targetCompletionDate: z.string().or(z.date()).optional(),
      assignedFurnaceId: z.string().trim().optional(),
      assignedOperatorId: z.string().trim().optional(),
      shift: z.string().trim().optional(),
      notes: z.string().trim().max(1000).optional(),
      idempotencyKey: z.string().trim().optional(),
      processDetails: z.array(processDetailRowValidatorSchema).max(15, 'Maximum 15 process rows allowed').optional(),
      customer: z
        .object({
          customerId: z.string().optional(),
          customerCode: z.string().optional(),
          customerName: z.string().optional()
        })
        .optional(),
      customerId: z.string().trim().optional(),
      customerCode: z.string().trim().optional(),
      customerName: z.string().trim().optional(),
      materialGrade: z.string().trim().optional(),
      material: z.string().trim().optional(),
      waitingForProduction: z.boolean().optional(),
      inProduction: z.boolean().optional(),
      waitingForInspection: z.boolean().optional(),
      inInspection: z.boolean().optional(),
      waitingForDispatch: z.boolean().optional(),
      dispatched: z.boolean().optional(),
      inspection: z.boolean().optional(),
      status: z.string().optional(),
      workflowState: z.record(z.any()).optional(),
      execution: z.any().optional(),
      actualStartTime: z.any().optional(),
      actualEndTime: z.any().optional(),
      temperatureLogs: z.any().optional(),
      furnaceCharge: z.any().optional(),
      cycleTimer: z.any().optional(),
      stageProgress: z.any().optional(),
      actualSoakMinutes: z.any().optional(),
      inspectionResults: z.any().optional(),
      actualHardnessValues: z.any().optional(),
      cOfCNumber: z.any().optional(),
      dispatchDetails: z.any().optional(),
      productionLogs: z.any().optional(),
      downtimeLog: z.any().optional(),
      loadedQuantity: z.any().optional(),
      completedQuantity: z.any().optional(),
      scrappedQuantity: z.any().optional()
    })
    .superRefine((data, ctx) => {
      // Production Data Boundary Enforcement
      const passedProductionFields = [
        'execution',
        'actualStartTime',
        'actualEndTime',
        'temperatureLogs',
        'furnaceCharge',
        'cycleTimer',
        'stageProgress',
        'actualSoakMinutes',
        'inspectionResults',
        'actualHardnessValues',
        'cOfCNumber',
        'dispatchDetails',
        'productionLogs',
        'downtimeLog',
        'loadedQuantity',
        'completedQuantity',
        'scrappedQuantity'
      ].filter((f) => (data as any)[f] !== undefined);

      if (passedProductionFields.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Production Data Boundary Violation: Fields belonging exclusively to the Production or Inspection phases (${passedProductionFields.join(', ')}) cannot be populated during the Planning Phase.`,
          path: [passedProductionFields[0]]
        });
      }

      const qty = data.quantity !== undefined ? data.quantity : data.targetQuantity;
      if (qty === undefined || qty === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Batch Order quantity is required',
          path: ['quantity']
        });
      } else if (typeof qty !== 'number' || Number.isNaN(qty) || !Number.isFinite(qty)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Batch Order quantity must be a valid finite number',
          path: ['quantity']
        });
      } else if (qty <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Batch Order quantity must be greater than zero',
          path: ['quantity']
        });
      }

      const w = data.weight !== undefined ? data.weight : data.weightKg;
      if (w === undefined || w === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Batch Order weight in kilograms is required',
          path: ['weight']
        });
      } else if (w < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Batch Order weight must not be negative',
          path: ['weight']
        });
      }

      // 3. Workflow State Machine Initial State & Anti-Manipulation Invariant
      const invalidInitialFlags = [
        { key: 'inProduction', val: data.inProduction },
        { key: 'waitingForInspection', val: data.waitingForInspection },
        { key: 'inInspection', val: data.inInspection },
        { key: 'waitingForDispatch', val: data.waitingForDispatch },
        { key: 'dispatched', val: data.dispatched },
        { key: 'inspection', val: data.inspection }
      ];

      for (const flag of invalidInitialFlags) {
        if (flag.val === true) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid State Manipulation: Setting initial workflow state to '${flag.key}' is strictly prohibited. Newly created Batch Order must strictly enter 'waiting for production'.`,
            path: [flag.key]
          });
        }
      }

      if (data.waitingForProduction === false) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid State Manipulation: 'waitingForProduction' cannot be false on newly created Batch Order.",
          path: ['waitingForProduction']
        });
      }

      if (data.status && data.status !== 'WAITING_FOR_PRODUCTION') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid State Manipulation: Initial status must be 'WAITING_FOR_PRODUCTION' (received '${data.status}').`,
          path: ['status']
        });
      }

      if (data.workflowState) {
        const ws = data.workflowState;
        if (
          ws.inProduction ||
          ws.waitingForInspection ||
          ws.inInspection ||
          ws.waitingForDispatch ||
          ws.dispatched ||
          ws.inspection
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Invalid State Manipulation: Newly created Batch Order must strictly enter 'waiting for production'. Manipulating initial state to inProduction, waitingForInspection, inInspection, waitingForDispatch, dispatched, or inspection is strictly rejected.",
            path: ['workflowState']
          });
        }
        if (ws.waitingForProduction === false) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid State Manipulation: 'waitingForProduction' cannot be false on newly created Batch Order.",
            path: ['workflowState', 'waitingForProduction']
          });
        }
      }

      // 4. Mutual Exclusivity Invariant
      const activeFlags = [
        data.waitingForProduction,
        data.inProduction,
        data.waitingForInspection,
        data.inInspection,
        data.waitingForDispatch,
        data.dispatched,
        data.inspection
      ].filter((f) => f === true);

      if (activeFlags.length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Mutual Exclusivity Violation: Exactly one BO workflow state flag must be true at any moment (received ${activeFlags.length} active flags).`,
          path: ['workflowState']
        });
      }
    })
};

export const getBatchOrderGenealogySchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Batch Order ID is required')
  })
};

export const getBatchOrderProductionReadinessSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Batch Order ID or Number is required')
  })
};

export const getProcessDetailsSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Batch Order ID is required')
  })
};

export const updateProcessDetailsSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Batch Order ID is required')
  }),
  body: z.object({
    processDetails: z.array(processDetailRowValidatorSchema).max(15, 'Maximum 15 process rows allowed').optional(),
    rows: z.array(processDetailRowValidatorSchema).max(15, 'Maximum 15 process rows allowed').optional()
  }).refine((data) => !!(data.processDetails || data.rows), {
    message: 'Either processDetails or rows must be provided'
  })
};

export const createDirectJobSchema: ValidationSchema = {
  body: z.object({
    planId: z.string().trim().optional(),
    priority: jobPriorityEnum.optional().default('NORMAL'),
    plannedStartDate: z.string().or(z.date()).optional(),
    targetCompletionDate: z.string().or(z.date()).optional(),
    assignedFurnaceId: z.string().trim().optional(),
    assignedOperatorId: z.string().trim().optional(),
    shift: shiftEnum.optional(),
    targetQuantity: z.number().min(0.001, 'Target quantity must be greater than zero'),
    materialAllocations: z.array(z.any()).optional(),
    notes: z.string().trim().max(1000).optional()
  })
};

export const updateJobSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z
    .object({
      targetQuantity: z.number().min(0.001).optional(),
      priority: jobPriorityEnum.optional(),
      plannedStartDate: z.string().or(z.date()).optional(),
      targetCompletionDate: z.string().or(z.date()).optional(),
      assignedFurnaceId: z.string().trim().optional(),
      assignedOperatorId: z.string().trim().optional(),
      shift: shiftEnum.optional(),
      notes: z.string().trim().max(500).optional(),
      status: z.any().optional(),
      workflowState: z.any().optional(),
      inProduction: z.any().optional(),
      waitingForInspection: z.any().optional(),
      inInspection: z.any().optional(),
      waitingForDispatch: z.any().optional(),
      dispatched: z.any().optional(),
      poId: z.any().optional(),
      poNumber: z.any().optional(),
      grnId: z.any().optional(),
      grnNumber: z.any().optional(),
      itemId: z.any().optional(),
      item: z.any().optional(),
      recipeId: z.any().optional(),
      recipeSnapshot: z.any().optional(),
      customer: z.any().optional(),
      customerName: z.any().optional(),
      customerCode: z.any().optional(),
      weight: z.any().optional(),
      weightKg: z.any().optional(),
      boNumber: z.any().optional(),
      genealogy: z.any().optional(),
      execution: z.any().optional(),
      actualStartTime: z.any().optional(),
      actualEndTime: z.any().optional(),
      temperatureLogs: z.any().optional(),
      furnaceCharge: z.any().optional(),
      cycleTimer: z.any().optional(),
      stageProgress: z.any().optional(),
      actualSoakMinutes: z.any().optional(),
      inspectionResults: z.any().optional(),
      actualHardnessValues: z.any().optional(),
      cOfCNumber: z.any().optional(),
      dispatchDetails: z.any().optional(),
      productionLogs: z.any().optional(),
      downtimeLog: z.any().optional(),
      loadedQuantity: z.any().optional(),
      completedQuantity: z.any().optional(),
      scrappedQuantity: z.any().optional()
    })
    .superRefine((data, ctx) => {
      // 1. State Transition Authority Violation check
      if (
        data.status !== undefined ||
        data.workflowState !== undefined ||
        data.inProduction !== undefined ||
        data.waitingForInspection !== undefined ||
        data.inInspection !== undefined ||
        data.waitingForDispatch !== undefined ||
        data.dispatched !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'State Transition Authority Violation: Planning users cannot directly transition Batch Orders into downstream lifecycle states (IN_PROGRESS, WAITING_FOR_INSPECTION, IN_INSPECTION, WAITING_FOR_DISPATCH, DISPATCHED). Downstream phases control their own execution and transitions.',
          path: ['status']
        });
      }

      // 2. Production Data Boundary check
      const passedProductionFields = [
        'execution',
        'actualStartTime',
        'actualEndTime',
        'temperatureLogs',
        'furnaceCharge',
        'cycleTimer',
        'stageProgress',
        'actualSoakMinutes',
        'inspectionResults',
        'actualHardnessValues',
        'cOfCNumber',
        'dispatchDetails',
        'productionLogs',
        'downtimeLog',
        'loadedQuantity',
        'completedQuantity',
        'scrappedQuantity'
      ].filter((f) => (data as any)[f] !== undefined);

      if (passedProductionFields.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Production Data Boundary Violation: Fields belonging exclusively to the Production or Inspection phases (${passedProductionFields.join(', ')}) cannot be populated during the Planning Phase.`,
          path: [passedProductionFields[0]]
        });
      }

      // 3. Immutability check
      if (
        data.poId !== undefined ||
        data.poNumber !== undefined ||
        data.grnId !== undefined ||
        data.grnNumber !== undefined ||
        data.itemId !== undefined ||
        data.item !== undefined ||
        data.recipeId !== undefined ||
        data.recipeSnapshot !== undefined ||
        data.customer !== undefined ||
        data.customerName !== undefined ||
        data.customerCode !== undefined ||
        data.weight !== undefined ||
        data.weightKg !== undefined ||
        data.boNumber !== undefined ||
        data.genealogy !== undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Genealogy Violation / Read-Only Source Data Violation: Authoritative source data (PO, GRN, Part, Recipe, Customer, Weight) is strictly immutable and cannot be modified from the Batch Order view.',
          path: ['genealogy']
        });
      }
    })
};

export const assignOperatorSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    operatorId: z.string().trim().min(1, 'Operator ID is required'),
    shift: shiftEnum.optional(),
    reason: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const removeOperatorSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Removal reason is required (min 3 characters)'),
    notes: z.string().trim().max(500).optional()
  })
};

export const assignFurnaceSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    furnaceId: z.string().trim().min(1, 'Furnace ID is required'),
    reason: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const removeFurnaceSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Removal reason is required (min 3 characters)'),
    notes: z.string().trim().max(500).optional()
  })
};

export const transitionJobSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    toStatus: jobStatusEnum,
    reason: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const cancelJobSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Cancellation reason is required (min 3 characters)'),
    notes: z.string().trim().max(500).optional()
  })
};

export const convertPlanToJobSchema: ValidationSchema = {
  params: z.object({
    planId: z.string().trim().min(1, 'Plan ID is required')
  }),
  body: z.object({
    assignedFurnaceId: z.string().trim().optional(),
    assignedOperatorId: z.string().trim().optional(),
    shift: shiftEnum.optional(),
    targetQuantity: z.number().min(0.001).optional(),
    idempotencyKey: z.string().trim().optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const startJobExecutionSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    chargeNumber: z.string().trim().min(1, 'Furnace charge number is required'),
    loadedWeightKg: z.number().min(0.1, 'Loaded weight must be greater than zero'),
    loadedPieceCount: z.number().min(1, 'Loaded piece count must be at least 1'),
    fixtureId: z.string().trim().optional(),
    initialFurnaceTempC: z.number(),
    initialAtmosphereLevel: z.number().optional(),
    thermocoupleLocations: z.array(z.string().trim()).optional(),
    furnaceId: z.string().trim().optional(),
    operatorId: z.string().trim().optional(),
    shift: shiftEnum.optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const recordStageProgressSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    stageSequence: z.number().min(1, 'Stage sequence is required'),
    stageName: z.string().trim().min(1, 'Stage name is required'),
    stageType: stageProgressTypeEnum,
    targetTemperatureC: z.number(),
    actualTemperatureC: z.number(),
    targetDurationMinutes: z.number().min(0),
    actualDurationMinutes: z.number().min(0),
    quenchMedium: z.string().trim().optional(),
    quenchAgitationSpeedRpm: z.number().optional(),
    quenchMediaInitialTempC: z.number().optional(),
    quenchMediaFinalTempC: z.number().optional(),
    atmosphereDetails: z
      .object({
        carbonPotential: z.number().optional(),
        nitrogenFlow: z.number().optional(),
        vacuumPressureMbar: z.number().optional()
      })
      .optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const pauseJobExecutionSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    category: downtimeCategoryEnum,
    reason: z.string().trim().min(3, 'Downtime reason is required (min 3 characters)'),
    impactOnCycle: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const resumeJobExecutionSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    actionTaken: z.string().trim().min(3, 'Action taken is required (min 3 characters)'),
    notes: z.string().trim().max(500).optional()
  })
};

export const addProductionLogSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    type: productionLogTypeEnum,
    shift: shiftEnum.optional(),
    message: z.string().trim().min(1, 'Message is required').max(1000)
  })
};

export const completeJobExecutionSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    completedQuantity: z.number().min(0, 'Completed quantity cannot be negative'),
    scrappedQuantity: z.number().min(0).optional().default(0),
    operatorNotes: z.string().trim().max(500).optional()
  })
};

export const transitionToStorageSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    warehouseId: z.string().trim().min(1, 'Warehouse ID is required'),
    locationBay: z.string().trim().min(1, 'Location bay is required'),
    palletId: z.string().trim().optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const queryJobsSchema: ValidationSchema = {
  query: z.object({
    status: jobStatusEnum.optional(),
    furnaceId: z.string().trim().optional(),
    itemCode: z.string().trim().optional(),
    planId: z.string().trim().optional(),
    priority: jobPriorityEnum.optional(),
    search: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional()
  })
};

export const getJobByIdSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  })
};

export const takeForProductionSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z
    .object({
      furnaceId: z.string().trim().optional(),
      furnaceCode: z.string().trim().optional(),
      assignedFurnaceId: z.string().trim().optional(),
      operatorId: z.string().trim().optional(),
      assignedOperatorId: z.string().trim().optional(),
      shift: shiftEnum.optional(),
      chargeNumber: z.string().trim().optional(),
      loadedWeightKg: z.number().min(0).optional(),
      loadedPieceCount: z.number().min(1).optional(),
      fixtureId: z.string().trim().optional(),
      initialFurnaceTempC: z.number().optional(),
      initialAtmosphereLevel: z.number().optional(),
      thermocoupleLocations: z.array(z.string().trim()).optional(),
      notes: z.string().trim().max(500).optional()
    })
    .optional()
};

export const recordRecipeStageProgressSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z.object({
    stageSequence: z.number().min(1, 'Stage sequence is required'),
    stageName: z.string().trim().optional(),
    actualTemperatureC: z.number().min(0, 'Actual temperature must be non-negative'),
    actualDurationMinutes: z.number().min(0, 'Actual duration must be non-negative'),
    quenchMedium: z.string().trim().optional(),
    quenchAgitationSpeedRpm: z.number().min(0).optional(),
    quenchMediaInitialTempC: z.number().optional(),
    quenchMediaFinalTempC: z.number().optional(),
    quenchParameters: z
      .object({
        mediumTemperatureC: z.number().optional(),
        quenchDurationSeconds: z.number().optional(),
        agitationSpeedPercent: z.number().optional()
      })
      .optional(),
    atmosphereLevel: z.string().trim().max(100).optional(),
    atmosphereDetails: z
      .object({
        carbonPotential: z.number().optional(),
        nitrogenFlow: z.number().optional(),
        vacuumPressureMbar: z.number().optional()
      })
      .optional(),
    operatorNotes: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional()
  })
};

export const approveForInspectionSchema: ValidationSchema = {
  params: z.object({
    id: z.string().trim().min(1, 'Job ID is required')
  }),
  body: z
    .object({
      completedQuantity: z.number().min(0, 'Completed quantity must be non-negative').optional(),
      scrappedQuantity: z.number().min(0).optional().default(0),
      notes: z.string().trim().max(500).optional(),
      operatorNotes: z.string().trim().max(500).optional()
    })
    .optional()
};
