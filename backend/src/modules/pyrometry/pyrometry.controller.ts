import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { pyrometryService, PyrometryService } from './pyrometry.service.js';

export class PyrometryController extends BaseController {
  constructor(private readonly service: PyrometryService = pyrometryService) {
    super();
  }

  // ==================== Thermocouple Channels ====================

  public registerChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.registerChannel(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Thermocouple channel registered successfully');
    } catch (error) {
      next(error);
    }
  };

  public queryChannels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryChannels(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Calibrations ====================

  public logSensorCalibration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.logSensorCalibration(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Sensor/Instrument calibration recorded');
    } catch (error) {
      next(error);
    }
  };

  public logTusSurvey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.logTusSurvey(tenantId, actor, req.body);
      this.sendCreated(res, result, 'TUS survey logged in DRAFT; awaiting QA approval');
    } catch (error) {
      next(error);
    }
  };

  public logSatTest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.logSatTest(tenantId, actor, req.body);
      this.sendCreated(res, result, 'SAT test logged in DRAFT; awaiting QA approval');
    } catch (error) {
      next(error);
    }
  };

  public approveCalibration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.approveCalibration(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Calibration record formally approved and equipment compliance updated');
    } catch (error) {
      next(error);
    }
  };

  public getCalibrationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getCalibrationById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryCalibrations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryCalibrations(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Telemetry ====================

  public logTelemetrySample = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.logTelemetrySample(tenantId, req.body);
      this.sendCreated(res, result, 'Temperature telemetry sample recorded');
    } catch (error) {
      next(error);
    }
  };

  public getJobTelemetry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const jobId = req.params.jobId as string;
      const result = await this.service.getJobTelemetry(tenantId, jobId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Compliance Status ====================

  public getMachineComplianceStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const machineId = req.params.machineId as string;
      const targetTempC = req.query.targetTempC ? parseFloat(req.query.targetTempC as string) : undefined;
      const result = await this.service.evaluateMachineCompliance(tenantId, machineId, targetTempC);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  private getActor(req: Request) {
    const user = (req as any).user;
    return {
      userId: user?.userId || 'system',
      email: user?.email,
      role: user?.roles?.[0] || 'QUALITY_ENGINEER',
      fullName: user?.fullName || 'Quality Engineer'
    };
  }
}

export const pyrometryController = new PyrometryController();
