import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { dispatchService, DispatchService, IActorContext } from './dispatch.service.js';

export class DispatchController extends BaseController {
  constructor(private readonly service: DispatchService = dispatchService) {
    super();
  }

  private getActorContext(req: Request): IActorContext {
    const user = this.getUser(req);
    return {
      userId: user.userId,
      email: user.email,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      correlationId: (req.headers['x-correlation-id'] as string) || undefined
    };
  }

  public createDispatch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.createDispatch(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Dispatch consignment created successfully in DRAFT state');
    } catch (error) {
      next(error);
    }
  };

  public verifyQuality = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.verifyQuality(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Quality verification and CoC compliance approved');
    } catch (error) {
      next(error);
    }
  };

  public scheduleDispatch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.scheduleDispatch(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Dispatch consignment scheduled successfully');
    } catch (error) {
      next(error);
    }
  };

  public approveDispatch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.approveDispatch(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Dispatch consignment approved and Security Gate Pass generated');
    } catch (error) {
      next(error);
    }
  };

  public recordDeparture = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.recordDeparture(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Physical factory departure recorded and stock deducted');
    } catch (error) {
      next(error);
    }
  };

  public confirmDelivery = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.confirmDelivery(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Customer delivery and Proof of Delivery confirmed');
    } catch (error) {
      next(error);
    }
  };

  public cancelDispatch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.cancelDispatch(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Dispatch consignment cancelled and reserved stock returned');
    } catch (error) {
      next(error);
    }
  };

  public queryDispatches = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryDispatches(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  public getDispatchById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getDispatchById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getDispatchByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const dispatchNumber = req.params.dispatchNumber as string;
      const result = await this.service.getDispatchByNumber(tenantId, dispatchNumber);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

export const dispatchController = new DispatchController();
