import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { specificationService, SpecificationService } from './specification.service.js';
import { ActorContext } from '../customer/customer.service.js';

export class SpecificationController extends BaseController {
  constructor(private readonly service: SpecificationService = specificationService) {
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

  public createSpecification = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const spec = await this.service.createSpecification(tenantId, req.body, actor);
    return this.sendCreated(res, spec, 'Metallurgical specification created in DRAFT status');
  };

  public getSpecificationById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const spec = await this.service.getSpecificationById(tenantId, id);
    return this.sendSuccess(res, spec, 'Specification retrieved successfully');
  };

  public getSpecificationByCodeAndRevision = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const code = req.params.code as string;
    const revision = parseInt(req.params.revision as string, 10);
    const spec = await this.service.getSpecificationByCodeAndRevision(tenantId, code, revision);
    return this.sendSuccess(res, spec, 'Specification revision retrieved successfully');
  };

  public getLatestActiveSpecification = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const code = req.params.code as string;
    const spec = await this.service.getLatestActiveSpecification(tenantId, code);
    return this.sendSuccess(res, spec, 'Latest active specification retrieved successfully');
  };

  public updateSpecification = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const spec = await this.service.updateSpecification(tenantId, id, req.body, actor);
    return this.sendSuccess(res, spec, 'Specification updated successfully');
  };

  public submitForApproval = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const spec = await this.service.submitForApproval(tenantId, id, actor);
    return this.sendSuccess(res, spec, 'Specification submitted for metallurgical approval');
  };

  public approveSpecification = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const spec = await this.service.approveSpecification(tenantId, id, req.body, actor);
    return this.sendSuccess(res, spec, 'Specification approved and released for production');
  };

  public rejectSpecification = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const spec = await this.service.rejectSpecification(tenantId, id, req.body, actor);
    return this.sendSuccess(res, spec, 'Specification rejected back to DRAFT status');
  };

  public createNewRevision = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const newRevision = await this.service.createNewRevision(tenantId, id, actor);
    return this.sendCreated(res, newRevision, 'New specification revision created in DRAFT status');
  };

  public retireSpecification = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const spec = await this.service.retireSpecification(tenantId, id, actor);
    return this.sendSuccess(res, spec, 'Specification retired successfully');
  };

  public searchSpecifications = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      customerId: req.query.customerId as string,
      customerCode: req.query.customerCode as string,
      processFamily: req.query.processFamily as any,
      materialGrade: req.query.materialGrade as string,
      status: req.query.status as any
    };

    const result = await this.service.searchSpecifications(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Specifications retrieved successfully'
    );
  };
}

export const specificationController = new SpecificationController();
