import { Document } from 'mongoose';

export type ProcessFamily =
  | 'CARBURIZING'
  | 'CARBONITRIDING'
  | 'NEUTRAL_HARDENING'
  | 'TEMPERING'
  | 'STRESS_RELIEVING'
  | 'ANNEALING'
  | 'NORMALIZING'
  | 'NITRIDING'
  | 'SOLUTION_TREATING_AGING'
  | 'INDUCTION_HARDENING';

export type RecipeStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';

export type HardnessScale = 'HRC' | 'HRB' | 'HRA' | 'HV1' | 'HV5' | 'HV10' | 'HV30' | 'HBW';

export type FurnaceClass = 'CLASS_1' | 'CLASS_2' | 'CLASS_3' | 'CLASS_4' | 'CLASS_5';

export type AtmosphereType =
  | 'CARBON_POTENTIAL'
  | 'NITRIDING_POTENTIAL_KN'
  | 'ENDOTHERMIC'
  | 'NITROGEN_PURGE'
  | 'VACUUM'
  | 'HYDROGEN';

export type QuenchMedium =
  | 'FAST_QUENCH_OIL'
  | 'MARTEMPERING_OIL'
  | 'POLYMER_QUENCH'
  | 'WATER'
  | 'BRINE'
  | 'HIGH_PRESSURE_GAS_N2'
  | 'HIGH_PRESSURE_GAS_HE'
  | 'AIR_COOL'
  | 'FURNACE_COOL';

export interface AtmosphereControl {
  type: AtmosphereType;
  setpoint: number;
  tolerance?: number;
}

export interface QuenchParameters {
  medium: QuenchMedium;
  targetTemperatureC: number;
  agitationSpeedPercent?: number;
  quenchDurationSeconds?: number;
  gasQuenchPressureBar?: number;
}

export interface RecipeStage {
  sequence: number;
  stageName: string;
  targetTemperatureC: number;
  temperatureToleranceMinusC: number;
  temperatureTolerancePlusC: number;
  rampRateCPerMin?: number;
  soakTimeMinutes: number;
  soakCriteria: 'LOAD_THERMOCOUPLE_REACHED' | 'FURNACE_ZONE_REACHED' | 'FIXED_TIME';
  atmosphereControl?: AtmosphereControl;
  quenchParameters?: QuenchParameters;
}

export interface MetallurgicalTargets {
  targetHardnessMin: number;
  targetHardnessMax: number;
  hardnessScale: HardnessScale;
  effectiveCaseDepthMinMm?: number;
  effectiveCaseDepthMaxMm?: number;
  caseDepthCutoffHRC?: number;
  totalCaseDepthMinMm?: number;
  totalCaseDepthMaxMm?: number;
  coreHardnessMin?: number;
  coreHardnessMax?: number;
  coreHardnessScale?: HardnessScale;
  microstructureRequirements?: string;
}

export interface MachineRequirements {
  compatibleFurnaceTypes: string[];
  minimumFurnaceClass?: FurnaceClass;
  maxOperatingTempRequiredC: number;
}

export interface IRecipe {
  tenantId: string;
  recipeCode: string;
  revision: number;
  name: string;
  description?: string;
  processFamily: ProcessFamily;
  applicableMaterialGrades: string[];
  stages: RecipeStage[];
  metallurgicalTargets: MetallurgicalTargets;
  machineRequirements: MachineRequirements;
  authorId: string;
  status: RecipeStatus;
  approvedBy?: {
    userId: string;
    email?: string;
    role?: string;
    approvedAt: Date;
    comments?: string;
  };
  rejectionReason?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  referencedJobCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeDocument extends IRecipe, Document {}

export interface CreateRecipeDto {
  recipeCode: string;
  name: string;
  description?: string;
  processFamily: ProcessFamily;
  applicableMaterialGrades: string[];
  stages: RecipeStage[];
  metallurgicalTargets: MetallurgicalTargets;
  machineRequirements: MachineRequirements;
}

export interface UpdateRecipeDto {
  name?: string;
  description?: string;
  processFamily?: ProcessFamily;
  applicableMaterialGrades?: string[];
  stages?: RecipeStage[];
  metallurgicalTargets?: MetallurgicalTargets;
  machineRequirements?: MachineRequirements;
}

export interface ApproveRecipeDto {
  comments?: string;
}

export interface RejectRecipeDto {
  rejectionReason: string;
}

export interface RecipeFilterQuery {
  search?: string;
  processFamily?: ProcessFamily;
  materialGrade?: string;
  status?: RecipeStatus;
  isLatestOnly?: boolean;
}
