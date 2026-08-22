import mongoose, { Schema } from 'mongoose';
import {
  CostRateCardDocument,
  JobCostDocument
} from './costing.types.js';

// ==========================================
// 1. Cost Rate Card Schema
// ==========================================

const MachineRateSchema = new Schema(
  {
    machineId: { type: Schema.Types.ObjectId, ref: 'Machine' },
    machineCode: { type: String, required: true, uppercase: true, trim: true },
    machineName: { type: String },
    hourlyOperatingRate: { type: Number, required: true, min: 0 },
    hourlySetupRate: { type: Number, required: true, min: 0, default: 0 }
  },
  { _id: false }
);

const UtilityRatesSchema = new Schema(
  {
    electricityRatePerKwh: { type: Number, required: true, min: 0 },
    naturalGasRatePerM3: { type: Number, required: true, min: 0 },
    nitrogenGasRatePerM3: { type: Number, required: true, min: 0 },
    argonGasRatePerM3: { type: Number, required: true, min: 0 },
    vacuumQuenchOilRatePerLiter: { type: Number, required: true, min: 0 },
    saltBathChemicalRatePerKg: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const OverheadRatesSchema = new Schema(
  {
    overheadMethod: {
      type: String,
      enum: ['PERCENTAGE_OF_LABOR', 'PER_MACHINE_HOUR', 'FLAT_PER_KG'],
      default: 'PER_MACHINE_HOUR'
    },
    overheadRate: { type: Number, required: true, min: 0 },
    qualityAssuranceOverheadPerJob: { type: Number, required: true, min: 0, default: 0 },
    plantDepreciationRatePerHour: { type: Number, required: true, min: 0, default: 0 }
  },
  { _id: false }
);

const CostRateSnapshotSchema = new Schema(
  {
    standardLaborRatePerHour: { type: Number, required: true, min: 0 },
    overtimeLaborRatePerHour: { type: Number, required: true, min: 0 },
    specialistMetallurgistRatePerHour: { type: Number, required: true, min: 0 },
    defaultMachineRatePerHour: { type: Number, required: true, min: 0 },
    machineSpecificRates: [MachineRateSchema],
    utilityRates: { type: UtilityRatesSchema, required: true },
    overheadRates: { type: OverheadRatesSchema, required: true }
  },
  { _id: false }
);

const CostRateCardSchema = new Schema<CostRateCardDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    rateCardCode: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    revisionNumber: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUPERSEDED', 'DRAFT'],
      default: 'ACTIVE',
      index: true
    },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    rates: { type: CostRateSnapshotSchema, required: true },
    createdBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    },
    notes: { type: String },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

CostRateCardSchema.index({ tenantId: 1, rateCardCode: 1, revisionNumber: 1 }, { unique: true });
CostRateCardSchema.index({ tenantId: 1, status: 1, effectiveFrom: -1 });

// ==========================================
// 2. Job Cost Breakdown Schemas
// ==========================================

const JobMaterialCostComponentSchema = new Schema(
  {
    materialRequirementId: { type: Schema.Types.ObjectId, ref: 'MaterialRequirement' },
    heatLotId: { type: Schema.Types.ObjectId, ref: 'HeatLot' },
    heatLotNumber: { type: String, required: true },
    itemCode: { type: String, required: true },
    itemName: { type: String },
    quantityConsumed: { type: Number, required: true },
    uom: { type: String, required: true },
    standardUnitCost: { type: Number, required: true },
    actualUnitCost: { type: Number, required: true },
    standardCost: { type: Number, required: true },
    actualCost: { type: Number, required: true },
    variance: { type: Number, required: true },
    inventoryTransactionRef: { type: String }
  },
  { _id: false }
);

const JobConsumableCostComponentSchema = new Schema(
  {
    consumableType: {
      type: String,
      enum: ['QUENCH_OIL', 'CARBURIZING_GAS', 'NITROGEN_PURGE', 'ARGON_SHIELD', 'SALT_CHEMICAL', 'MASKING_PAINT'],
      required: true
    },
    name: { type: String, required: true },
    quantityConsumed: { type: Number, required: true },
    uom: { type: String, required: true },
    unitRate: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    sourceModule: { type: String, enum: ['INVENTORY', 'PROCESS_TELEMETRY', 'RECIPE_CALC'], default: 'RECIPE_CALC' },
    referenceId: { type: String }
  },
  { _id: false }
);

const JobLaborCostComponentSchema = new Schema(
  {
    operatorId: { type: String, required: true },
    operatorName: { type: String, required: true },
    shiftCode: { type: String },
    regularHours: { type: Number, required: true },
    overtimeHours: { type: Number, required: true, default: 0 },
    regularRate: { type: Number, required: true },
    overtimeRate: { type: Number, required: true },
    regularCost: { type: Number, required: true },
    overtimeCost: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    attendanceRecordRef: { type: String },
    workorderOperationId: { type: String }
  },
  { _id: false }
);

const JobMachineCostComponentSchema = new Schema(
  {
    furnaceId: { type: Schema.Types.ObjectId, ref: 'Furnace' },
    furnaceCode: { type: String, required: true },
    furnaceName: { type: String },
    operatingRuntimeHours: { type: Number, required: true },
    setupHours: { type: Number, required: true, default: 0 },
    operatingRatePerHour: { type: Number, required: true },
    setupRatePerHour: { type: Number, required: true, default: 0 },
    operatingCost: { type: Number, required: true },
    setupCost: { type: Number, required: true },
    totalMachineCost: { type: Number, required: true },
    standardHours: { type: Number, required: true },
    standardRatePerHour: { type: Number, required: true },
    standardCost: { type: Number, required: true },
    variance: { type: Number, required: true },
    machineTelemetryRef: { type: String }
  },
  { _id: false }
);

const JobEnergyCostComponentSchema = new Schema(
  {
    utilityType: {
      type: String,
      enum: ['ELECTRICITY', 'NATURAL_GAS', 'NITROGEN', 'ARGON'],
      required: true
    },
    measuredUnits: { type: Number, required: true },
    uom: { type: String, required: true },
    ratePerUnit: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    ratedPowerKw: { type: Number },
    operatingHours: { type: Number },
    meterReadingRef: { type: String }
  },
  { _id: false }
);

const JobOverheadCostComponentSchema = new Schema(
  {
    overheadType: {
      type: String,
      enum: ['PLANT_FACILITY', 'QUALITY_ASSURANCE', 'EQUIPMENT_DEPRECIATION', 'SUPERVISION'],
      required: true
    },
    allocationBasis: { type: String, required: true },
    rate: { type: Number, required: true },
    allocatedAmount: { type: Number, required: true },
    costCenterCode: { type: String }
  },
  { _id: false }
);

const JobCostRecalculationSchema = new Schema(
  {
    recalculatedAt: { type: Date, required: true },
    recalculatedBy: {
      userId: { type: String, required: true },
      email: { type: String },
      role: { type: String }
    },
    reason: { type: String, required: true },
    rateCardCode: { type: String, required: true },
    revisionNumber: { type: Number, required: true },
    previousTotalActualCost: { type: Number, required: true },
    newTotalActualCost: { type: Number, required: true }
  },
  { _id: false }
);

const JobCostSchema = new Schema<JobCostDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    costingNumber: { type: String, required: true, uppercase: true, trim: true },
    jobId: { type: String, required: true, index: true },
    jobNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    customerId: { type: String, required: true },
    customerCode: { type: String, required: true, uppercase: true, trim: true },
    customerName: { type: String },
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String },
    recipeId: { type: String },
    recipeCode: { type: String },
    processedQuantity: { type: Number, required: true },
    processedWeightKg: { type: Number },
    uom: { type: String, required: true },
    costingDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['CALCULATED', 'FROZEN', 'SUPERSEDED'],
      default: 'CALCULATED',
      index: true
    },
    rateCardId: { type: String, required: true },
    rateCardCode: { type: String, required: true },
    rateCardRevision: { type: Number, required: true },
    rateCardSnapshot: { type: CostRateSnapshotSchema, required: true },

    materialCosts: {
      standardCost: { type: Number, required: true, default: 0 },
      actualCost: { type: Number, required: true, default: 0 },
      variance: { type: Number, required: true, default: 0 },
      components: [JobMaterialCostComponentSchema]
    },

    consumableCosts: {
      standardCost: { type: Number, required: true, default: 0 },
      actualCost: { type: Number, required: true, default: 0 },
      variance: { type: Number, required: true, default: 0 },
      components: [JobConsumableCostComponentSchema]
    },

    laborCosts: {
      standardCost: { type: Number, required: true, default: 0 },
      actualCost: { type: Number, required: true, default: 0 },
      variance: { type: Number, required: true, default: 0 },
      totalRegularHours: { type: Number, required: true, default: 0 },
      totalOvertimeHours: { type: Number, required: true, default: 0 },
      components: [JobLaborCostComponentSchema]
    },

    machineCosts: {
      standardCost: { type: Number, required: true, default: 0 },
      actualCost: { type: Number, required: true, default: 0 },
      variance: { type: Number, required: true, default: 0 },
      totalRuntimeHours: { type: Number, required: true, default: 0 },
      totalSetupHours: { type: Number, required: true, default: 0 },
      components: [JobMachineCostComponentSchema]
    },

    energyCosts: {
      standardCost: { type: Number, required: true, default: 0 },
      actualCost: { type: Number, required: true, default: 0 },
      variance: { type: Number, required: true, default: 0 },
      totalKwhCalculated: { type: Number, required: true, default: 0 },
      components: [JobEnergyCostComponentSchema]
    },

    overheadCosts: {
      standardCost: { type: Number, required: true, default: 0 },
      actualCost: { type: Number, required: true, default: 0 },
      variance: { type: Number, required: true, default: 0 },
      components: [JobOverheadCostComponentSchema]
    },

    totalStandardCost: { type: Number, required: true, default: 0 },
    totalActualCost: { type: Number, required: true, default: 0 },
    totalVariance: { type: Number, required: true, default: 0 },
    totalVariancePercentage: { type: Number, required: true, default: 0 },
    unitCostStandard: { type: Number, required: true, default: 0 },
    unitCostActual: { type: Number, required: true, default: 0 },

    totalRevenueBilled: { type: Number },
    manufacturingContribution: { type: Number },
    contributionMarginPercentage: { type: Number },
    grossProfit: { type: Number },
    grossMarginPercentage: { type: Number },
    profitabilityStatus: {
      type: String,
      enum: ['HIGH_MARGIN', 'STANDARD_MARGIN', 'LOW_MARGIN', 'NEGATIVE_LOSS', 'UNBILLED'],
      default: 'UNBILLED',
      index: true
    },

    isFrozen: { type: Boolean, default: false, index: true },
    frozenAt: { type: Date },
    frozenBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String }
    },
    freezeJustification: { type: String },

    recalculationHistory: [JobCostRecalculationSchema],
    notes: { type: String },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

JobCostSchema.index({ tenantId: 1, costingNumber: 1 }, { unique: true });
JobCostSchema.index({ tenantId: 1, jobId: 1, status: 1 });
JobCostSchema.index({ tenantId: 1, customerCode: 1, costingDate: -1 });

export const CostRateCard = mongoose.model<CostRateCardDocument>('CostRateCard', CostRateCardSchema);
export const JobCost = mongoose.model<JobCostDocument>('JobCost', JobCostSchema);
