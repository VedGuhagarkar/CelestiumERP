import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { warehouseService, WarehouseService } from './warehouse.service.js';
import { ActorContext } from '../customer/customer.service.js';

export class WarehouseController extends BaseController {
  constructor(private readonly service: WarehouseService = warehouseService) {
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

  public createWarehouse = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const warehouse = await this.service.createWarehouse(tenantId, req.body, actor);
    return this.sendCreated(res, warehouse, 'Warehouse created successfully');
  };

  public getWarehouseById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const warehouse = await this.service.getWarehouseById(tenantId, id);
    return this.sendSuccess(res, warehouse, 'Warehouse retrieved successfully');
  };

  public updateWarehouse = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const warehouse = await this.service.updateWarehouse(tenantId, id, req.body, actor);
    return this.sendSuccess(res, warehouse, 'Warehouse updated successfully');
  };

  public searchWarehouses = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      type: req.query.type as any,
      status: req.query.status as any
    };

    const result = await this.service.searchWarehouses(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Warehouses retrieved successfully'
    );
  };

  public createStorageLocation = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const location = await this.service.createStorageLocation(tenantId, req.body, actor);
    return this.sendCreated(res, location, 'Storage location created successfully');
  };

  public getLocationById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const location = await this.service.getLocationById(tenantId, id);
    return this.sendSuccess(res, location, 'Storage location retrieved successfully');
  };

  public getLocationByCode = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const code = req.params.code as string;
    const location = await this.service.getLocationByCode(tenantId, code);
    return this.sendSuccess(res, location, 'Storage location retrieved successfully');
  };

  public updateStorageLocation = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const location = await this.service.updateStorageLocation(tenantId, id, req.body, actor);
    return this.sendSuccess(res, location, 'Storage location updated successfully');
  };

  public searchLocations = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      warehouseId: req.query.warehouseId as string,
      warehouseCode: req.query.warehouseCode as string,
      zoneType: req.query.zoneType as any,
      status: req.query.status as any,
      isQuarantineLocation: req.query.isQuarantineLocation !== undefined
        ? req.query.isQuarantineLocation === 'true'
        : undefined
    };

    const result = await this.service.searchLocations(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Storage locations retrieved successfully'
    );
  };

  public getLocationsByWarehouse = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const warehouseId = req.params.warehouseId as string;
    const locations = await this.service.getLocationsByWarehouse(tenantId, warehouseId);
    return this.sendSuccess(res, locations, 'Warehouse locations retrieved successfully');
  };
}

export const warehouseController = new WarehouseController();
