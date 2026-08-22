import { Router } from 'express';
import { pyrometryController } from './pyrometry.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  registerChannelSchema,
  logSensorCalibrationSchema,
  logTusSurveySchema,
  logSatTestSchema,
  approveCalibrationSchema,
  logTelemetrySchema,
  queryCalibrationsSchema,
  queryChannelsSchema
} from './pyrometry.validator.js';

export const pyrometryRouter = Router();

pyrometryRouter.use(authenticateJwt);

// Compliance Status for Machine
pyrometryRouter.get(
  '/machines/:machineId/compliance-status',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_VIEW),
  pyrometryController.getMachineComplianceStatus
);

// Register Thermocouple Channel
pyrometryRouter.post(
  '/channels',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_CALIBRATE),
  validateRequest({ body: registerChannelSchema }),
  pyrometryController.registerChannel
);

// Query Thermocouple Channels
pyrometryRouter.get(
  '/channels',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_VIEW),
  validateRequest({ query: queryChannelsSchema }),
  pyrometryController.queryChannels
);

// Log Sensor / Instrument Calibration
pyrometryRouter.post(
  '/calibrations/sensor',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_CALIBRATE),
  validateRequest({ body: logSensorCalibrationSchema }),
  pyrometryController.logSensorCalibration
);

// Log TUS Survey (Draft)
pyrometryRouter.post(
  '/calibrations/tus',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_CALIBRATE),
  validateRequest({ body: logTusSurveySchema }),
  pyrometryController.logTusSurvey
);

// Log SAT Test (Draft)
pyrometryRouter.post(
  '/calibrations/sat',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_CALIBRATE),
  validateRequest({ body: logSatTestSchema }),
  pyrometryController.logSatTest
);

// Approve Calibration (TUS / SAT / Sensor)
pyrometryRouter.post(
  '/calibrations/:id/approve',
  requireAnyPermission(
    PERMISSIONS.QUALITY_PYROMETRY_APPROVE_SAT,
    PERMISSIONS.QUALITY_PYROMETRY_APPROVE_TUS,
    PERMISSIONS.QUALITY_PYROMETRY_CALIBRATE
  ),
  validateRequest({ body: approveCalibrationSchema }),
  pyrometryController.approveCalibration
);

// Query Calibrations
pyrometryRouter.get(
  '/calibrations',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_VIEW),
  validateRequest({ query: queryCalibrationsSchema }),
  pyrometryController.queryCalibrations
);

// Get Calibration by ID
pyrometryRouter.get(
  '/calibrations/:id',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_VIEW),
  pyrometryController.getCalibrationById
);

// Telemetry Logging
pyrometryRouter.post(
  '/telemetry',
  requireAnyPermission(
    PERMISSIONS.MACHINES_TELEMETRY_LOG,
    PERMISSIONS.MACHINES_FURNACE_OPERATE
  ),
  validateRequest({ body: logTelemetrySchema }),
  pyrometryController.logTelemetrySample
);

// Get Job Telemetry Samples
pyrometryRouter.get(
  '/telemetry/jobs/:jobId',
  requirePermission(PERMISSIONS.QUALITY_PYROMETRY_VIEW),
  pyrometryController.getJobTelemetry
);
