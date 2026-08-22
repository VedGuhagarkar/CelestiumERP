import mongoose from 'mongoose';
import { ProductionJobModel } from '../production-job/production-job.model.js';
import { QualityInspectionModel } from '../quality-inspection/quality-inspection.model.js';
import {
  NonConformanceReportModel,
  CorrectivePreventiveActionModel
} from '../ncr-capa/ncr-capa.model.js';
import { MachineModel } from '../machine/machine.model.js';
import { MaintenanceWorkOrderModel } from '../maintenance/maintenance.model.js';
import { AttendanceRecordModel, OvertimeRecordModel } from '../attendance/attendance.model.js';
import { InventoryBalanceModel } from '../inventory/inventory-balance.model.js';
import { ItemModel } from '../item/item.model.js';
import { WarehouseModel } from '../warehouse/warehouse.model.js';
import { QuarantineRecordModel } from '../quarantine/quarantine.model.js';
import { DispatchConsignmentModel } from '../dispatch/dispatch.model.js';
import { JobCost } from '../costing/costing.model.js';
import { Invoice } from '../billing/billing.model.js';
import { DateRangeFilter } from './reporting.types.js';

export interface IReportingRepository {
  getProductionJobs(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getQualityInspections(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getNcrs(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getCapas(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getMachines(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getMaintenanceWorkOrders(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getAttendanceRecords(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getOvertimeRecords(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getInventoryBalances(tenantId: string): Promise<any[]>;
  getItems(tenantId: string): Promise<any[]>;
  getWarehouses(tenantId: string): Promise<any[]>;
  getQuarantineRecords(tenantId: string): Promise<any[]>;
  getDispatches(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getJobCosts(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
  getInvoices(tenantId: string, filter: DateRangeFilter): Promise<any[]>;
}

export class ReportingRepository implements IReportingRepository {
  private buildDateFilter(filter: DateRangeFilter, dateField: string = 'createdAt'): Record<string, any> {
    const query: Record<string, any> = {};
    if (filter.startDate || filter.endDate) {
      query[dateField] = {};
      if (filter.startDate) query[dateField].$gte = new Date(filter.startDate);
      if (filter.endDate) query[dateField].$lte = new Date(filter.endDate);
    }
    return query;
  }

  public async getProductionJobs(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'createdAt')
    };

    if (filter.customerId) query['customer.customerId'] = filter.customerId;
    if (filter.itemId) query['item.itemId'] = filter.itemId;
    if (filter.furnaceId) query['execution.furnaceId'] = filter.furnaceId;

    return await ProductionJobModel.find(query).lean();
  }

  public async getQualityInspections(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'inspectionDate')
    };

    return await QualityInspectionModel.find(query).lean();
  }

  public async getNcrs(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'createdAt')
    };

    return await NonConformanceReportModel.find(query).lean();
  }

  public async getCapas(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'createdAt')
    };

    return await CorrectivePreventiveActionModel.find(query).lean();
  }

  public async getMachines(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true }
    };
    if (filter.furnaceId) query._id = filter.furnaceId;

    return await MachineModel.find(query).lean();
  }

  public async getMaintenanceWorkOrders(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'createdAt')
    };
    if (filter.furnaceId) query.machineId = filter.furnaceId;

    return await MaintenanceWorkOrderModel.find(query).lean();
  }

  public async getAttendanceRecords(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'date')
    };
    if (filter.department) query.department = filter.department;

    return await AttendanceRecordModel.find(query).lean();
  }

  public async getOvertimeRecords(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'date')
    };

    return await OvertimeRecordModel.find(query).lean();
  }

  public async getInventoryBalances(tenantId: string): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await InventoryBalanceModel.find({ tenantId, isDeleted: { $ne: true } }).lean();
  }

  public async getItems(tenantId: string): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await ItemModel.find({ tenantId, isDeleted: { $ne: true } }).lean();
  }

  public async getWarehouses(tenantId: string): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await WarehouseModel.find({ tenantId, isDeleted: { $ne: true } }).lean();
  }

  public async getQuarantineRecords(tenantId: string): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await QuarantineRecordModel.find({ tenantId, isDeleted: { $ne: true } }).lean();
  }

  public async getDispatches(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'createdAt')
    };
    if (filter.customerId) query['customer.customerId'] = filter.customerId;

    return await DispatchConsignmentModel.find(query).lean();
  }

  public async getJobCosts(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'calculatedAt')
    };

    return await JobCost.find(query).lean();
  }

  public async getInvoices(tenantId: string, filter: DateRangeFilter): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    const query: Record<string, any> = {
      tenantId,
      isDeleted: { $ne: true },
      ...this.buildDateFilter(filter, 'invoiceDate')
    };
    if (filter.customerId) query.customerId = filter.customerId;

    return await Invoice.find(query).lean();
  }
}

export const reportingRepository = new ReportingRepository();
