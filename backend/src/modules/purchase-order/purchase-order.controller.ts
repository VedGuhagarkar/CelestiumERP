import { Request, Response } from 'express';
import { purchaseOrderService, PurchaseOrderService } from './purchase-order.service.js';
import { ApiResponse } from '../../core/responses/api-response.js';
import { QueryPurchaseOrderDto } from './purchase-order.types.js';

export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrderService = purchaseOrderService) {}

  public createOrder = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
    const body = {
      ...req.body,
      idempotencyKey: idempotencyKey ? idempotencyKey.trim() : undefined
    };

    const order = await this.service.createOrder(tenantId, body, {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id'] as string
    });
    return ApiResponse.created(res, order, `Purchase Order '${order.poNumber}' created successfully`);
  };

  public getOrderById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const order = await this.service.getOrderById(tenantId, req.params.id as string);
    return ApiResponse.success(res, order, 'Purchase Order retrieved successfully');
  };

  public getOrderByPoNumber = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const order = await this.service.getOrderByPoNumber(tenantId, req.params.poNumber as string);
    return ApiResponse.success(res, order, 'Purchase Order retrieved successfully');
  };

  public queryOrders = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const result = await this.service.queryOrders(tenantId, req.query as unknown as QueryPurchaseOrderDto);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    return ApiResponse.paginated(res, result.orders, page, limit, result.total, 'Purchase Orders queried successfully');
  };

  public updateOrder = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const order = await this.service.updateOrder(tenantId, req.params.id as string, req.body, {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id'] as string
    });
    return ApiResponse.success(res, order, `Purchase Order '${order.poNumber}' updated successfully`);
  };

  public cancelOrder = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const order = await this.service.cancelOrder(tenantId, req.params.id as string, {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id'] as string
    }, req.body.reason);
    return ApiResponse.success(res, order, `Purchase Order '${order.poNumber}' cancelled successfully`);
  };
}

export const purchaseOrderController = new PurchaseOrderController();
