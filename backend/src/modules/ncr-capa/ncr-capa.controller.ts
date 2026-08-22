import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { ncrCapaService, NcrCapaService } from './ncr-capa.service.js';

export class NcrCapaController extends BaseController {
  constructor(private readonly service: NcrCapaService = ncrCapaService) {
    super();
  }

  // ==================== NCR Endpoints ====================

  public createNcr = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.createNcr(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Non-Conformance Report raised successfully');
    } catch (error) {
      next(error);
    }
  };

  public recordRootCause = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.recordRootCause(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Root Cause Analysis recorded successfully');
    } catch (error) {
      next(error);
    }
  };

  public recordDisposition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.recordDisposition(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'MRB Disposition recorded successfully');
    } catch (error) {
      next(error);
    }
  };

  public closeNcr = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.closeNcr(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Non-Conformance Report closed successfully');
    } catch (error) {
      next(error);
    }
  };

  public getNcrById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getNcrById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryNcrs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryNcrs(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  // ==================== CAPA Endpoints ====================

  public createCapa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const ncrId = req.params.ncrId as string;
      const result = await this.service.createCapa(tenantId, actor, ncrId, req.body);
      this.sendCreated(res, result, 'CAPA initiated successfully');
    } catch (error) {
      next(error);
    }
  };

  public updateActionItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.updateActionItem(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'CAPA action item updated successfully');
    } catch (error) {
      next(error);
    }
  };

  public verifyEffectiveness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.verifyEffectiveness(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'CAPA effectiveness verification recorded');
    } catch (error) {
      next(error);
    }
  };

  public closeCapa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.closeCapa(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'CAPA closed successfully');
    } catch (error) {
      next(error);
    }
  };

  public getCapaById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getCapaById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryCapas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryCapas(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  private getActor(req: Request) {
    const user = (req as any).user;
    return {
      userId: user?.userId || 'system',
      email: user?.email,
      role: user?.roles?.[0] || 'METALLURGIST'
    };
  }
}

export const ncrCapaController = new NcrCapaController();
