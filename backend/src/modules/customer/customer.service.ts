import { BaseService } from '../../core/services/base.service.js';
import { ICustomerRepository, customerRepository } from './customer.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  CustomerDocument,
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerFilterQuery
} from './customer.types.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface ActorContext {
  userId: string;
  email?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class CustomerService extends BaseService {
  constructor(
    private readonly repo: ICustomerRepository = customerRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('CustomerService');
  }

  /**
   * Registers a new customer in the master registry
   */
  public async createCustomer(
    tenantId: string,
    dto: CreateCustomerDto,
    actor?: ActorContext
  ): Promise<CustomerDocument> {
    const code = dto.customerCode.toUpperCase();
    const existing = await this.repo.findByCode(tenantId, code);
    if (existing) {
      throw new ConflictError(`Customer with code '${code}' already exists in this tenant`);
    }

    const customer = await this.repo.create(tenantId, {
      ...dto,
      customerCode: code,
      qualityStatus: dto.qualityStatus || 'approved',
      status: 'active',
      activeJobCount: 0,
      totalJobCount: 0
    } as any);

    this.logger.info(`🏭 Customer master registered: [${customer.customerCode}] "${customer.companyName}" on tenant [${tenantId}]`);

    // Record compliance audit
    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CUSTOMER_CREATED',
        entityType: 'Customer',
        entityId: customer.id,
        afterState: customer.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('CUSTOMER_CREATED', tenantId, {
      customerId: customer.id,
      customerCode: customer.customerCode,
      companyName: customer.companyName
    });

    return customer;
  }

  /**
   * Retrieves customer by ID
   */
  public async getCustomerById(tenantId: string, id: string): Promise<CustomerDocument> {
    const customer = await this.repo.findById(tenantId, id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${id}' not found`);
    }
    return customer;
  }

  /**
   * Retrieves customer by Customer Code
   */
  public async getCustomerByCode(tenantId: string, code: string): Promise<CustomerDocument> {
    const customer = await this.repo.findByCode(tenantId, code);
    if (!customer) {
      throw new NotFoundError(`Customer with code '${code.toUpperCase()}' not found`);
    }
    return customer;
  }

  /**
   * Updates customer master data while guarding immutable reference fields
   */
  public async updateCustomer(
    tenantId: string,
    id: string,
    dto: UpdateCustomerDto,
    actor?: ActorContext
  ): Promise<CustomerDocument> {
    const customer = await this.getCustomerById(tenantId, id);

    // Reference Integrity Guard: Customer Code cannot be changed once created
    if ((dto as any).customerCode && (dto as any).customerCode.toUpperCase() !== customer.customerCode) {
      throw new BadRequestError('Customer Code is immutable to maintain historical job and quality traceability');
    }

    const beforeState = customer.toJSON();

    const updated = await this.repo.updateById(tenantId, id, { $set: dto });
    if (!updated) {
      throw new NotFoundError(`Customer with ID '${id}' not found`);
    }

    const afterState = updated.toJSON();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CUSTOMER_UPDATED',
        entityType: 'Customer',
        entityId: updated.id,
        beforeState,
        afterState,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('CUSTOMER_UPDATED', tenantId, {
      customerId: updated.id,
      customerCode: updated.customerCode
    });

    return updated;
  }

  /**
   * Controlled status transition (active / inactive / archived) with active job validation
   */
  public async updateCustomerStatus(
    tenantId: string,
    id: string,
    status: 'active' | 'inactive' | 'archived',
    actor?: ActorContext
  ): Promise<CustomerDocument> {
    const customer = await this.getCustomerById(tenantId, id);

    if ((status === 'inactive' || status === 'archived') && customer.activeJobCount > 0) {
      throw new BadRequestError(
        `Cannot set customer [${customer.customerCode}] to '${status}': ${customer.activeJobCount} active jobs are currently in process.`
      );
    }

    const beforeStatus = customer.status;
    customer.status = status;
    const updated = await customer.save();

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CUSTOMER_STATUS_CHANGED',
        entityType: 'Customer',
        entityId: customer.id,
        beforeState: { status: beforeStatus },
        afterState: { status },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('CUSTOMER_STATUS_CHANGED', tenantId, {
      customerId: customer.id,
      customerCode: customer.customerCode,
      oldStatus: beforeStatus,
      newStatus: status
    });

    return updated;
  }

  /**
   * Archives a customer safely without breaking historical job/traceability records
   */
  public async archiveCustomer(tenantId: string, id: string, actor?: ActorContext): Promise<boolean> {
    const customer = await this.getCustomerById(tenantId, id);

    if (customer.activeJobCount > 0) {
      throw new BadRequestError(
        `Cannot archive customer [${customer.customerCode}]: Customer has ${customer.activeJobCount} active in-progress production jobs.`
      );
    }

    // Soft delete to protect historical CoCs and Job Cards
    await this.repo.updateById(tenantId, id, {
      $set: { status: 'archived', isDeleted: true }
    });

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'CUSTOMER_ARCHIVED',
        entityType: 'Customer',
        entityId: id,
        beforeState: { isDeleted: false, status: customer.status },
        afterState: { isDeleted: true, status: 'archived' },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('CUSTOMER_ARCHIVED', tenantId, {
      customerId: customer.id,
      customerCode: customer.customerCode
    });

    return true;
  }

  /**
   * Search and filter customer master records
   */
  public async searchCustomers(
    tenantId: string,
    filters: CustomerFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CustomerDocument>> {
    return this.repo.searchCustomers(tenantId, filters, pagination);
  }
}

export const customerService = new CustomerService();
