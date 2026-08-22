import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { reportingService, ReportingService } from './reporting.service.js';

export class ReportingController extends BaseController {
  constructor(private readonly service: ReportingService = reportingService) {
    super();
  }

  public getExecutiveDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getExecutiveDashboard(tenantId, req.query as any);
      this.sendSuccess(res, result, 'Executive Operational Dashboard generated');
    } catch (error) {
      next(error);
    }
  };

  public getThroughputReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getThroughputReport(tenantId, req.query as any);

      if (req.query.format === 'csv') {
        const headers = ['Furnace Code', 'Total Jobs', 'Completed Jobs', 'Pieces', 'Weight Kg', 'Operating Hours', 'Throughput Kg/Hr'];
        const rows = result.items.map((i) => [
          i.furnaceCode || '',
          i.totalJobs,
          i.completedJobs,
          i.totalQuantityPieces,
          i.totalWeightKg,
          i.totalOperatingHours,
          i.throughputRateKgPerHour
        ]);
        const csv = this.service.formatToCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="production-throughput-report.csv"');
        res.status(200).send(csv);
        return;
      }

      this.sendSuccess(res, result, 'Production Throughput Report generated');
    } catch (error) {
      next(error);
    }
  };

  public getCycleTimeReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getCycleTimeReport(tenantId, req.query as any);

      if (req.query.format === 'csv') {
        const headers = ['Job Number', 'Recipe', 'Item', 'Furnace', 'Planned Hours', 'Actual Hours', 'Variance Hours', 'Variance %', 'Status'];
        const rows = result.items.map((i) => [
          i.jobNumber,
          i.recipeCode,
          i.itemCode,
          i.furnaceCode,
          i.plannedCycleTimeHours,
          i.actualCycleTimeHours,
          i.varianceHours,
          i.variancePercent,
          i.status
        ]);
        const csv = this.service.formatToCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="cycle-time-report.csv"');
        res.status(200).send(csv);
        return;
      }

      this.sendSuccess(res, result, 'Cycle-Time Analysis Report generated');
    } catch (error) {
      next(error);
    }
  };

  public getOeeDowntimeReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getOeeDowntimeReport(tenantId, req.query as any);

      if (req.query.format === 'csv') {
        const headers = [
          'Machine Code',
          'Name',
          'Bay',
          'Availability %',
          'Performance %',
          'Quality %',
          'OEE %',
          'Operating Hrs',
          'Unplanned Downtime Hrs',
          'Breakdowns',
          'MTTR Hrs',
          'MTBF Hrs'
        ];
        const rows = result.machines.map((m) => [
          m.machineCode,
          m.name,
          m.bay,
          m.availabilityPercent,
          m.performancePercent,
          m.qualityPercent,
          m.oeePercent,
          m.operatingHours,
          m.unplannedDowntimeHours,
          m.breakdownCount,
          m.mttrHours,
          m.mtbfHours
        ]);
        const csv = this.service.formatToCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="equipment-oee-downtime-report.csv"');
        res.status(200).send(csv);
        return;
      }

      this.sendSuccess(res, result, 'Equipment OEE, Utilization & Downtime Report generated');
    } catch (error) {
      next(error);
    }
  };

  public getQualityAnalyticsReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getQualityAnalyticsReport(tenantId, req.query as any);

      if (req.query.format === 'csv') {
        const headers = ['Defect Category', 'Occurrences', 'Affected Pieces', 'Percentage %'];
        const rows = result.defectsByCategory.map((d) => [
          d.defectCategory,
          d.occurrencesCount,
          d.affectedPiecesCount,
          d.percentage
        ]);
        const csv = this.service.formatToCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="quality-analytics-fpy-report.csv"');
        res.status(200).send(csv);
        return;
      }

      this.sendSuccess(res, result, 'Quality Analytics, FPY & Defect Report generated');
    } catch (error) {
      next(error);
    }
  };

  public getWorkforceAttendanceReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getWorkforceAttendanceReport(tenantId, req.query as any);

      if (req.query.format === 'csv') {
        const headers = ['Department', 'Rostered Employees', 'Present', 'Absent', 'On Leave', 'Attendance %', 'Regular Hrs', 'Overtime Hrs', 'Overtime %'];
        const rows = result.departmentBreakdown.map((d) => [
          d.department,
          d.totalRosteredEmployees,
          d.presentCount,
          d.absentCount,
          d.onLeaveCount,
          d.attendanceRatePercent,
          d.regularHoursWorked,
          d.overtimeHoursWorked,
          d.overtimeRatePercent
        ]);
        const csv = this.service.formatToCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="workforce-attendance-overtime-report.csv"');
        res.status(200).send(csv);
        return;
      }

      this.sendSuccess(res, result, 'Workforce Attendance & Overtime Report generated');
    } catch (error) {
      next(error);
    }
  };

  public getInventoryWarehouseReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getInventoryWarehouseReport(tenantId);

      if (req.query.format === 'csv') {
        const headers = ['Item Code', 'Item Name', 'Material Grade', 'Current Stock', 'UOM', 'Unit Cost', 'Total Valuation', 'Safety Stock', 'Shortage?'];
        const rows = result.shortageAlerts.map((i) => [
          i.itemCode,
          i.itemName,
          i.materialGrade,
          i.currentStockQuantity,
          i.uom,
          i.standardUnitCost,
          i.totalValuationAmount,
          i.safetyStockThreshold,
          i.isShortage ? 'YES' : 'NO'
        ]);
        const csv = this.service.formatToCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-valuation-shortage-report.csv"');
        res.status(200).send(csv);
        return;
      }

      this.sendSuccess(res, result, 'Inventory Valuation & Warehouse Occupancy Report generated');
    } catch (error) {
      next(error);
    }
  };

  public getDispatchReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getDispatchReport(tenantId, req.query as any);

      if (req.query.format === 'csv') {
        const headers = ['Dispatch Number', 'Customer', 'Status', 'Quantity', 'Weight Kg', 'Carrier', 'Transport Mode', 'On-Time?'];
        const rows = result.dispatches.map((d) => [
          d.dispatchNumber,
          d.customerCode,
          d.status,
          d.totalQuantity,
          d.totalWeightKg || 0,
          d.carrierName || '',
          d.transportMode,
          d.isOnTime ? 'YES' : 'NO'
        ]);
        const csv = this.service.formatToCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="dispatch-delivery-report.csv"');
        res.status(200).send(csv);
        return;
      }

      this.sendSuccess(res, result, 'Dispatch & OTIF Delivery Report generated');
    } catch (error) {
      next(error);
    }
  };

  public getJobCostProfitabilityReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getJobCostProfitabilityReport(tenantId, req.query as any);

      if (req.query.format === 'csv') {
        const headers = [
          'Job Number',
          'Customer',
          'Item Code',
          'Recipe',
          'Actual Cost',
          'Standard Cost',
          'Variance',
          'Revenue',
          'Gross Profit',
          'Margin %',
          'Status'
        ];
        const rows = result.jobs.map((j) => [
          j.jobNumber,
          j.customerCode,
          j.itemCode,
          j.recipeCode,
          j.totalActualCost,
          j.totalStandardCost,
          j.varianceAmount,
          j.invoicedRevenue,
          j.grossProfitAmount,
          j.grossProfitMarginPercent,
          j.profitabilityStatus
        ]);
        const csv = this.service.formatToCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="job-costing-profitability-report.csv"');
        res.status(200).send(csv);
        return;
      }

      this.sendSuccess(res, result, 'Job Costing & Profitability Analysis Report generated');
    } catch (error) {
      next(error);
    }
  };
}

export const reportingController = new ReportingController();
