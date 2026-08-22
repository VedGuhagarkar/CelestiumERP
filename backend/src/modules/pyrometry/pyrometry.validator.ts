import { z } from 'zod';
import {
  PyrometryClassEnum,
  PyrometryStandardEnum
} from '../machine/machine.validator.js';

export const ChannelTypeEnum = z.enum([
  'CONTROL',
  'OVERTEMPERATURE',
  'RECORDING',
  'LOAD_SURFACE',
  'LOAD_CORE',
  'TUS_SURVEY',
  'SAT_TEST'
]);

export const ThermocoupleTypeEnum = z.enum([
  'TYPE_K',
  'TYPE_N',
  'TYPE_R',
  'TYPE_S',
  'TYPE_B',
  'TYPE_J',
  'TYPE_T'
]);

export const CalibrationTypeEnum = z.enum([
  'SENSOR_CALIBRATION',
  'INSTRUMENT_CALIBRATION',
  'TUS_SURVEY',
  'SAT_TEST'
]);

export const CalibrationStatusEnum = z.enum(['DRAFT', 'APPROVED', 'REJECTED', 'EXPIRED']);

export const SatMethodEnum = z.enum([
  'COMPARISON_PORTABLE_STANDARD',
  'RESIDENT_STANDARD',
  'ALTERNATE_SAT'
]);

const correctionOffsetSchema = z.object({
  setpointTempC: z.number(),
  rawReadingC: z.number(),
  correctedOffsetC: z.number()
});

const sensorCalibrationTestPointSchema = z.object({
  nominalTempC: z.number(),
  instrumentReadingC: z.number(),
  standardReadingC: z.number(),
  errorC: z.number(),
  maxAllowedErrorC: z.number(),
  correctionOffsetC: z.number(),
  passed: z.boolean()
});

const tusSurveyTemperatureSchema = z.object({
  setpointC: z.number(),
  minObservedC: z.number(),
  maxObservedC: z.number(),
  uniformitySpreadC: z.number(),
  maxAllowedSpreadC: z.number(),
  durationMinutes: z.number().min(1),
  passed: z.boolean()
});

export const registerChannelSchema = z.object({
  channelId: z.string().min(2).max(50).trim(),
  machineId: z.string().min(1, 'Machine ID is required'),
  furnaceZoneNumber: z.number().int().min(1),
  channelType: ChannelTypeEnum,
  thermocoupleType: ThermocoupleTypeEnum,
  locationDescription: z.string().min(2).max(200).trim(),
  sensorSerialNumber: z.string().min(1).max(100).trim(),
  wireSpoolNumber: z.string().max(100).optional(),
  calibrationOffsetC: z.number().default(0.0),
  correctionOffsets: z.array(correctionOffsetSchema).optional(),
  maxAllowedUsageCount: z.number().int().min(1).optional(),
  calibratedAt: z.string().or(z.date()),
  expiresAt: z.string().or(z.date()),
  notes: z.string().max(1000).optional()
});

export const logSensorCalibrationSchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  channelId: z.string().optional(),
  calibrationType: z.enum(['SENSOR_CALIBRATION', 'INSTRUMENT_CALIBRATION']),
  standardReference: PyrometryStandardEnum,
  instrumentModel: z.string().max(100).optional(),
  instrumentSerial: z.string().max(100).optional(),
  technicianName: z.string().min(1).max(100).trim(),
  externalAgency: z.string().max(100).optional(),
  masterStandardSerial: z.string().min(1).max(100).trim(),
  masterStandardExpiry: z.string().or(z.date()),
  testPoints: z.array(sensorCalibrationTestPointSchema).min(1),
  testDate: z.string().or(z.date()),
  expiryDate: z.string().or(z.date()),
  certificateNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional()
});

export const logTusSurveySchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  standardReference: PyrometryStandardEnum,
  technicianName: z.string().min(1).max(100).trim(),
  externalAgency: z.string().max(100).optional(),
  masterStandardSerial: z.string().min(1).max(100).trim(),
  masterStandardExpiry: z.string().or(z.date()),
  furnaceClass: PyrometryClassEnum,
  operatingRangeMinC: z.number(),
  operatingRangeMaxC: z.number(),
  surveyTemperatures: z.array(tusSurveyTemperatureSchema).min(1),
  surveySensorCount: z.number().int().min(3),
  testDate: z.string().or(z.date()),
  expiryDate: z.string().or(z.date()),
  reportDocumentUrl: z.string().max(500).optional(),
  certificateNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional()
});

export const logSatTestSchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  channelId: z.string().min(1, 'Channel ID is required'),
  standardReference: PyrometryStandardEnum,
  technicianName: z.string().min(1).max(100).trim(),
  masterStandardSerial: z.string().min(1).max(100).trim(),
  masterStandardExpiry: z.string().or(z.date()),
  satMethod: SatMethodEnum,
  targetSetpointC: z.number(),
  furnaceControlReadingC: z.number(),
  testStandardReadingC: z.number(),
  testDate: z.string().or(z.date()),
  expiryDate: z.string().or(z.date()),
  certificateNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional()
});

export const approveCalibrationSchema = z.object({
  comments: z.string().max(500).optional()
});

export const logTelemetrySchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  jobId: z.string().optional(),
  jobNumber: z.string().optional(),
  timestamp: z.string().or(z.date()).optional(),
  channelReadings: z
    .array(
      z.object({
        channelId: z.string().min(1),
        setpointC: z.number().optional(),
        rawReadingC: z.number()
      })
    )
    .min(1),
  vacuumLevelMbar: z.number().min(0).optional(),
  carbonPotentialPercent: z.number().min(0).max(2).optional(),
  atmosphereGasFlowScmh: z.number().min(0).optional()
});

export const queryCalibrationsSchema = z.object({
  machineId: z.string().optional(),
  channelId: z.string().optional(),
  calibrationType: CalibrationTypeEnum.optional(),
  status: CalibrationStatusEnum.optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

export const queryChannelsSchema = z.object({
  machineId: z.string().optional(),
  channelType: ChannelTypeEnum.optional(),
  isActive: z.string().transform((v) => v === 'true').optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional()
});
