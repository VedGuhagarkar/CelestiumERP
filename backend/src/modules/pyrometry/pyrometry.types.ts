import { Document } from 'mongoose';
import { PyrometryClass, PyrometryStandard, InstrumentationType } from '../machine/machine.types.js';

export type ChannelType =
  | 'CONTROL'
  | 'OVERTEMPERATURE'
  | 'RECORDING'
  | 'LOAD_SURFACE'
  | 'LOAD_CORE'
  | 'TUS_SURVEY'
  | 'SAT_TEST';

export type ThermocoupleType =
  | 'TYPE_K'
  | 'TYPE_N'
  | 'TYPE_R'
  | 'TYPE_S'
  | 'TYPE_B'
  | 'TYPE_J'
  | 'TYPE_T';

export type CalibrationType =
  | 'SENSOR_CALIBRATION'
  | 'INSTRUMENT_CALIBRATION'
  | 'TUS_SURVEY'
  | 'SAT_TEST';

export type CalibrationStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type SatMethod =
  | 'COMPARISON_PORTABLE_STANDARD'
  | 'RESIDENT_STANDARD'
  | 'ALTERNATE_SAT';

export type ComplianceAlertLevel =
  | 'COMPLIANT'
  | 'TUS_EXPIRING_SOON'
  | 'TUS_OVERDUE'
  | 'SAT_OVERDUE'
  | 'SENSOR_EXPIRED'
  | 'NON_COMPLIANT_EXCURSION';

export interface ICorrectionOffset {
  setpointTempC: number;
  rawReadingC: number;
  correctedOffsetC: number;
}

export interface IThermocoupleChannel {
  tenantId: string;
  channelId: string;
  machineId: string;
  machineCode: string;
  furnaceZoneNumber: number;
  channelType: ChannelType;
  thermocoupleType: ThermocoupleType;
  locationDescription: string;
  sensorSerialNumber: string;
  wireSpoolNumber?: string | null;
  calibrationOffsetC: number;
  correctionOffsets: ICorrectionOffset[];
  maxAllowedUsageCount?: number | null;
  currentUsageCount: number;
  calibratedAt: Date;
  expiresAt: Date;
  isCalibrated: boolean;
  isActive: boolean;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ThermocoupleChannelDocument = IThermocoupleChannel & Document;

// --- Calibration Record Interfaces ---

export interface ISensorCalibrationTestPoint {
  nominalTempC: number;
  instrumentReadingC: number;
  standardReadingC: number;
  errorC: number;
  maxAllowedErrorC: number;
  correctionOffsetC: number;
  passed: boolean;
}

export interface ITusSurveyTemperature {
  setpointC: number;
  minObservedC: number;
  maxObservedC: number;
  uniformitySpreadC: number;
  maxAllowedSpreadC: number;
  durationMinutes: number;
  passed: boolean;
}

export interface ITusRecord {
  furnaceClass: PyrometryClass;
  operatingRangeMinC: number;
  operatingRangeMaxC: number;
  surveyTemperatures: ITusSurveyTemperature[];
  surveySensorCount: number;
  overallPassed: boolean;
  reportDocumentUrl?: string | null;
}

export interface ISatRecord {
  satMethod: SatMethod;
  targetSetpointC: number;
  furnaceControlReadingC: number;
  testStandardReadingC: number;
  observedDifferenceC: number;
  maxAllowedDifferenceC: number;
  passed: boolean;
}

export interface ICalibrationRecord {
  tenantId: string;
  calibrationNumber: string;
  calibrationType: CalibrationType;
  machineId: string;
  machineCode: string;
  channelId?: string | null;
  standardReference: PyrometryStandard;
  status: CalibrationStatus;

  // Sensor / Instrument Calibration
  instrumentModel?: string | null;
  instrumentSerial?: string | null;
  calibratedBy: {
    userId: string;
    email?: string;
    role?: string;
    technicianName: string;
    externalAgency?: string | null;
  };
  masterStandardSerial: string;
  masterStandardExpiry: Date;
  testPoints?: ISensorCalibrationTestPoint[];
  overallPassed: boolean;

  // Specific Sub-records
  tusRecord?: ITusRecord | null;
  satRecord?: ISatRecord | null;

  testDate: Date;
  expiryDate: Date;
  approvedBy?: {
    userId: string;
    email?: string;
    role?: string;
    approvedAt: Date;
    comments?: string | null;
  } | null;
  certificateNumber?: string | null;
  notes?: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CalibrationRecordDocument = ICalibrationRecord & Document;

// --- Temperature Telemetry Sample ---

export interface IChannelReading {
  channelId: string;
  channelType: ChannelType;
  setpointC?: number | null;
  rawReadingC: number;
  correctedReadingC: number;
  isOvertempAlert: boolean;
}

export interface ITemperatureTelemetrySample {
  tenantId: string;
  machineId: string;
  machineCode: string;
  jobId?: string | null;
  jobNumber?: string | null;
  timestamp: Date;
  channelReadings: IChannelReading[];
  vacuumLevelMbar?: number | null;
  carbonPotentialPercent?: number | null;
  atmosphereGasFlowScmh?: number | null;
  isExcursionAlert: boolean;
  excursionDetails?: string | null;
  createdAt: Date;
}

export type TemperatureTelemetrySampleDocument = ITemperatureTelemetrySample & Document;

// --- Machine Pyrometry Compliance Status Evaluation ---

export interface MachinePyrometryComplianceStatus {
  machineId: string;
  machineCode: string;
  pyrometryStandard: PyrometryStandard;
  furnaceClass: PyrometryClass;
  instrumentationType: InstrumentationType;
  isCompliant: boolean;
  overallAlertLevel: ComplianceAlertLevel;
  tusStatus: {
    isValid: boolean;
    lastTusDate?: Date | null;
    nextTusDueDate?: Date | null;
    operatingRangeMinC?: number;
    operatingRangeMaxC?: number;
    daysUntilExpiry?: number;
  };
  satStatus: {
    isValid: boolean;
    lastSatDate?: Date | null;
    nextSatDueDate?: Date | null;
    daysUntilExpiry?: number;
  };
  channelStatus: {
    totalChannels: number;
    controlChannelsValid: boolean;
    overtempChannelsValid: boolean;
    expiredChannels: Array<{
      channelId: string;
      channelType: ChannelType;
      expiresAt: Date;
    }>;
  };
  alerts: string[];
}

// --- DTOs ---

export interface RegisterChannelDto {
  channelId: string;
  machineId: string;
  furnaceZoneNumber: number;
  channelType: ChannelType;
  thermocoupleType: ThermocoupleType;
  locationDescription: string;
  sensorSerialNumber: string;
  wireSpoolNumber?: string;
  calibrationOffsetC?: number;
  correctionOffsets?: ICorrectionOffset[];
  maxAllowedUsageCount?: number;
  calibratedAt: string | Date;
  expiresAt: string | Date;
  notes?: string;
}

export interface LogSensorCalibrationDto {
  machineId: string;
  channelId?: string;
  calibrationType: 'SENSOR_CALIBRATION' | 'INSTRUMENT_CALIBRATION';
  standardReference: PyrometryStandard;
  instrumentModel?: string;
  instrumentSerial?: string;
  technicianName: string;
  externalAgency?: string;
  masterStandardSerial: string;
  masterStandardExpiry: string | Date;
  testPoints: ISensorCalibrationTestPoint[];
  testDate: string | Date;
  expiryDate: string | Date;
  certificateNumber?: string;
  notes?: string;
}

export interface LogTusSurveyDto {
  machineId: string;
  standardReference: PyrometryStandard;
  technicianName: string;
  externalAgency?: string;
  masterStandardSerial: string;
  masterStandardExpiry: string | Date;
  furnaceClass: PyrometryClass;
  operatingRangeMinC: number;
  operatingRangeMaxC: number;
  surveyTemperatures: ITusSurveyTemperature[];
  surveySensorCount: number;
  testDate: string | Date;
  expiryDate: string | Date;
  reportDocumentUrl?: string;
  certificateNumber?: string;
  notes?: string;
}

export interface LogSatTestDto {
  machineId: string;
  channelId: string;
  standardReference: PyrometryStandard;
  technicianName: string;
  masterStandardSerial: string;
  masterStandardExpiry: string | Date;
  satMethod: SatMethod;
  targetSetpointC: number;
  furnaceControlReadingC: number;
  testStandardReadingC: number;
  testDate: string | Date;
  expiryDate: string | Date;
  certificateNumber?: string;
  notes?: string;
}

export interface ApproveCalibrationDto {
  comments?: string;
}

export interface LogTelemetryDto {
  machineId: string;
  jobId?: string;
  jobNumber?: string;
  timestamp?: string | Date;
  channelReadings: Array<{
    channelId: string;
    setpointC?: number;
    rawReadingC: number;
  }>;
  vacuumLevelMbar?: number;
  carbonPotentialPercent?: number;
  atmosphereGasFlowScmh?: number;
}

export interface QueryCalibrationsDto {
  machineId?: string;
  channelId?: string;
  calibrationType?: CalibrationType;
  status?: CalibrationStatus;
  search?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryChannelsDto {
  machineId?: string;
  channelType?: ChannelType;
  isActive?: boolean;
  search?: string;
  page?: string | number;
  limit?: string | number;
}
