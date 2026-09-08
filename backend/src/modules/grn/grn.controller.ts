import { Request, Response } from 'express';
import { grnService, GRNService } from './grn.service.js';
import { ApiResponse } from '../../core/responses/api-response.js';
import { QueryGrnDto, QueryGrnUnitDto } from './grn.types.js';

export class GRNController {
  constructor(private readonly service: GRNService = grnService) {}

  public recordMaterialReceipt = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const receipt = await this.service.recordMaterialReceipt(tenantId, req.body, {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id'] as string
    });
    return ApiResponse.created(res, receipt, `Material Receipt '${receipt.receiptNumber}' recorded successfully`);
  };

  public storeMaterial = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const receipt = await this.service.storeMaterialInWarehouse(tenantId, req.params.id as string, req.body, {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id'] as string
    });
    return ApiResponse.success(res, receipt, `Material stored in warehouse location '${receipt.storageLocationCode}'`);
  };

  public createGRN = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const grn = await this.service.createGRN(tenantId, req.body, {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id'] as string
    });
    return ApiResponse.created(
      res,
      grn,
      `Goods Receipt Note '${grn.grnNumber}' generated with ${grn.totalUnitsGenerated} units available for planning`
    );
  };

  public printGRN = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const result = await this.service.generatePrintableGRN(tenantId, req.params.id as string, {
      userId: user.userId,
      email: user.email,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id'] as string
    });

    if (req.headers.accept?.includes('text/html')) {
      return res.status(200).contentType('text/html').send(result.htmlReport);
    }

    return ApiResponse.success(res, result, `GRN '${result.grn.grnNumber}' printable report generated`);
  };

  public getGrnById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const searchId = req.params.id as string;
    const { grns } = await this.service.queryGRNs(tenantId, { search: searchId });
    const grn = grns.find((g) => g.id === searchId || g.grnNumber === searchId);
    if (!grn) {
      return ApiResponse.error(res, `GRN '${searchId}' not found`, 404);
    }
    return ApiResponse.success(res, grn, 'GRN retrieved successfully');
  };

  public queryGRNs = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const result = await this.service.queryGRNs(tenantId, req.query as unknown as QueryGrnDto);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    return ApiResponse.paginated(res, result.grns, page, limit, result.total, 'GRNs queried successfully');
  };

  public queryUnits = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const result = await this.service.queryUnits(tenantId, req.query as unknown as QueryGrnUnitDto);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    return ApiResponse.paginated(res, result.units, page, limit, result.total, 'GRN units queried successfully');
  };

  public queryReceipts = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const receipts = await this.service.queryReceipts(tenantId, req.query as any);
    return ApiResponse.success(res, receipts, 'Material Receipts queried successfully');
  };

  public getAvailableUnitsForPlanning = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const { itemId, recipeId, materialGrade } = req.query as {
      itemId?: string;
      recipeId?: string;
      materialGrade?: string;
    };
    const units = await this.service.getAvailableUnitsForPlanning(tenantId, {
      itemId,
      recipeId,
      materialGrade
    });
    return ApiResponse.success(res, units, 'Available units for planning retrieved');
  };

  public getUnitTraceability = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const unitIdentifier = req.params.unitIdentifier as string;
    const traceability = await this.service.getUnitTraceability(tenantId, unitIdentifier);
    return ApiResponse.success(res, traceability, `Traceability for unit '${unitIdentifier}' retrieved`);
  };

  public allocateUnitForPlanning = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = req.tenantId!;
    const user = req.user!;
    const unitIdentifier = req.params.unitIdentifier as string;
    const allocated = await this.service.allocateUnitForPlanning(tenantId, unitIdentifier, req.body, {
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.headers['x-correlation-id'] as string
    });
    return ApiResponse.success(res, allocated, `Unit '${unitIdentifier}' allocated to plan '${req.body.allocatedPlanNumber}'`);
  };

  public getStateMachineLifecycle = async (_req: Request, res: Response): Promise<Response> => {
    const lifecycle = this.service.getCreationPhaseLifecycle();
    return ApiResponse.success(res, lifecycle, 'Authoritative Creation Phase State Machine lifecycle retrieved');
  };
}

export const grnController = new GRNController();
