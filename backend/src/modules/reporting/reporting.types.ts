export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
  periodCode?: string;
  furnaceId?: string;
  customerId?: string;
  itemId?: string;
  department?: string;
  format?: 'json' | 'csv' | 'xlsx' | 'pdf';
}

// ==========================================
// 1. Executive Operational Dashboard
// ==========================================

export interface IExecutiveDashboardKPIs {
  period: {
    startDate: Date;
    endDate: Date;
  };
  operational: {
    totalProductionJobs: number;
    activeJobsCount: number;
    completedJobsCount: number;
    totalDispatchedLots: number;
    onTimeDeliveryPercent: number; // OTIF %
    totalThroughputKg: number;
    totalPartsProcessed: number;
  };
  quality: {
    firstPassYieldPercent: number; // FPY %
    totalInspectionsCount: number;
    passedInspectionsCount: number;
    failedInspectionsCount: number;
    openNcrCount: number;
    openCapaCount: number;
    overallRejectionRatePercent: number;
  };
  equipment: {
    averageOeePercent: number; // Overall Equipment Effectiveness
    averageAvailabilityPercent: number;
    averagePerformancePercent: number;
    averageQualityPercent: number;
    averageFurnaceUtilizationPercent: number;
    totalDowntimeHours: number;
    unplannedDowntimeHours: number;
    mttrHours: number; // Mean Time To Repair
    mtbfHours: number; // Mean Time Between Failures
  };
  workforce: {
    averageAttendancePercent: number;
    totalStandardHours: number;
    totalOvertimeHours: number;
    activeWorkforceCount: number;
  };
  financial: {
    totalInvoicedRevenue: number;
    totalManufacturingCost: number;
    grossProfitMarginPercent: number;
    totalOutstandingReceivables: number;
    inventoryValuationAmount: number;
  };
}

// ==========================================
// 2. Production & Throughput Reports
// ==========================================

export interface IThroughputReportItem {
  periodGroup: string; // e.g. "2026-08-20" or "W34" or furnaceId
  furnaceId?: string;
  furnaceCode?: string;
  totalJobs: number;
  completedJobs: number;
  totalQuantityPieces: number;
  totalWeightKg: number;
  totalOperatingHours: number;
  throughputRateKgPerHour: number;
}

export interface IProductionThroughputReport {
  generatedAt: Date;
  filter: DateRangeFilter;
  summary: {
    totalJobsCount: number;
    totalCompletedPieces: number;
    totalWeightKg: number;
    averageThroughputKgPerHour: number;
  };
  items: IThroughputReportItem[];
}

export interface ICycleTimeStageBreakdown {
  stageName: string;
  standardDurationHours: number;
  actualDurationHours: number;
  varianceHours: number;
}

export interface ICycleTimeReportItem {
  jobId: string;
  jobNumber: string;
  recipeCode: string;
  itemCode: string;
  furnaceCode: string;
  plannedCycleTimeHours: number;
  actualCycleTimeHours: number;
  varianceHours: number;
  variancePercent: number;
  status: 'FASTER_THAN_STANDARD' | 'ON_TARGET' | 'DELAYED_CYCLE';
  stages: ICycleTimeStageBreakdown[];
}

export interface ICycleTimeReport {
  generatedAt: Date;
  filter: DateRangeFilter;
  summary: {
    totalJobsAnalyzed: number;
    averagePlannedCycleTimeHours: number;
    averageActualCycleTimeHours: number;
    averageVarianceHours: number;
    delayedJobsCount: number;
  };
  items: ICycleTimeReportItem[];
}

// ==========================================
// 3. Equipment, OEE, Downtime, MTTR & MTBF Reports
// ==========================================

export interface IMachineOeeReportItem {
  machineId: string;
  machineCode: string;
  name: string;
  bay: string;
  plannedProductionHours: number;
  operatingHours: number;
  unplannedDowntimeHours: number;
  plannedMaintenanceHours: number;
  totalPartsProduced: number;
  goodPartsProduced: number;
  standardCycleTimeHours: number;
  availabilityPercent: number; // Operating / Planned
  performancePercent: number; // (TotalParts * StandardCycle) / Operating
  qualityPercent: number; // GoodParts / TotalParts
  oeePercent: number; // Availability * Performance * Quality
  utilizationPercent: number;
  breakdownCount: number;
  mttrHours: number; // UnplannedDowntime / BreakdownCount
  mtbfHours: number; // OperatingHours / BreakdownCount
}

export interface IOeeDowntimeReport {
  generatedAt: Date;
  filter: DateRangeFilter;
  summary: {
    totalMachinesCount: number;
    plantAverageOeePercent: number;
    plantAverageAvailabilityPercent: number;
    plantAveragePerformancePercent: number;
    plantAverageQualityPercent: number;
    plantAverageUtilizationPercent: number;
    totalDowntimeHours: number;
    unplannedDowntimeHours: number;
    totalBreakdownsCount: number;
    overallMttrHours: number;
    overallMtbfHours: number;
  };
  downtimeBreakdownByCategory: {
    category: string;
    downtimeHours: number;
    percentageOfTotalDowntime: number;
    incidentCount: number;
  }[];
  machines: IMachineOeeReportItem[];
}

// ==========================================
// 4. Quality, FPY, Defect & NCR Reports
// ==========================================

export interface IQualityFpyReportItem {
  periodOrItem: string;
  totalInitialInspections: number;
  passedFirstAttempt: number;
  firstPassYieldPercent: number; // (PassedFirst / TotalInitial) * 100
  reworkedCount: number;
  scrappedCount: number;
  rejectionRatePercent: number;
}

export interface IDefectNcrReportItem {
  ncrNumber: string;
  title: string;
  severity: string;
  status: string;
  sourceType: string;
  jobNumber?: string;
  heatLotNumber?: string;
  defectCategory: string;
  quarantinedQuantity: number;
  scrappedQuantity: number;
  reworkedQuantity: number;
  rootCauseAnalysis?: string;
  resolutionTimeHours?: number;
  capaRequired: boolean;
  capaNumber?: string;
}

export interface IQualityAnalyticsReport {
  generatedAt: Date;
  filter: DateRangeFilter;
  summary: {
    overallFpyPercent: number;
    totalInspections: number;
    totalConforming: number;
    totalNonConforming: number;
    totalScrappedQuantity: number;
    openNcrCount: number;
    closedNcrCount: number;
    averageNcrResolutionTimeHours: number;
  };
  fpyBreakdown: IQualityFpyReportItem[];
  defectsByCategory: {
    defectCategory: string;
    occurrencesCount: number;
    affectedPiecesCount: number;
    percentage: number;
  }[];
  recentNcrs: IDefectNcrReportItem[];
}

// ==========================================
// 5. Workforce Attendance & Overtime Reports
// ==========================================

export interface IWorkforceAttendanceReportItem {
  department: string;
  totalRosteredEmployees: number;
  presentCount: number;
  absentCount: number;
  onLeaveCount: number;
  attendanceRatePercent: number;
  regularHoursWorked: number;
  overtimeHoursWorked: number;
  overtimeRatePercent: number;
}

export interface IWorkforceAttendanceReport {
  generatedAt: Date;
  filter: DateRangeFilter;
  summary: {
    totalEmployeesCount: number;
    averageAttendancePercent: number;
    totalRegularHours: number;
    totalOvertimeHours: number;
    overallOvertimePercent: number;
  };
  departmentBreakdown: IWorkforceAttendanceReportItem[];
  topOvertimeEmployees: {
    employeeId: string;
    employeeName: string;
    department: string;
    overtimeHours: number;
  }[];
}

// ==========================================
// 6. Inventory Valuation, Shortages & Warehouse Occupancy
// ==========================================

export interface IInventoryValuationReportItem {
  itemCode: string;
  itemName: string;
  materialGrade: string;
  category: string;
  currentStockQuantity: number;
  uom: string;
  standardUnitCost: number;
  totalValuationAmount: number;
  safetyStockThreshold: number;
  isShortage: boolean;
  shortageQuantity: number;
}

export interface IWarehouseOccupancyReportItem {
  warehouseId: string;
  warehouseCode: string;
  name: string;
  warehouseType: string;
  totalCapacityBins: number;
  occupiedBins: number;
  occupancyPercent: number;
  quarantineStockQuantity: number;
  status: 'NORMAL' | 'HIGH_CAPACITY' | 'CRITICAL_OVERFLOW';
}

export interface IInventoryWarehouseReport {
  generatedAt: Date;
  summary: {
    totalActiveItems: number;
    totalInventoryValuation: number;
    criticalShortagesCount: number;
    totalWarehouseCapacityBins: number;
    totalOccupiedBins: number;
    overallWarehouseOccupancyPercent: number;
    totalQuarantinedStockUnits: number;
  };
  valuationByGrade: {
    materialGrade: string;
    totalQuantity: number;
    totalValuation: number;
  }[];
  shortageAlerts: IInventoryValuationReportItem[];
  warehouseOccupancies: IWarehouseOccupancyReportItem[];
}

// ==========================================
// 7. Dispatch & Delivery (OTIF) Report
// ==========================================

export interface IDispatchReportItem {
  dispatchNumber: string;
  customerCode: string;
  customerName: string;
  status: string;
  dispatchedAt?: Date;
  deliveredAt?: Date;
  scheduledDepartureTime?: Date;
  estimatedArrivalTime?: Date;
  totalQuantity: number;
  totalWeightKg?: number;
  carrierName?: string;
  transportMode: string;
  isOnTime: boolean;
  receivedCondition?: string;
}

export interface IDispatchReport {
  generatedAt: Date;
  filter: DateRangeFilter;
  summary: {
    totalDispatchesCount: number;
    deliveredCount: number;
    inTransitCount: number;
    onTimeDispatchPercent: number;
    onTimeInFullDeliveryPercent: number; // OTIF %
    totalWeightDispatchedKg: number;
  };
  dispatches: IDispatchReportItem[];
}

// ==========================================
// 8. Job Costing & Profitability Report
// ==========================================

export interface IJobCostProfitabilityReportItem {
  jobId: string;
  jobNumber: string;
  customerCode: string;
  itemCode: string;
  recipeCode: string;
  completedQuantity: number;
  totalActualCost: number;
  totalStandardCost: number;
  varianceAmount: number;
  invoicedRevenue: number;
  grossProfitAmount: number;
  grossProfitMarginPercent: number;
  costBreakdown: {
    materialCost: number;
    laborCost: number;
    energyCost: number;
    machineCost: number;
    overheadCost: number;
  };
  profitabilityStatus: 'HIGH_MARGIN' | 'STANDARD_MARGIN' | 'LOW_MARGIN' | 'NEGATIVE_LOSS' | 'UNBILLED';
}

export interface IJobCostProfitabilityReport {
  generatedAt: Date;
  filter: DateRangeFilter;
  summary: {
    totalJobsAnalyzed: number;
    totalInvoicedRevenue: number;
    totalManufacturingCost: number;
    totalGrossProfit: number;
    overallGrossMarginPercent: number;
    lossMakingJobsCount: number;
  };
  jobs: IJobCostProfitabilityReportItem[];
}
