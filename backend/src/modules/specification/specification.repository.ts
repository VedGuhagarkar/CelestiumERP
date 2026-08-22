import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { SpecificationModel, SpecificationDocument } from './specification.model.js';
import { SpecificationFilterQuery } from './specification.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface ISpecificationRepository extends IBaseRepository<SpecificationDocument> {
  findByCodeAndRevision(
    tenantId: string,
    specCode: string,
    revision: number
  ): Promise<SpecificationDocument | null>;
  findLatestActiveRevision(tenantId: string, specCode: string): Promise<SpecificationDocument | null>;
  findHighestRevision(tenantId: string, specCode: string): Promise<SpecificationDocument | null>;
  searchSpecifications(
    tenantId: string,
    filters: SpecificationFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<SpecificationDocument>>;
  supersedePreviousRevisions(tenantId: string, specCode: string, currentRevision: number): Promise<void>;
  incrementJobCounters(tenantId: string, specId: string, delta: number): Promise<SpecificationDocument | null>;
}

export class SpecificationRepository
  extends BaseRepository<SpecificationDocument>
  implements ISpecificationRepository
{
  constructor() {
    super(SpecificationModel);
  }

  public async findByCodeAndRevision(
    tenantId: string,
    specCode: string,
    revision: number
  ): Promise<SpecificationDocument | null> {
    return this.findOne(tenantId, {
      specCode: specCode.toUpperCase(),
      revision
    });
  }

  public async findLatestActiveRevision(
    tenantId: string,
    specCode: string
  ): Promise<SpecificationDocument | null> {
    return this.findOne(
      tenantId,
      {
        specCode: specCode.toUpperCase(),
        status: 'ACTIVE'
      },
      undefined,
      { sort: { revision: -1 } }
    );
  }

  public async findHighestRevision(tenantId: string, specCode: string): Promise<SpecificationDocument | null> {
    return this.findOne(
      tenantId,
      { specCode: specCode.toUpperCase() },
      undefined,
      { sort: { revision: -1 } }
    );
  }

  public async searchSpecifications(
    tenantId: string,
    filters: SpecificationFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<SpecificationDocument>> {
    const query: Record<string, any> = {};

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { specCode: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { customerCode: searchRegex },
        { applicableMaterialGrades: searchRegex }
      ];
    }

    if (filters.customerId) {
      query.customerId = filters.customerId;
    }

    if (filters.customerCode) {
      query.customerCode = filters.customerCode.toUpperCase();
    }

    if (filters.processFamily) {
      query.processFamily = filters.processFamily;
    }

    if (filters.materialGrade) {
      query.applicableMaterialGrades = new RegExp(filters.materialGrade, 'i');
    }

    if (filters.status) {
      query.status = filters.status;
    }

    return this.findPaginated(tenantId, query, pagination);
  }

  public async supersedePreviousRevisions(
    tenantId: string,
    specCode: string,
    currentRevision: number
  ): Promise<void> {
    await this.model.updateMany(
      this.withTenant(tenantId, {
        specCode: specCode.toUpperCase(),
        revision: { $lt: currentRevision },
        status: { $in: ['APPROVED', 'ACTIVE'] }
      }),
      {
        $set: {
          status: 'SUPERSEDED',
          effectiveTo: new Date()
        }
      }
    );
  }

  public async incrementJobCounters(
    tenantId: string,
    specId: string,
    delta: number
  ): Promise<SpecificationDocument | null> {
    return this.updateById(tenantId, specId, {
      $inc: { referencedJobCount: delta }
    });
  }
}

export const specificationRepository = new SpecificationRepository();
