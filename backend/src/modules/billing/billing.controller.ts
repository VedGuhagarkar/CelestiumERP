import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { billingService, BillingService, IActorContext } from './billing.service.js';

export class BillingController extends BaseController {
  constructor(private readonly service: BillingService = billingService) {
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

  public createInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.createInvoice(tenantId, actor, req.body);
      this.sendCreated(res, result, `Invoice '${result.invoiceNumber}' created in status '${result.status}'`);
    } catch (error) {
      next(error);
    }
  };

  public finalizeInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.finalizeInvoice(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, `Invoice '${result.invoiceNumber}' finalized and issued to customer`);
    } catch (error) {
      next(error);
    }
  };

  public recordPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.recordPayment(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, `Payment recorded for Invoice '${result.invoiceNumber}'`);
    } catch (error) {
      next(error);
    }
  };

  public voidInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.voidInvoice(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, `Invoice '${result.invoiceNumber}' has been VOIDED`);
    } catch (error) {
      next(error);
    }
  };

  public getInvoiceById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getInvoiceById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getInvoiceByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const invoiceNumber = req.params.invoiceNumber as string;
      const result = await this.service.getInvoiceByNumber(tenantId, invoiceNumber);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryInvoices = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryInvoices(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  public getAgingReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
      const result = await this.service.getAgingReport(tenantId, asOfDate);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getReceivablesSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getReceivablesSummary(tenantId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

export const billingController = new BillingController();
