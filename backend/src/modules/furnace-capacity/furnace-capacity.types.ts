import { Document } from 'mongoose';

export type FurnaceStatus =
  | 'OPERATIONAL'
  | 'MAINTENANCE_SCHEDULED'
  | 'BREAKDOWN'
  | 'CALIBRATION_OVERDUE'
  | 'OFFLINE';

export type FurnaceClassEnum = 'CLASS_1' | 'CLASS_2' | 'CLASS_3' | 'CLASS_4' | 'CLASS_5';
export type InstrumentationTypeEnum = 'TYPE_A' | 'TYPE_B' | 'TYPE_C' | 'TYPE_D' | 'TYPE_E';

export interface IFurnaceDimensions {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  usableVolumeM3: number;
  maxGrossWeightKg: number;
}

export interface IFurnaceThermalCapabilities {
  minOperatingTempC: number;
  maxOperatingTempC: number;
  temperatureUniformityToleranceC: number;
  pyrometryClass: FurnaceClassEnum;
  instrumentationType: InstrumentationTypeEnum;
  lastTusDate?: Date | null;
  nextTusDueDate?: Date | null;
  lastSatDate?: Date | null;
  nextSatDueDate?: Date | null;
}

export interface IFurnaceProcessCapabilities {
  supportedProcessFamilies: string[]; // e.g. ['CARBURIZING', 'CARBONITRIDING', 'NEUTRAL_HARDENING']
  supportedAtmospheres: string[]; // e.g. ['CARBON_POTENTIAL', 'ENDOTHERMIC', 'NITROGEN_PURGE']
  supportedQuenchMedia: string[]; // e.g. ['FAST_QUENCH_OIL', 'POLYMER_QUENCH', 'AIR_COOL']
  maxQuenchWeightKg?: number;
  hasAgitationControl: boolean;
}

export interface IFurnace {
  furnaceCode: string;
  name: string;
  tenantId: string;
  furnaceType: string; // e.g. 'SEALED_QUENCH_FURNACE', 'PIT_FURNACE', 'VACUUM_FURNACE', 'TEMPERING_FURNACE'
  manufacturer?: string;
  modelNumber?: string;
  serialNumber?: string;
  locationBay: string;
  status: FurnaceStatus;
  dimensions: IFurnaceDimensions;
  thermalCapabilities: IFurnaceThermalCapabilities;
  processCapabilities: IFurnaceProcessCapabilities;
  nominalDailyOperatingHours: number; // typically 24.0 for continuous industrial furnaces
  notes?: string | null;
  isDeleted: boolean;
}

export interface FurnaceDocument extends IFurnace, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AllocationStatus = 'BOOKED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface IFurnaceAllocation {
  allocationNumber: string;
  tenantId: string;
  furnaceId: string;
  furnaceCode: string;
  planId?: string | null;
  planNumber?: string | null;
  jobCardId?: string | null;
  jobCardNumber?: string | null;
  processFamily: string;
  targetTemperatureC: number;
  allocatedWeightKg: number;
  startTime: Date;
  endTime: Date;
  durationHours: number;
  status: AllocationStatus;
  bookedByActorId: string;
  notes?: string | null;
  isDeleted: boolean;
}

export interface FurnaceAllocationDocument extends IFurnaceAllocation, Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompatibilityCheckRequestDto {
  furnaceId: string;
  recipeId?: string;
  targetTemperatureC: number;
  processFamily: string;
  requiredFurnaceClass?: FurnaceClassEnum;
  requiredAtmosphere?: string;
  requiredQuenchMedium?: string;
  totalBatchWeightKg: number;
  requestedStartTime?: string;
  requestedEndTime?: string;
  durationHours?: number;
}

export interface CompatibilityCheckResult {
  isCompatible: boolean;
  violations: string[];
  warnings: string[];
  furnace: {
    id: string;
    furnaceCode: string;
    name: string;
    status: FurnaceStatus;
    pyrometryClass: FurnaceClassEnum;
    maxOperatingTempC: number;
    maxGrossWeightKg: number;
  };
}

export interface FurnaceUtilizationDto {
  furnaceId: string;
  furnaceCode: string;
  furnaceName: string;
  furnaceType: string;
  status: FurnaceStatus;
  periodStart: Date;
  periodEnd: Date;
  totalAvailableHours: number;
  bookedHours: number;
  utilizationPercentage: number;
  isOverloaded: boolean;
  isUnderutilized: boolean;
  isBottleneck: boolean;
  allocationsCount: number;
}

export interface CreateFurnaceDto {
  furnaceCode: string;
  name: string;
  furnaceType: string;
  manufacturer?: string;
  modelNumber?: string;
  serialNumber?: string;
  locationBay: string;
  dimensions: IFurnaceDimensions;
  thermalCapabilities: IFurnaceThermalCapabilities;
  processCapabilities: IFurnaceProcessCapabilities;
  nominalDailyOperatingHours?: number;
  notes?: string;
}

export interface BookFurnaceCapacityDto {
  furnaceId: string;
  planId?: string;
  jobCardId?: string;
  processFamily: string;
  targetTemperatureC: number;
  allocatedWeightKg: number;
  startTime: string;
  endTime: string;
  notes?: string;
}
