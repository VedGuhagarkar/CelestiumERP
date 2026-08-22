import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { inventoryService, InventoryService } from './inventory.service.js';
import { ActorContext } from '../customer/customer.service.js';

export class InventoryController extends BaseController {
  constructor(private readonly service: InventoryService = inventoryService) {
    super();
  }

  private getActorContext(req: Request): ActorContext {
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

  public recordGoodsReceipt = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const transaction = await this.service.recordGoodsReceipt(tenantId, req.body, actor);
    return this.sendCreated(res, transaction, 'Goods receipt recorded successfully in ledger');
  };

  public recordGoodsIssue = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const transaction = await this.service.recordGoodsIssue(tenantId, req.body, actor);
    return this.sendSuccess(res, transaction, 'Goods issue recorded successfully in ledger');
  };

  public recordStockAdjustment = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const transaction = await this.service.recordStockAdjustment(tenantId, req.body, actor);
    return this.sendSuccess(res, transaction, 'Stock adjustment recorded successfully in ledger');
  };

  public recordInternalTransfer = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const transaction = await this.service.recordInternalTransfer(tenantId, req.body, actor);
    return this.sendSuccess(res, transaction, 'Internal stock transfer recorded successfully');
  };

  public reserveStock = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const transaction = await this.service.reserveStock(tenantId, req.body, actor);
    return this.sendSuccess(res, transaction, 'Stock quantity reserved successfully');
  };

  public releaseReservation = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const transaction = await this.service.releaseReservation(tenantId, req.body, actor);
    return this.sendSuccess(res, transaction, 'Stock reservation released successfully');
  };

  public searchBalances = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      itemId: req.query.itemId as string,
      itemCode: req.query.itemCode as string,
      location: req.query.location as string
    };

    const result = await this.service.searchBalances(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Stock balances retrieved successfully'
    );
  };

  public searchTransactions = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      itemId: req.query.itemId as string,
      itemCode: req.query.itemCode as string,
      type: req.query.type as any,
      location: req.query.location as string,
      referenceType: req.query.referenceType as any,
      referenceNumber: req.query.referenceNumber as string
    };

    const result = await this.service.searchTransactions(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Inventory ledger transactions retrieved successfully'
    );
  };
}

export const inventoryController = new InventoryController();
