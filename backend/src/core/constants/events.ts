/**
 * Astralis ERP Domain Event Registry
 * Reference: CelestiumERP.md Section 1.2
 */

export const DomainEvents = {
  // Job Lifecycle Events
  JOB_CREATED: 'Job.Created',
  JOB_SCHEDULED: 'Job.Scheduled',
  JOB_STARTED: 'Job.Started',
  JOB_PAUSED: 'Job.Paused',
  JOB_RESUMED: 'Job.Resumed',
  JOB_DOWNTIME_LOGGED: 'Job.DowntimeLogged',
  JOB_COMPLETED: 'Job.Completed',
  JOB_CANCELLED: 'Job.Cancelled',
  JOB_DISPATCH_STAGED: 'Job.DispatchStaged',

  // Quality Lifecycle Events
  QC_INSPECTION_CREATED: 'QualityInspection.Created',
  QC_INSPECTION_STARTED: 'QualityInspection.Started',
  QC_MEASUREMENTS_RECORDED: 'QualityInspection.MeasurementsRecorded',
  QC_DEFECT_LOGGED: 'QualityInspection.DefectLogged',
  QC_APPROVED: 'QualityInspection.Approved',
  QC_REJECTED: 'QualityInspection.Rejected',
  QC_REINSPECTION_REQUESTED: 'QualityInspection.ReinspectionRequested',
  QC_NCR_RAISED: 'QualityInspection.NcrRaised',
  QC_CAPA_UPDATED: 'QualityInspection.CapaUpdated',
  QUALITY_PLAN_APPROVED: 'QualityPlan.Approved',

  // Machine & Pyrometry Events
  MACHINE_REGISTERED: 'Machine.Registered',
  MACHINE_STATUS_CHANGED: 'Machine.StatusChanged',
  MACHINE_BREAKDOWN_REPORTED: 'Machine.BreakdownReported',
  MACHINE_BREAKDOWN_RESOLVED: 'Machine.BreakdownResolved',
  MACHINE_CALIBRATION_LOGGED: 'Machine.CalibrationLogged',
  MACHINE_MAINTENANCE_TRIGGERED: 'Machine.MaintenanceTriggered',
  MACHINE_MAINTENANCE_COMPLETED: 'Machine.MaintenanceCompleted',

  // Inventory & Heat Lot Events
  INVENTORY_ITEM_CREATED: 'Inventory.ItemCreated',
  INVENTORY_GOODS_RECEIVED: 'Inventory.GoodsReceived',
  INVENTORY_GOODS_ISSUED: 'Inventory.GoodsIssued',
  INVENTORY_STOCK_ADJUSTED: 'Inventory.StockAdjusted',
  INVENTORY_STOCK_RESERVED: 'Inventory.StockReserved',
  INVENTORY_STOCK_RELEASED: 'Inventory.StockReleased',
  INVENTORY_HEAT_LOT_CREATED: 'Inventory.HeatLotCreated',
  INVENTORY_LOW_STOCK_ALERT: 'Inventory.LowStockAlert',

  // Warehouse Events
  WAREHOUSE_PUTAWAY_COMPLETED: 'Warehouse.PutawayCompleted',
  WAREHOUSE_MATERIAL_QUARANTINED: 'Warehouse.MaterialQuarantined',
  WAREHOUSE_MATERIAL_RELEASED: 'Warehouse.MaterialReleased',
  WAREHOUSE_FG_RECEIVED: 'Warehouse.FinishedGoodsReceived',
  WAREHOUSE_FG_RESERVED: 'Warehouse.FinishedGoodsReserved',

  // Workforce & Attendance Events
  WORKFORCE_EMPLOYEE_CREATED: 'Workforce.EmployeeCreated',
  WORKFORCE_EMPLOYEE_DEACTIVATED: 'Workforce.EmployeeDeactivated',
  WORKFORCE_SHIFT_SCHEDULED: 'Workforce.ShiftScheduled',
  WORKFORCE_PUNCH_RECORDED: 'Workforce.PunchRecorded',
  WORKFORCE_LEAVE_REQUESTED: 'Workforce.LeaveRequested',
  WORKFORCE_LEAVE_APPROVED: 'Workforce.LeaveApproved',
  WORKFORCE_LEAVE_REJECTED: 'Workforce.LeaveRejected',
  WORKFORCE_OVERTIME_REQUESTED: 'Workforce.OvertimeRequested',
  WORKFORCE_OVERTIME_APPROVED: 'Workforce.OvertimeApproved',

  // Dispatch Logistics Events
  DISPATCH_CREATED: 'Dispatch.Created',
  DISPATCH_QUALITY_VERIFIED: 'Dispatch.QualityVerified',
  DISPATCH_SCHEDULED: 'Dispatch.Scheduled',
  DISPATCH_APPROVED: 'Dispatch.Approved',
  DISPATCH_SHIPPED: 'Dispatch.Shipped',
  DISPATCH_DELIVERED: 'Dispatch.Delivered',
  DISPATCH_CANCELLED: 'Dispatch.Cancelled',

  // Master Data & Planning Events
  RECIPE_APPROVED: 'MasterData.RecipeApproved',
  SPEC_APPROVED: 'MasterData.SpecificationApproved',
  PRODUCTION_PLAN_CREATED: 'Planning.ProductionPlanCreated',
  MRP_RUN_COMPLETED: 'Planning.MrpRunCompleted',

  // Costing & Finance Events
  JOB_COST_RECALCULATED: 'Costing.JobCostRecalculated',
  JOURNAL_POSTED: 'Finance.JournalPosted',
  INVOICE_ISSUED: 'Finance.InvoiceIssued',
  PAYMENT_RECEIVED: 'Finance.PaymentReceived',

  // System & Audit Events
  SYSTEM_AUDIT_LOGGED: 'System.AuditLogged',
  SYSTEM_ALERT_TRIGGERED: 'System.AlertTriggered'
} as const;

export type DomainEventName = (typeof DomainEvents)[keyof typeof DomainEvents];
