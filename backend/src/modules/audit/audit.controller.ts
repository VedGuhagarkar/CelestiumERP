import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { auditService, AuditService } from './audit.service.js';

export class AuditController extends BaseController {
  constructor(private readonly service: AuditService = auditService) {
    super();
  }

  public queryAuditLogs = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      actorId: req.query.actorId as string,
      action: req.query.action as string,
      status: req.query.status as any,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const result = await this.service.queryAuditLogs(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Audit logs retrieved successfully'
    );
  };

  public getEntityHistory = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;

    const history = await this.service.getEntityHistory(tenantId, entityType, entityId);
    return this.sendSuccess(res, history, `Audit history for ${entityType} ${entityId} retrieved successfully`);
  };
}

export const auditController = new AuditController();
