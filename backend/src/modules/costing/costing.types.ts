import { Document } from 'mongoose';

export type CostingStatus = 'CALCULATED' | 'FROZEN' | 'SUPERSEDED';
export type ProfitabilityStatus = 'HIGH_MARGIN' | 'STANDARD_MARGIN' | 'LOW_MARGIN' | 'NEGATIVE_LOSS' | 'UNBILLED';
export type OverheadAllocationMethod = 'PERCENTAGE_OF_LABOR' | 'PER_MACHINE_HOUR' | 'FLAT_PER_KG';

export interface IMachineRate {
  machineId?: string;
  machineCode: string;
  machineName?: string;
  hourlyOperatingRate: number; // e.g., $85.00/hr
  hourlySetupRate: number;     // e.g., $50.00/hr
}

export interface IUtilityRates {
  electricityRatePerKwh: number;        // e.g. $0.14/kWh
  naturalGasRatePerM3: number;          // e.g. $1.20/m³
  nitrogenGasRatePerM3: number;         // e.g. $0.45/m³
  argonGasRatePerM3: number;            // e.g. $1.85/m³
  vacuumQuenchOilRatePerLiter: number;  // e.g. $4.50/L
  saltBathChemicalRatePerKg: number;    // e.g. $3.20/kg
}

export interface IOverheadRates {
  overheadMethod: OverheadAllocationMethod;
  overheadRate: number;                 // e.g. 25 (%) or $18.00/hr
  qualityAssuranceOverheadPerJob: number; // e.g. $45.00 flat cert & QA fee
  plantDepreciationRatePerHour: number;  // e.g. $12.50/machine hr
}

export interface ICostRateSnapshot {
  standardLaborRatePerHour: number;
  overtimeLaborRatePerHour: number;
  specialistMetallurgistRatePerHour: number;
  defaultMachineRatePerHour: number;
  machineSpecificRates: IMachineRate[];
  utilityRates: IUtilityRates;
  overheadRates: IOverheadRates;
}

export interface ICostRateCard {
  tenantId: string;
  rateCardCode: string; // e.g., 'RATE-2026-DEFAULT'
  name: string;
  revisionNumber: number;
  status: 'ACTIVE' | 'SUPERSEDED' | 'DRAFT';
  effectiveFrom: Date;
  effectiveTo?: Date;
  rates: ICostRateSnapshot;
  createdBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CostRateCardDocument = ICostRateCard & Document;

// ==========================================
// Job Cost Components & Traceability
// ==========================================

export interface IJobMaterialCostComponent {
  materialRequirementId?: string;
  heatLotId?: string;
  heatLotNumber: string;
  itemCode: string;
  itemName?: string;
  quantityConsumed: number;
  uom: string;
  standardUnitCost: number;
  actualUnitCost: number;
  standardCost: number;
  actualCost: number;
  variance: number;
  inventoryTransactionRef?: string;
}

export interface IJobConsumableCostComponent {
  consumableType: 'QUENCH_OIL' | 'CARBURIZING_GAS' | 'NITROGEN_PURGE' | 'ARGON_SHIELD' | 'SALT_CHEMICAL' | 'MASKING_PAINT';
  name: string;
  quantityConsumed: number;
  uom: string;
  unitRate: number;
  totalCost: number;
  sourceModule: 'INVENTORY' | 'PROCESS_TELEMETRY' | 'RECIPE_CALC';
  referenceId?: string;
}

export interface IJobLaborCostComponent {
  operatorId: string;
  operatorName: string;
  shiftCode?: string;
  regularHours: number;
  overtimeHours: number;
  regularRate: number;
  overtimeRate: number;
  regularCost: number;
  overtimeCost: number;
  totalCost: number;
  attendanceRecordRef?: string;
  workorderOperationId?: string;
}

export interface IJobMachineCostComponent {
  furnaceId?: string;
  furnaceCode: string;
  furnaceName?: string;
  operatingRuntimeHours: number;
  setupHours: number;
  operatingRatePerHour: number;
  setupRatePerHour: number;
  operatingCost: number;
  setupCost: number;
  totalMachineCost: number;
  standardHours: number;
  standardRatePerHour: number;
  standardCost: number;
  variance: number;
  machineTelemetryRef?: string;
}

export interface IJobEnergyCostComponent {
  utilityType: 'ELECTRICITY' | 'NATURAL_GAS' | 'NITROGEN' | 'ARGON';
  measuredUnits: number; // kWh or m³
  uom: string;
  ratePerUnit: number;
  totalCost: number;
  ratedPowerKw?: number;
  operatingHours?: number;
  meterReadingRef?: string;
}

export interface IJobOverheadCostComponent {
  overheadType: 'PLANT_FACILITY' | 'QUALITY_ASSURANCE' | 'EQUIPMENT_DEPRECIATION' | 'SUPERVISION';
  allocationBasis: string;
  rate: number;
  allocatedAmount: number;
  costCenterCode?: string;
}

export interface IJobCostRecalculationEntry {
  recalculatedAt: Date;
  recalculatedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  reason: string;
  rateCardCode: string;
  revisionNumber: number;
  previousTotalActualCost: number;
  newTotalActualCost: number;
}

export interface IJobCost {
  tenantId: string;
  costingNumber: string; // e.g. 'COST-202608-0001'
  jobId: string;
  jobNumber: string;
  customerId: string;
  customerCode: string;
  customerName?: string;
  itemId: string;
  itemCode: string;
  itemName?: string;
  recipeId?: string;
  recipeCode?: string;
  processedQuantity: number;
  processedWeightKg?: number;
  uom: string;
  costingDate: Date;
  status: CostingStatus;
  rateCardId: string;
  rateCardCode: string;
  rateCardRevision: number;
  rateCardSnapshot: ICostRateSnapshot;

  // Breakdown Categories
  materialCosts: {
    standardCost: number;
    actualCost: number;
    variance: number;
    components: IJobMaterialCostComponent[];
  };

  consumableCosts: {
    standardCost: number;
    actualCost: number;
    variance: number;
    components: IJobConsumableCostComponent[];
  };

  laborCosts: {
    standardCost: number;
    actualCost: number;
    variance: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    components: IJobLaborCostComponent[];
  };

  machineCosts: {
    standardCost: number;
    actualCost: number;
    variance: number;
    totalRuntimeHours: number;
    totalSetupHours: number;
    components: IJobMachineCostComponent[];
  };

  energyCosts: {
    standardCost: number;
    actualCost: number;
    variance: number;
    totalKwhCalculated: number;
    components: IJobEnergyCostComponent[];
  };

  overheadCosts: {
    standardCost: number;
    actualCost: number;
    variance: number;
    components: IJobOverheadCostComponent[];
  };

  // Summary Economics & Variances
  totalStandardCost: number;
  totalActualCost: number;
  totalVariance: number; // Actual - Standard (positive = unfavorable / cost overrun)
  totalVariancePercentage: number;
  unitCostStandard: number;
  unitCostActual: number;

  // Profitability & Revenue Analysis
  totalRevenueBilled?: number;
  manufacturingContribution?: number; // Revenue - (Material + Consumable + Labor + Machine + Energy)
  contributionMarginPercentage?: number;
  grossProfit?: number;               // Revenue - Total Actual Cost
  grossMarginPercentage?: number;
  profitabilityStatus: ProfitabilityStatus;

  // Freeze & Immutability Controls
  isFrozen: boolean;
  frozenAt?: Date;
  frozenBy?: {
    userId: string;
    email?: string;
    role?: string;
  };
  freezeJustification?: string;

  recalculationHistory: IJobCostRecalculationEntry[];
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type JobCostDocument = IJobCost & Document;

// ==========================================
// DTOs & Queries
// ==========================================

export interface CreateCostRateCardDto {
  rateCardCode: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  rates: ICostRateSnapshot;
  notes?: string;
}

export interface UpdateCostRateCardDto {
  name?: string;
  effectiveTo?: string;
  rates?: Partial<ICostRateSnapshot>;
  notes?: string;
}

export interface CalculateJobCostDto {
  jobId: string;
  rateCardCode?: string;
  notes?: string;
}

export interface RecalculateJobCostDto {
  rateCardCode?: string;
  reason: string;
}

export interface FreezeJobCostDto {
  freezeJustification: string;
}

export interface QueryJobCostsDto {
  jobId?: string;
  jobNumber?: string;
  customerId?: string;
  customerCode?: string;
  itemCode?: string;
  status?: CostingStatus;
  profitabilityStatus?: ProfitabilityStatus;
  startDate?: string;
  endDate?: string;
  isFrozen?: boolean;
}

export interface IJobCostSummaryReport {
  totalJobsCosted: number;
  totalStandardCost: number;
  totalActualCost: number;
  totalVariance: number;
  netVariancePercentage: number;
  totalRevenueBilled: number;
  totalGrossProfit: number;
  averageGrossMarginPercentage: number;
  jobsByProfitability: Record<ProfitabilityStatus, number>;
}
