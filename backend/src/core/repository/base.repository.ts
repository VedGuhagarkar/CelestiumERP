import { Model, Document, FilterQuery, UpdateQuery, QueryOptions, ProjectionType } from 'mongoose';
import { NotFoundError } from '../errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../types/pagination.js';

export type { PaginationOptions, PaginatedResult };

export interface IBaseRepository<T extends Document> {
  create(tenantId: string, data: Partial<T>): Promise<T>;
  insertMany(tenantId: string, docs: Partial<T>[]): Promise<T[]>;
  findById(tenantId: string, id: string, projection?: ProjectionType<T>, options?: QueryOptions<T>): Promise<T | null>;
  findByIdOrThrow(tenantId: string, id: string, projection?: ProjectionType<T>, options?: QueryOptions<T>): Promise<T>;
  findOne(tenantId: string, filter?: FilterQuery<T>, projection?: ProjectionType<T>, options?: QueryOptions<T>): Promise<T | null>;
  find(tenantId: string, filter?: FilterQuery<T>, projection?: ProjectionType<T>, options?: QueryOptions<T>): Promise<T[]>;
  findPaginated(tenantId: string, filter?: FilterQuery<T>, pagination?: PaginationOptions): Promise<PaginatedResult<T>>;
  count(tenantId: string, filter?: FilterQuery<T>): Promise<number>;
  updateById(tenantId: string, id: string, update: UpdateQuery<T>, options?: QueryOptions<T>): Promise<T | null>;
  updateOne(tenantId: string, filter: FilterQuery<T>, update: UpdateQuery<T>, options?: QueryOptions<T>): Promise<T | null>;
  softDeleteById(tenantId: string, id: string, deletedBy?: string): Promise<T | null>;
  restoreById(tenantId: string, id: string): Promise<T | null>;
  exists(tenantId: string, filter: FilterQuery<T>): Promise<boolean>;
}

export abstract class BaseRepository<T extends Document> implements IBaseRepository<T> {
  protected constructor(protected readonly model: Model<T>) {}

  /**
   * Helper to merge tenant filter with provided filter query
   */
  protected withTenant(tenantId: string, filter: FilterQuery<T> = {}): FilterQuery<T> {
    return {
      ...filter,
      tenantId
    };
  }

  /**
   * Create a new document under the active tenant
   */
  async create(tenantId: string, data: Partial<T>): Promise<T> {
    const documentData = {
      ...data,
      tenantId
    };
    const created = new this.model(documentData);
    return (await created.save()) as T;
  }

  /**
   * Create multiple documents under active tenant in batch
   */
  async insertMany(tenantId: string, docs: Partial<T>[]): Promise<T[]> {
    const tenantDocs = docs.map((doc) => ({ ...doc, tenantId }));
    return (await this.model.insertMany(tenantDocs)) as unknown as T[];
  }

  /**
   * Find document by ID scoped to tenant
   */
  async findById(
    tenantId: string,
    id: string,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ): Promise<T | null> {
    return this.model.findOne(this.withTenant(tenantId, { _id: id } as FilterQuery<T>), projection, options).exec();
  }

  /**
   * Find document by ID or throw NotFoundError
   */
  async findByIdOrThrow(
    tenantId: string,
    id: string,
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ): Promise<T> {
    const doc = await this.findById(tenantId, id, projection, options);
    if (!doc) {
      throw new NotFoundError(`${this.model.modelName} with ID '${id}' not found`);
    }
    return doc;
  }

  /**
   * Find single document by query filter scoped to tenant
   */
  async findOne(
    tenantId: string,
    filter: FilterQuery<T> = {},
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ): Promise<T | null> {
    return this.model.findOne(this.withTenant(tenantId, filter), projection, options).exec();
  }

  /**
   * Find all documents matching filter scoped to tenant
   */
  async find(
    tenantId: string,
    filter: FilterQuery<T> = {},
    projection?: ProjectionType<T>,
    options?: QueryOptions<T>
  ): Promise<T[]> {
    return this.model.find(this.withTenant(tenantId, filter), projection, options).exec();
  }

  /**
   * Find paginated documents matching filter scoped to tenant
   */
  async findPaginated(
    tenantId: string,
    filter: FilterQuery<T> = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const scopedFilter = this.withTenant(tenantId, filter);

    const [items, total] = await Promise.all([
      this.model
        .find(scopedFilter)
        .sort(pagination.sort || { createdAt: -1 })
        .select(pagination.select || '')
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(scopedFilter).exec()
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  /**
   * Count documents matching filter scoped to tenant
   */
  async count(tenantId: string, filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(this.withTenant(tenantId, filter)).exec();
  }

  /**
   * Update a document by ID scoped to tenant
   */
  async updateById(
    tenantId: string,
    id: string,
    update: UpdateQuery<T>,
    options: QueryOptions<T> = { new: true }
  ): Promise<T | null> {
    return this.model
      .findOneAndUpdate(this.withTenant(tenantId, { _id: id } as FilterQuery<T>), update, { ...options, new: true })
      .exec();
  }

  /**
   * Update one document by filter scoped to tenant
   */
  async updateOne(
    tenantId: string,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    options: QueryOptions<T> = { new: true }
  ): Promise<T | null> {
    return this.model.findOneAndUpdate(this.withTenant(tenantId, filter), update, { ...options, new: true }).exec();
  }

  /**
   * Soft delete a document by ID scoped to tenant
   */
  async softDeleteById(tenantId: string, id: string, deletedBy?: string): Promise<T | null> {
    return this.model
      .findOneAndUpdate(
        this.withTenant(tenantId, { _id: id } as FilterQuery<T>),
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: deletedBy || null
          }
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Restore a soft-deleted document by ID scoped to tenant
   */
  async restoreById(tenantId: string, id: string): Promise<T | null> {
    return this.model
      .findOneAndUpdate(
        this.withTenant(tenantId, { _id: id, isDeleted: true } as FilterQuery<T>),
        {
          $set: {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          }
        },
        { new: true }
      )
      .exec();
  }

  /**
   * Check if a document exists matching filter scoped to tenant
   */
  async exists(tenantId: string, filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.model.countDocuments(this.withTenant(tenantId, filter)).limit(1).exec();
    return count > 0;
  }
}
