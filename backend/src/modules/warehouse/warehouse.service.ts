import { BaseService } from '../../core/services/base.service.js';
import { IWarehouseRepository, warehouseRepository } from './warehouse.repository.js';
import { auditService, AuditService } from '../audit/audit.service.js';
import {
  WarehouseDocument,
  StorageLocationDocument,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  CreateStorageLocationDto,
  UpdateStorageLocationDto,
  WarehouseFilterQuery,
  StorageLocationFilterQuery
} from './warehouse.types.js';
import { ActorContext } from '../customer/customer.service.js';
import { ConflictError, NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export class WarehouseService extends BaseService {
  constructor(
    private readonly repo: IWarehouseRepository = warehouseRepository,
    private readonly audit: AuditService = auditService
  ) {
    super('WarehouseService');
  }

  /**
   * Creates a new Warehouse / Plant Area
   */
  public async createWarehouse(
    tenantId: string,
    dto: CreateWarehouseDto,
    actor?: ActorContext
  ): Promise<WarehouseDocument> {
    const existing = await this.repo.findWarehouseByCode(tenantId, dto.code);
    if (existing) {
      throw new ConflictError(`Warehouse with code '${dto.code}' already exists`);
    }

    const warehouse = await this.repo.createWarehouse(tenantId, dto);

    this.logger.info(`🏭 Warehouse created: [${warehouse.code}] ${warehouse.name} (${warehouse.type})`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'WAREHOUSE_CREATED',
        entityType: 'Warehouse',
        entityId: warehouse.id,
        afterState: warehouse.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('WAREHOUSE_CREATED', tenantId, {
      warehouseId: warehouse.id,
      code: warehouse.code,
      name: warehouse.name
    });

    return warehouse;
  }

  /**
   * Retrieves warehouse by ID
   */
  public async getWarehouseById(tenantId: string, id: string): Promise<WarehouseDocument> {
    const warehouse = await this.repo.findWarehouseById(tenantId, id);
    if (!warehouse) {
      throw new NotFoundError(`Warehouse with ID '${id}' not found`);
    }
    return warehouse;
  }

  /**
   * Updates warehouse details
   */
  public async updateWarehouse(
    tenantId: string,
    id: string,
    dto: UpdateWarehouseDto,
    actor?: ActorContext
  ): Promise<WarehouseDocument> {
    const warehouse = await this.getWarehouseById(tenantId, id);
    const beforeState = warehouse.toJSON();

    const updated = await this.repo.updateWarehouse(tenantId, id, dto);
    if (!updated) {
      throw new NotFoundError(`Warehouse with ID '${id}' not found`);
    }

    this.logger.info(`🏭 Warehouse updated: [${updated.code}]`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'WAREHOUSE_UPDATED',
        entityType: 'Warehouse',
        entityId: updated.id,
        beforeState,
        afterState: updated.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('WAREHOUSE_UPDATED', tenantId, {
      warehouseId: updated.id,
      code: updated.code
    });

    return updated;
  }

  /**
   * Search warehouses
   */
  public async searchWarehouses(
    tenantId: string,
    filters: WarehouseFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<WarehouseDocument>> {
    return this.repo.searchWarehouses(tenantId, filters, pagination);
  }

  /**
   * Creates a new physical storage location (zone, bay, rack, bin, tank)
   */
  public async createStorageLocation(
    tenantId: string,
    dto: CreateStorageLocationDto,
    actor?: ActorContext
  ): Promise<StorageLocationDocument> {
    const warehouse = await this.getWarehouseById(tenantId, dto.warehouseId);

    const existing = await this.repo.findLocationByCode(tenantId, dto.locationCode);
    if (existing) {
      throw new ConflictError(`Storage location with code '${dto.locationCode}' already exists`);
    }

    const location = await this.repo.createLocation(tenantId, {
      ...dto,
      warehouseCode: warehouse.code
    });

    this.logger.info(
      `📍 Storage Location created: [${location.locationCode}] in Warehouse [${warehouse.code}] Zone: [${location.zone}]`
    );

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'STORAGE_LOCATION_CREATED',
        entityType: 'StorageLocation',
        entityId: location.id,
        afterState: location.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('STORAGE_LOCATION_CREATED', tenantId, {
      locationId: location.id,
      locationCode: location.locationCode,
      warehouseCode: warehouse.code
    });

    return location;
  }

  /**
   * Retrieves storage location by ID
   */
  public async getLocationById(tenantId: string, id: string): Promise<StorageLocationDocument> {
    const location = await this.repo.findLocationById(tenantId, id);
    if (!location) {
      throw new NotFoundError(`Storage location with ID '${id}' not found`);
    }
    return location;
  }

  /**
   * Retrieves storage location by code
   */
  public async getLocationByCode(tenantId: string, locationCode: string): Promise<StorageLocationDocument> {
    const location = await this.repo.findLocationByCode(tenantId, locationCode);
    if (!location) {
      throw new NotFoundError(`Storage location with code '${locationCode}' not found`);
    }
    return location;
  }

  /**
   * Validates location existence and active status before stock movement
   */
  public async validateLocationForStockMovement(
    tenantId: string,
    locationCode: string
  ): Promise<StorageLocationDocument> {
    const location = await this.getLocationByCode(tenantId, locationCode);
    if (location.status !== 'ACTIVE') {
      throw new BadRequestError(
        `Storage location [${locationCode}] is currently ${location.status} and cannot accept stock movements`
      );
    }
    return location;
  }

  /**
   * Updates storage location details or status
   */
  public async updateStorageLocation(
    tenantId: string,
    id: string,
    dto: UpdateStorageLocationDto,
    actor?: ActorContext
  ): Promise<StorageLocationDocument> {
    const location = await this.getLocationById(tenantId, id);
    const beforeState = location.toJSON();

    const updated = await this.repo.updateLocation(tenantId, id, dto);
    if (!updated) {
      throw new NotFoundError(`Storage location with ID '${id}' not found`);
    }

    this.logger.info(`📍 Storage Location updated: [${updated.locationCode}]`);

    if (actor) {
      await this.audit.record(tenantId, {
        actorId: actor.userId,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'STORAGE_LOCATION_UPDATED',
        entityType: 'StorageLocation',
        entityId: updated.id,
        beforeState,
        afterState: updated.toJSON(),
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        correlationId: actor.correlationId
      });
    }

    this.publishEvent('STORAGE_LOCATION_UPDATED', tenantId, {
      locationId: updated.id,
      locationCode: updated.locationCode
    });

    return updated;
  }

  /**
   * Search storage locations
   */
  public async searchLocations(
    tenantId: string,
    filters: StorageLocationFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<StorageLocationDocument>> {
    return this.repo.searchLocations(tenantId, filters, pagination);
  }

  /**
   * Retrieves all locations belonging to a specific warehouse
   */
  public async getLocationsByWarehouse(
    tenantId: string,
    warehouseId: string
  ): Promise<StorageLocationDocument[]> {
    await this.getWarehouseById(tenantId, warehouseId);
    return this.repo.findLocationsByWarehouse(tenantId, warehouseId);
  }
}

export const warehouseService = new WarehouseService();
