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

  public createOutwardChallan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.createOutwardChallanForBatchOrder(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Outward Challan created successfully under PO/GRN/BO hierarchy');
    } catch (error) {
      next(error);
    }
  };

  public getDispatchQueue = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const queue = await this.service.getDispatchQueue(tenantId);
      this.sendSuccess(res, queue, 'Dispatch queue retrieved successfully');
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

  public authorizeOutwardChallan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.authorizeOutwardChallan(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Outward Challan authorized by signatory successfully');
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

  public completePhysicalDispatch = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.completePhysicalDispatch(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Physical dispatch completed successfully and material released from warehouse');
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

  public recordCustomerAcknowledgement = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.recordCustomerAcknowledgement(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Customer acknowledgement recorded successfully');
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

  public getOutwardChallan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const idOrNumber = (req.params.idOrNumber || req.params.id || req.params.outwardChallanNumber) as string;
      const result = await this.service.getOutwardChallan(tenantId, idOrNumber);
      this.sendSuccess(res, result, 'Authoritative Outward Challan record retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  public printOutwardChallan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const idOrNumber = (req.params.idOrNumber || req.params.id || req.params.outwardChallanNumber) as string;
      const result = await this.service.generatePrintableOutwardChallan(tenantId, idOrNumber, actor);

      if (req.headers.accept?.includes('text/html')) {
        res.status(200).contentType('text/html').send(result.htmlReport);
        return;
      }

      this.sendSuccess(
        res,
        result,
        `Outward Challan '${result.outwardChallan.outwardChallanNumber || result.outwardChallan.dispatchNumber}' printable document generated`
      );
    } catch (error) {
      next(error);
    }
  };

  public updateOutwardChallan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const idOrNumber = (req.params.idOrNumber || req.params.id) as string;
      const result = await this.service.updateOutwardChallan(tenantId, idOrNumber, req.body, actor);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public deleteOutwardChallan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const idOrNumber = (req.params.idOrNumber || req.params.id) as string;
      await this.service.deleteOutwardChallan(tenantId, idOrNumber, actor);
      this.sendSuccess(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  };
}

export const dispatchController = new DispatchController();
