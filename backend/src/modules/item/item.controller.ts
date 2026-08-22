import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { itemService, ItemService } from './item.service.js';
import { ActorContext } from '../customer/customer.service.js';

export class ItemController extends BaseController {
  constructor(private readonly service: ItemService = itemService) {
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

  public createItem = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const item = await this.service.createItem(tenantId, req.body, actor);
    return this.sendCreated(res, item, 'Item created successfully');
  };

  public getItemById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const item = await this.service.getItemById(tenantId, id);
    return this.sendSuccess(res, item, 'Item retrieved successfully');
  };

  public getItemByCode = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const code = req.params.code as string;
    const item = await this.service.getItemByCode(tenantId, code);
    return this.sendSuccess(res, item, 'Item retrieved successfully');
  };

  public updateItem = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const item = await this.service.updateItem(tenantId, id, req.body, actor);
    return this.sendSuccess(res, item, 'Item updated successfully');
  };

  public updateItemStatus = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const { status } = req.body;
    const actor = this.getActorContext(req);
    const item = await this.service.updateItemStatus(tenantId, id, status, actor);
    return this.sendSuccess(res, item, `Item status updated to '${status}' successfully`);
  };

  public archiveItem = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    await this.service.archiveItem(tenantId, id, actor);
    return this.sendSuccess(res, null, 'Item archived successfully');
  };

  public searchItems = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      category: req.query.category as any,
      materialGrade: req.query.materialGrade as string,
      isHazardous: req.query.isHazardous !== undefined ? req.query.isHazardous === 'true' : undefined,
      isBelowReorderPoint: req.query.isBelowReorderPoint === 'true',
      status: req.query.status as any
    };

    const result = await this.service.searchItems(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Items retrieved successfully'
    );
  };
}

export const itemController = new ItemController();
