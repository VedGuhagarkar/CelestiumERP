import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { customerService, CustomerService, ActorContext } from './customer.service.js';

export class CustomerController extends BaseController {
  constructor(private readonly service: CustomerService = customerService) {
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

  public createCustomer = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getActorContext(req);
    const customer = await this.service.createCustomer(tenantId, req.body, actor);
    return this.sendCreated(res, customer, 'Customer created successfully');
  };

  public getCustomerById = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const customer = await this.service.getCustomerById(tenantId, id);
    return this.sendSuccess(res, customer, 'Customer retrieved successfully');
  };

  public getCustomerByCode = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const code = req.params.code as string;
    const customer = await this.service.getCustomerByCode(tenantId, code);
    return this.sendSuccess(res, customer, 'Customer retrieved successfully');
  };

  public updateCustomer = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    const customer = await this.service.updateCustomer(tenantId, id, req.body, actor);
    return this.sendSuccess(res, customer, 'Customer updated successfully');
  };

  public updateCustomerStatus = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const { status } = req.body;
    const actor = this.getActorContext(req);
    const customer = await this.service.updateCustomerStatus(tenantId, id, status, actor);
    return this.sendSuccess(res, customer, `Customer status updated to '${status}' successfully`);
  };

  public archiveCustomer = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const id = req.params.id as string;
    const actor = this.getActorContext(req);
    await this.service.archiveCustomer(tenantId, id, actor);
    return this.sendSuccess(res, null, 'Customer archived successfully');
  };

  public searchCustomers = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const pagination = this.parsePagination(req);
    const filters = {
      search: req.query.search as string,
      industrySegment: req.query.industrySegment as any,
      qualityStatus: req.query.qualityStatus as any,
      status: req.query.status as any,
      hasActiveJobs: req.query.hasActiveJobs === 'true'
    };

    const result = await this.service.searchCustomers(tenantId, filters, pagination);
    return this.sendPaginated(
      res,
      result.items,
      result.page,
      result.limit,
      result.total,
      'Customers retrieved successfully'
    );
  };
}

export const customerController = new CustomerController();
