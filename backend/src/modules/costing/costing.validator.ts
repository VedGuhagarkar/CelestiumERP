import { z } from 'zod';

const machineRateSchema = z.object({
  machineId: z.string().optional(),
  machineCode: z.string().min(1),
  machineName: z.string().optional(),
  hourlyOperatingRate: z.number().nonnegative(),
  hourlySetupRate: z.number().nonnegative().default(0)
});

const utilityRatesSchema = z.object({
  electricityRatePerKwh: z.number().nonnegative(),
  naturalGasRatePerM3: z.number().nonnegative(),
  nitrogenGasRatePerM3: z.number().nonnegative(),
  argonGasRatePerM3: z.number().nonnegative(),
  vacuumQuenchOilRatePerLiter: z.number().nonnegative(),
  saltBathChemicalRatePerKg: z.number().nonnegative()
});

const overheadRatesSchema = z.object({
  overheadMethod: z.enum(['PERCENTAGE_OF_LABOR', 'PER_MACHINE_HOUR', 'FLAT_PER_KG']).default('PER_MACHINE_HOUR'),
  overheadRate: z.number().nonnegative(),
  qualityAssuranceOverheadPerJob: z.number().nonnegative().default(0),
  plantDepreciationRatePerHour: z.number().nonnegative().default(0)
});

const costRateSnapshotSchema = z.object({
  standardLaborRatePerHour: z.number().nonnegative(),
  overtimeLaborRatePerHour: z.number().nonnegative(),
  specialistMetallurgistRatePerHour: z.number().nonnegative(),
  defaultMachineRatePerHour: z.number().nonnegative(),
  machineSpecificRates: z.array(machineRateSchema).default([]),
  utilityRates: utilityRatesSchema,
  overheadRates: overheadRatesSchema
});

export const createCostRateCardSchema = z.object({
  rateCardCode: z.string().min(2).max(50).trim(),
  name: z.string().min(2).max(100).trim(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  rates: costRateSnapshotSchema,
  notes: z.string().max(500).optional()
});

export const updateCostRateCardSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  effectiveTo: z.string().datetime().optional(),
  rates: costRateSnapshotSchema.partial().optional(),
  notes: z.string().max(500).optional()
});

export const calculateJobCostSchema = z.object({
  jobId: z.string().min(1),
  rateCardCode: z.string().optional(),
  notes: z.string().max(500).optional()
});

export const recalculateJobCostSchema = z.object({
  rateCardCode: z.string().optional(),
  reason: z.string().min(5).max(500)
});

export const freezeJobCostSchema = z.object({
  freezeJustification: z.string().min(5).max(500)
});

export const queryJobCostsSchema = z.object({
  jobId: z.string().optional(),
  jobNumber: z.string().optional(),
  customerId: z.string().optional(),
  customerCode: z.string().optional(),
  itemCode: z.string().optional(),
  status: z.enum(['CALCULATED', 'FROZEN', 'SUPERSEDED']).optional(),
  profitabilityStatus: z.enum(['HIGH_MARGIN', 'STANDARD_MARGIN', 'LOW_MARGIN', 'NEGATIVE_LOSS', 'UNBILLED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isFrozen: z.enum(['true', 'false']).transform((v) => v === 'true').optional()
});
