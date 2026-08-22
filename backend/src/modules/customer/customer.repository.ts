import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { CustomerModel, CustomerDocument } from './customer.model.js';
import { CustomerFilterQuery } from './customer.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface ICustomerRepository extends IBaseRepository<CustomerDocument> {
  findByCode(tenantId: string, customerCode: string): Promise<CustomerDocument | null>;
  searchCustomers(
    tenantId: string,
    filters: CustomerFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CustomerDocument>>;
  incrementJobCounters(
    tenantId: string,
    customerId: string,
    deltaActive: number,
    deltaTotal: number
  ): Promise<CustomerDocument | null>;
}

export class CustomerRepository extends BaseRepository<CustomerDocument> implements ICustomerRepository {
  constructor() {
    super(CustomerModel);
  }

  public async findByCode(tenantId: string, customerCode: string): Promise<CustomerDocument | null> {
    return this.findOne(tenantId, { customerCode: customerCode.toUpperCase() });
  }

  public async searchCustomers(
    tenantId: string,
    filters: CustomerFilterQuery,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<CustomerDocument>> {
    const query: Record<string, any> = {};

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { customerCode: searchRegex },
        { companyName: searchRegex },
        { tradeName: searchRegex },
        { 'contacts.name': searchRegex },
        { 'contacts.email': searchRegex }
      ];
    }

    if (filters.industrySegment) {
      query.industrySegment = filters.industrySegment;
    }

    if (filters.qualityStatus) {
      query.qualityStatus = filters.qualityStatus;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.hasActiveJobs === true) {
      query.activeJobCount = { $gt: 0 };
    }

    return this.findPaginated(tenantId, query, pagination);
  }

  public async incrementJobCounters(
    tenantId: string,
    customerId: string,
    deltaActive: number,
    deltaTotal: number
  ): Promise<CustomerDocument | null> {
    return this.updateById(tenantId, customerId, {
      $inc: {
        activeJobCount: deltaActive,
        totalJobCount: deltaTotal
      }
    });
  }
}

export const customerRepository = new CustomerRepository();
