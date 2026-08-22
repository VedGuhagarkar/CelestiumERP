import { BaseService } from '../../core/services/base.service.js';
import { ITenantRepository, tenantRepository } from './tenant.repository.js';
import { CreateTenantDto, UpdateTenantDto, TenantDocument } from './tenant.types.js';
import { ConflictError, NotFoundError } from '../../core/errors/app-error.js';

export class TenantService extends BaseService {
  constructor(private readonly repo: ITenantRepository = tenantRepository) {
    super('TenantService');
  }

  /**
   * Provisions a new factory tenant with default heat-treatment settings
   */
  public async provisionTenant(dto: CreateTenantDto, actorId?: string): Promise<TenantDocument> {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictError(`Tenant code '${dto.code}' is already registered`);
    }

    const tenant = await this.repo.create(dto);
    this.logger.info(`✨ Successfully provisioned new tenant: [${tenant.code}] ${tenant.name}`);

    // Emit domain event for multi-service choreography
    this.publishEvent(
      'TENANT_PROVISIONED',
      tenant.code,
      {
        tenantId: tenant.code,
        tenantName: tenant.name,
        contactEmail: tenant.contactEmail,
        plan: tenant.subscriptionPlan
      },
      actorId
    );

    return tenant;
  }

  /**
   * Retrieves tenant by unique code
   */
  public async getTenantByCode(code: string): Promise<TenantDocument | null> {
    return this.repo.findByCode(code);
  }

  /**
   * Retrieves tenant by system ID
   */
  public async getTenantById(id: string): Promise<TenantDocument> {
    const tenant = await this.repo.findById(id);
    if (!tenant) {
      throw new NotFoundError(`Tenant with id '${id}' not found`);
    }
    return tenant;
  }

  /**
   * Suspends a tenant, immediately blocking all factory API traffic
   */
  public async suspendTenant(id: string, reason: string, actorId?: string): Promise<TenantDocument> {
    const updated = await this.repo.updateStatus(id, 'suspended');
    this.logger.warn(`🔒 Suspended tenant [${updated.code}]: ${reason}`);

    this.publishEvent(
      'TENANT_SUSPENDED',
      updated.code,
      { tenantId: updated.code, reason },
      actorId
    );

    return updated;
  }

  /**
   * Activates / un-suspends a tenant
   */
  public async activateTenant(id: string, actorId?: string): Promise<TenantDocument> {
    const updated = await this.repo.updateStatus(id, 'active');
    this.logger.info(`🔓 Activated tenant [${updated.code}]`);

    this.publishEvent(
      'TENANT_ACTIVATED',
      updated.code,
      { tenantId: updated.code },
      actorId
    );

    return updated;
  }

  /**
   * Updates tenant configuration and pyrometry parameters
   */
  public async updateTenant(id: string, dto: UpdateTenantDto): Promise<TenantDocument> {
    return this.repo.update(id, dto);
  }

  /**
   * Retrieves all registered tenants
   */
  public async getAllTenants(): Promise<TenantDocument[]> {
    return this.repo.findAll();
  }
}

export const tenantService = new TenantService();
