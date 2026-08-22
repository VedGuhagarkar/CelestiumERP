import { Document } from 'mongoose';
import { ProcessFamily } from '../recipe/recipe.types.js';

export type MachineCategory =
  | 'FURNACE_VACUUM'
  | 'FURNACE_ATMOSPHERE_SEALED_QUENCH'
  | 'FURNACE_PIT'
  | 'FURNACE_BOX'
  | 'FURNACE_CONTINUOUS_BELT'
  | 'FURNACE_INDUCTION'
  | 'QUENCH_TANK'
  | 'TEMPERING_OVEN'
  | 'CRYOGENIC_CHAMBER'
  | 'WASHING_LINE'
  | 'SHOT_BLASTER'
  | 'STRAIGHTENING_PRESS'
  | 'AUXILIARY_EQUIPMENT';

export type MachineStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'MAINTENANCE'
  | 'BREAKDOWN'
  | 'OFFLINE'
  | 'CALIBRATING';

export type HeatingSource = 'GAS_FIRED' | 'ELECTRIC_RESISTANCE' | 'INDUCTION' | 'NONE';

export type AtmosphereType =
  | 'VACUUM'
  | 'ENDOTHERMIC_GAS'
  | 'NITROGEN'
  | 'ARGON'
  | 'HYDROGEN'
  | 'AIR'
  | 'CARBON_DIOXIDE'
  | 'AMMONIA';

export type QuenchMedium =
  | 'OIL'
  | 'WATER'
  | 'POLYMER'
  | 'GAS_HIGH_PRESSURE_N2'
  | 'SALT_BATH'
  | 'NONE';

export type PyrometryClass = 'CLASS_1' | 'CLASS_2' | 'CLASS_3' | 'CLASS_4' | 'CLASS_5' | 'NON_THERMAL';

export type InstrumentationType = 'TYPE_A' | 'TYPE_B' | 'TYPE_C' | 'TYPE_D' | 'TYPE_E' | 'NONE';

export type PyrometryStandard = 'AMS_2750G' | 'CQI_9' | 'BAC_5621' | 'STANDARD' | 'NON_PYROMETRY';

export type NoteCategory = 'OPERATIONAL' | 'MAINTENANCE' | 'CALIBRATION' | 'SAFETY' | 'HANDOVER';

export interface IMachineTechnicalSpecs {
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  yearOfManufacture?: number | null;
  commissioningDate?: Date | null;
  heatingSource: HeatingSource;
  maxPowerKw: number;
  atmosphereTypes: AtmosphereType[];
  quenchMedia: QuenchMedium[];
}

export interface IMachineThermalLimits {
  minOperatingTempC: number;
  maxOperatingTempC: number;
  uniformOperatingMinC: number;
  uniformOperatingMaxC: number;
  maxHeatingRateCPerMin?: number | null;
  maxCoolingRateCPerMin?: number | null;
  temperatureUniformityToleranceC?: number | null;
}

export interface IMachineWorkingDimensions {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  diameterMm?: number | null;
  usableVolumeM3: number;
  maxLoadWeightKg: number;
}

export interface IMachineLocation {
  plant: string;
  building: string;
  bay: string;
  cell?: string | null;
  coordinates?: string | null;
}

export interface IMachineCapabilities {
  supportedProcessFamilies: ProcessFamily[];
  furnaceClass: PyrometryClass;
  instrumentationType: InstrumentationType;
  pyrometryStandard: PyrometryStandard;
  hasAgitationControl?: boolean;
  maxQuenchWeightKg?: number | null;
}

export interface IMachinePyrometryCompliance {
  lastTusDate?: Date | null;
  nextTusDueDate?: Date | null;
  lastSatDate?: Date | null;
  nextSatDueDate?: Date | null;
  isTusValid: boolean;
  isSatValid: boolean;
}

export interface IMachineStatusHistory {
  fromStatus: MachineStatus;
  toStatus: MachineStatus;
  changedAt: Date;
  changedBy: {
    userId: string;
    email?: string;
    role?: string;
  };
  reason?: string | null;
  workOrderId?: string | null;
  downtimeDurationMinutes?: number | null;
}

export interface IMachineNote {
  noteId: string;
  content: string;
  category: NoteCategory;
  authorId: string;
  authorEmail?: string;
  authorRole?: string;
  createdAt: Date;
}

export interface IMachineCurrentJob {
  jobId?: string | null;
  jobNumber?: string | null;
  startedAt?: Date | null;
  expectedCompletionAt?: Date | null;
}

export interface IMachine {
  tenantId: string;
  machineCode: string;
  name: string;
  category: MachineCategory;
  status: MachineStatus;
  technicalSpecs: IMachineTechnicalSpecs;
  thermalLimits: IMachineThermalLimits;
  workingDimensions: IMachineWorkingDimensions;
  location: IMachineLocation;
  capabilities: IMachineCapabilities;
  pyrometryCompliance: IMachinePyrometryCompliance;
  currentJob?: IMachineCurrentJob | null;
  statusHistory: IMachineStatusHistory[];
  notes: IMachineNote[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MachineDocument = IMachine & Document;

// --- DTOs ---

export interface CreateMachineDto {
  machineCode: string;
  name: string;
  category: MachineCategory;
  status?: MachineStatus;
  technicalSpecs: {
    manufacturer: string;
    modelNumber: string;
    serialNumber: string;
    yearOfManufacture?: number;
    commissioningDate?: string | Date;
    heatingSource: HeatingSource;
    maxPowerKw: number;
    atmosphereTypes: AtmosphereType[];
    quenchMedia: QuenchMedium[];
  };
  thermalLimits: {
    minOperatingTempC: number;
    maxOperatingTempC: number;
    uniformOperatingMinC: number;
    uniformOperatingMaxC: number;
    maxHeatingRateCPerMin?: number;
    maxCoolingRateCPerMin?: number;
    temperatureUniformityToleranceC?: number;
  };
  workingDimensions: {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    diameterMm?: number;
    usableVolumeM3: number;
    maxLoadWeightKg: number;
  };
  location: {
    plant: string;
    building: string;
    bay: string;
    cell?: string;
    coordinates?: string;
  };
  capabilities: {
    supportedProcessFamilies: ProcessFamily[];
    furnaceClass: PyrometryClass;
    instrumentationType: InstrumentationType;
    pyrometryStandard: PyrometryStandard;
    hasAgitationControl?: boolean;
    maxQuenchWeightKg?: number;
  };
  pyrometryCompliance?: {
    lastTusDate?: string | Date;
    nextTusDueDate?: string | Date;
    lastSatDate?: string | Date;
    nextSatDueDate?: string | Date;
  };
  initialNote?: string;
}

export interface UpdateMachineDto {
  name?: string;
  technicalSpecs?: Partial<IMachineTechnicalSpecs>;
  thermalLimits?: Partial<IMachineThermalLimits>;
  workingDimensions?: Partial<IMachineWorkingDimensions>;
  location?: Partial<IMachineLocation>;
  capabilities?: Partial<IMachineCapabilities>;
  pyrometryCompliance?: Partial<IMachinePyrometryCompliance>;
}

export interface ChangeMachineStatusDto {
  status: MachineStatus;
  reason?: string;
  workOrderId?: string;
  jobId?: string;
  jobNumber?: string;
}

export interface AddMachineNoteDto {
  content: string;
  category: NoteCategory;
}

export interface QueryMachinesDto {
  category?: MachineCategory;
  status?: MachineStatus;
  processFamily?: ProcessFamily;
  targetTemperatureC?: number;
  requiredLoadWeightKg?: number;
  plant?: string;
  bay?: string;
  search?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MachineFleetSummary {
  totalMachines: number;
  statusCounts: Record<MachineStatus, number>;
  categoryCounts: Record<MachineCategory, number>;
  totalLoadCapacityKg: number;
  fleetAvailabilityPercent: number;
  pyrometryCompliance: {
    compliantCount: number;
    overdueCount: number;
  };
}
