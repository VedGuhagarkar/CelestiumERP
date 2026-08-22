import mongoose from 'mongoose';
import { ProductionJobModel } from '../production-job/production-job.model.js';
import { CustomerModel } from '../customer/customer.model.js';
import { UserModel } from '../auth/user.model.js';
import { ItemModel } from '../item/item.model.js';
import { HeatLotModel } from '../traceability/heat-lot.model.js';
import { MachineModel } from '../machine/machine.model.js';
import { QualityInspectionModel } from '../quality-inspection/quality-inspection.model.js';
import { NonConformanceReportModel } from '../ncr-capa/ncr-capa.model.js';
import { WarehouseModel } from '../warehouse/warehouse.model.js';
import { DispatchConsignmentModel } from '../dispatch/dispatch.model.js';
import { Invoice } from '../billing/billing.model.js';

export interface ISearchRepository {
  searchJobs(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchCustomers(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchEmployees(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchMaterials(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchHeatLots(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchMachines(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchInspections(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchNcrs(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchWarehouses(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchDispatches(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
  searchInvoices(tenantId: string, regex: RegExp, limit: number): Promise<any[]>;
}

export class SearchRepository implements ISearchRepository {
  public async searchJobs(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await ProductionJobModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [
        { jobNumber: regex },
        { 'customer.customerName': regex },
        { 'item.itemCode': regex },
        { 'recipe.recipeCode': regex },
        { 'heatLot.heatLotNumber': regex }
      ]
    })
      .limit(limit)
      .lean();
  }

  public async searchCustomers(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await CustomerModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [{ customerCode: regex }, { name: regex }, { email: regex }, { contactPerson: regex }]
    })
      .limit(limit)
      .lean();
  }

  public async searchEmployees(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await UserModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [
        { username: regex },
        { firstName: regex },
        { lastName: regex },
        { email: regex }
      ]
    })
      .limit(limit)
      .lean();
  }

  public async searchMaterials(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await ItemModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [{ itemCode: regex }, { name: regex }, { description: regex }, { materialGrade: regex }]
    })
      .limit(limit)
      .lean();
  }

  public async searchHeatLots(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await HeatLotModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [{ heatLotNumber: regex }, { supplierHeatNumber: regex }, { materialGrade: regex }]
    })
      .limit(limit)
      .lean();
  }

  public async searchMachines(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await MachineModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [
        { machineCode: regex },
        { name: regex },
        { type: regex },
        { serialNumber: regex },
        { 'location.bay': regex }
      ]
    })
      .limit(limit)
      .lean();
  }

  public async searchInspections(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await QualityInspectionModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [{ inspectionNumber: regex }, { jobNumber: regex }, { heatLotNumber: regex }]
    })
      .limit(limit)
      .lean();
  }

  public async searchNcrs(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await NonConformanceReportModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [{ ncrNumber: regex }, { title: regex }, { jobNumber: regex }, { defectCategory: regex }]
    })
      .limit(limit)
      .lean();
  }

  public async searchWarehouses(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await WarehouseModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [{ code: regex }, { name: regex }, { type: regex }]
    })
      .limit(limit)
      .lean();
  }

  public async searchDispatches(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await DispatchConsignmentModel.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [
        { dispatchNumber: regex },
        { 'customer.customerName': regex },
        { 'carrier.carrierName': regex },
        { 'carrier.vehicleNumber': regex }
      ]
    })
      .limit(limit)
      .lean();
  }

  public async searchInvoices(tenantId: string, regex: RegExp, limit: number): Promise<any[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await Invoice.find({
      tenantId,
      isDeleted: { $ne: true },
      $or: [{ invoiceNumber: regex }, { customerCode: regex }]
    })
      .limit(limit)
      .lean();
  }
}

export const searchRepository = new SearchRepository();
