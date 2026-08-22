/**
 * Standard Granular Permission Keys for Astralis Heat-Treatment Factory ERP
 * Format: <domain>:<resource>:<action>
 */
export const PERMISSIONS = {
  // 1. Customer Registry & Factory Master Data
  CUSTOMER_CREATE: 'customer:profile:create',
  CUSTOMER_VIEW: 'customer:profile:view',
  CUSTOMER_UPDATE: 'customer:profile:update',
  CUSTOMER_DEACTIVATE: 'customer:profile:deactivate',

  // 2. Item & Material Master Data
  INVENTORY_ITEM_CREATE: 'inventory:item:create',
  INVENTORY_ITEM_VIEW: 'inventory:item:view',
  INVENTORY_ITEM_UPDATE: 'inventory:item:update',
  INVENTORY_ITEM_DEACTIVATE: 'inventory:item:deactivate',

  // 3. Production & Job Card Management
  PRODUCTION_JOB_CREATE: 'production:job:create',
  PRODUCTION_JOB_VIEW: 'production:job:view',
  PRODUCTION_JOB_UPDATE: 'production:job:update',
  PRODUCTION_JOB_START: 'production:job:start',
  PRODUCTION_JOB_TRANSITION: 'production:job:transition',
  PRODUCTION_JOB_COMPLETE: 'production:job:complete',
  PRODUCTION_JOB_CANCEL: 'production:job:cancel',
  PRODUCTION_JOB_HOLD: 'production:job:hold',
  PRODUCTION_SCHEDULE_VIEW: 'production:schedule:view',
  PRODUCTION_SCHEDULE_MANAGE: 'production:schedule:manage',

  // 4. Metallurgical Quality Control, Recipes, Pyrometry & Specifications
  QUALITY_RECIPE_CREATE: 'quality:recipe:create',
  QUALITY_RECIPE_VIEW: 'quality:recipe:view',
  QUALITY_RECIPE_UPDATE: 'quality:recipe:update',
  QUALITY_RECIPE_APPROVE: 'quality:recipe:approve',
  QUALITY_RECIPE_OVERRIDE: 'quality:recipe:override',
  QUALITY_SPEC_CREATE: 'quality:spec:create',
  QUALITY_SPEC_VIEW: 'quality:spec:view',
  QUALITY_SPEC_UPDATE: 'quality:spec:update',
  QUALITY_SPEC_APPROVE: 'quality:spec:approve',
  QUALITY_INSPECTION_RECORD: 'quality:inspection:record',
  QUALITY_INSPECTION_VIEW: 'quality:inspection:view',
  QUALITY_INSPECTION_VERIFY: 'quality:inspection:verify',
  QUALITY_PYROMETRY_VIEW: 'quality:pyrometry:view',
  QUALITY_PYROMETRY_CALIBRATE: 'quality:pyrometry:calibrate',
  QUALITY_PYROMETRY_APPROVE_SAT: 'quality:pyrometry:approve_sat',
  QUALITY_PYROMETRY_APPROVE_TUS: 'quality:pyrometry:approve_tus',
  QUALITY_COC_GENERATE: 'quality:coc:generate',
  QUALITY_COC_APPROVE: 'quality:coc:approve',
  QUALITY_COC_REVOKE: 'quality:coc:revoke',
  QUALITY_DISPOSITION_MANAGE: 'quality:disposition:manage',

  // 5. Furnaces & Heat-Treatment Equipment
  MACHINES_FURNACE_VIEW: 'machines:furnace:view',
  MACHINES_FURNACE_OPERATE: 'machines:furnace:operate',
  MACHINES_FURNACE_CONFIGURE: 'machines:furnace:configure',
  MACHINES_TELEMETRY_VIEW: 'machines:telemetry:view',
  MACHINES_TELEMETRY_LOG: 'machines:telemetry:log',

  // 6. Equipment Maintenance & Calibration
  MAINTENANCE_WORKORDER_CREATE: 'maintenance:workorder:create',
  MAINTENANCE_WORKORDER_VIEW: 'maintenance:workorder:view',
  MAINTENANCE_WORKORDER_UPDATE: 'maintenance:workorder:update',
  MAINTENANCE_WORKORDER_COMPLETE: 'maintenance:workorder:complete',
  MAINTENANCE_WORKORDER_APPROVE: 'maintenance:workorder:approve',
  MAINTENANCE_SCHEDULE_MANAGE: 'maintenance:schedule:manage',

  // 7. Stores, Raw Material & Heat-Lot Traceability
  INVENTORY_HEAT_LOT_INWARD: 'inventory:heat_lot:inward',
  INVENTORY_HEAT_LOT_VIEW: 'inventory:heat_lot:view',
  INVENTORY_HEAT_LOT_QUARANTINE: 'inventory:heat_lot:quarantine',
  INVENTORY_HEAT_LOT_RELEASE: 'inventory:heat_lot:release',
  INVENTORY_STOCK_VIEW: 'inventory:stock:view',
  INVENTORY_STOCK_ADJUST: 'inventory:stock:adjust',
  INVENTORY_STOCK_TRANSFER: 'inventory:stock:transfer',

  // 8. Workforce & Attendance Management
  WORKFORCE_EMPLOYEE_VIEW: 'workforce:employee:view',
  WORKFORCE_EMPLOYEE_MANAGE: 'workforce:employee:manage',
  WORKFORCE_EMPLOYEE_CERTIFY: 'workforce:employee:certify',
  WORKFORCE_ATTENDANCE_VIEW: 'workforce:attendance:view',
  WORKFORCE_ATTENDANCE_MARK: 'workforce:attendance:mark',
  WORKFORCE_ATTENDANCE_APPROVE: 'workforce:attendance:approve',

  // 9. Finished Goods Warehouse & Dispatch
  DISPATCH_DELIVERY_CREATE: 'dispatch:delivery:create',
  DISPATCH_DELIVERY_VIEW: 'dispatch:delivery:view',
  DISPATCH_DELIVERY_DISPATCH: 'dispatch:delivery:dispatch',
  DISPATCH_PASS_GENERATE: 'dispatch:pass:generate',

  // 10. Factory Costing & Management Analytics
  REPORTS_ANALYTICS_VIEW_OEE: 'reports:analytics:view_oee',
  REPORTS_ANALYTICS_VIEW_QUALITY: 'reports:analytics:view_quality',
  REPORTS_ANALYTICS_VIEW_FINANCE: 'reports:analytics:view_finance',
  REPORTS_ANALYTICS_EXPORT: 'reports:analytics:export',

  // 11. Platform & Tenant Administration
  ADMIN_USER_CREATE: 'admin:user:create',
  ADMIN_USER_VIEW: 'admin:user:view',
  ADMIN_USER_UPDATE: 'admin:user:update',
  ADMIN_USER_DEACTIVATE: 'admin:user:deactivate',
  ADMIN_ROLE_CREATE: 'admin:role:create',
  ADMIN_ROLE_VIEW: 'admin:role:view',
  ADMIN_ROLE_UPDATE: 'admin:role:update',
  ADMIN_ROLE_ASSIGN: 'admin:role:assign',
  ADMIN_TENANT_VIEW: 'admin:tenant:view',
  ADMIN_TENANT_CONFIGURE: 'admin:tenant:configure'
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

/**
 * Initial Factory Role Definitions & Default Permission Sets
 */
export const DEFAULT_FACTORY_ROLES = [
  {
    code: 'ADMIN',
    name: 'Tenant System Administrator',
    description: 'Full administrative control over tenant configuration, users, and security roles',
    isSystemRole: true,
    permissions: ALL_PERMISSIONS
  },
  {
    code: 'PLANT_MANAGER',
    name: 'Plant / Operations General Manager',
    description: 'Comprehensive factory oversight: production approvals, OEE metrics, costing, and analytics',
    isSystemRole: true,
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.INVENTORY_ITEM_VIEW,
      PERMISSIONS.INVENTORY_ITEM_CREATE,
      PERMISSIONS.INVENTORY_ITEM_UPDATE,
      PERMISSIONS.PRODUCTION_JOB_VIEW,
      PERMISSIONS.PRODUCTION_JOB_HOLD,
      PERMISSIONS.PRODUCTION_JOB_CANCEL,
      PERMISSIONS.PRODUCTION_SCHEDULE_VIEW,
      PERMISSIONS.PRODUCTION_SCHEDULE_MANAGE,
      PERMISSIONS.QUALITY_RECIPE_VIEW,
      PERMISSIONS.QUALITY_SPEC_VIEW,
      PERMISSIONS.QUALITY_INSPECTION_VIEW,
      PERMISSIONS.QUALITY_PYROMETRY_VIEW,
      PERMISSIONS.QUALITY_COC_APPROVE,
      PERMISSIONS.MACHINES_FURNACE_VIEW,
      PERMISSIONS.MACHINES_TELEMETRY_VIEW,
      PERMISSIONS.MAINTENANCE_WORKORDER_VIEW,
      PERMISSIONS.MAINTENANCE_WORKORDER_APPROVE,
      PERMISSIONS.INVENTORY_HEAT_LOT_VIEW,
      PERMISSIONS.INVENTORY_STOCK_VIEW,
      PERMISSIONS.WORKFORCE_EMPLOYEE_VIEW,
      PERMISSIONS.WORKFORCE_ATTENDANCE_VIEW,
      PERMISSIONS.WORKFORCE_ATTENDANCE_APPROVE,
      PERMISSIONS.DISPATCH_DELIVERY_VIEW,
      PERMISSIONS.REPORTS_ANALYTICS_VIEW_OEE,
      PERMISSIONS.REPORTS_ANALYTICS_VIEW_QUALITY,
      PERMISSIONS.REPORTS_ANALYTICS_VIEW_FINANCE,
      PERMISSIONS.REPORTS_ANALYTICS_EXPORT
    ]
  },
  {
    code: 'METALLURGIST',
    name: 'Chief Metallurgist / QA Lead',
    description: 'Metallurgical recipe authoring, digital specification release, pyrometry calibration validation, and CoC authorization',
    isSystemRole: true,
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.INVENTORY_ITEM_VIEW,
      PERMISSIONS.INVENTORY_ITEM_CREATE,
      PERMISSIONS.INVENTORY_ITEM_UPDATE,
      PERMISSIONS.PRODUCTION_JOB_VIEW,
      PERMISSIONS.PRODUCTION_JOB_HOLD,
      PERMISSIONS.QUALITY_RECIPE_CREATE,
      PERMISSIONS.QUALITY_RECIPE_VIEW,
      PERMISSIONS.QUALITY_RECIPE_UPDATE,
      PERMISSIONS.QUALITY_RECIPE_APPROVE,
      PERMISSIONS.QUALITY_RECIPE_OVERRIDE,
      PERMISSIONS.QUALITY_SPEC_CREATE,
      PERMISSIONS.QUALITY_SPEC_VIEW,
      PERMISSIONS.QUALITY_SPEC_UPDATE,
      PERMISSIONS.QUALITY_SPEC_APPROVE,
      PERMISSIONS.QUALITY_INSPECTION_RECORD,
      PERMISSIONS.QUALITY_INSPECTION_VIEW,
      PERMISSIONS.QUALITY_INSPECTION_VERIFY,
      PERMISSIONS.QUALITY_PYROMETRY_VIEW,
      PERMISSIONS.QUALITY_PYROMETRY_CALIBRATE,
      PERMISSIONS.QUALITY_PYROMETRY_APPROVE_SAT,
      PERMISSIONS.QUALITY_PYROMETRY_APPROVE_TUS,
      PERMISSIONS.QUALITY_COC_GENERATE,
      PERMISSIONS.QUALITY_COC_APPROVE,
      PERMISSIONS.QUALITY_COC_REVOKE,
      PERMISSIONS.QUALITY_DISPOSITION_MANAGE,
      PERMISSIONS.MACHINES_FURNACE_VIEW,
      PERMISSIONS.MACHINES_TELEMETRY_VIEW,
      PERMISSIONS.INVENTORY_HEAT_LOT_VIEW,
      PERMISSIONS.INVENTORY_HEAT_LOT_QUARANTINE,
      PERMISSIONS.INVENTORY_HEAT_LOT_RELEASE,
      PERMISSIONS.REPORTS_ANALYTICS_VIEW_QUALITY
    ]
  },
  {
    code: 'FURNACE_OPERATOR',
    name: 'Heat-Treatment Furnace Operator',
    description: 'Floor operations: batch execution, stage transitions, furnace loading/unloading, temperature logs',
    isSystemRole: true,
    permissions: [
      PERMISSIONS.INVENTORY_ITEM_VIEW,
      PERMISSIONS.PRODUCTION_JOB_VIEW,
      PERMISSIONS.PRODUCTION_JOB_START,
      PERMISSIONS.PRODUCTION_JOB_TRANSITION,
      PERMISSIONS.PRODUCTION_JOB_COMPLETE,
      PERMISSIONS.PRODUCTION_SCHEDULE_VIEW,
      PERMISSIONS.QUALITY_RECIPE_VIEW,
      PERMISSIONS.QUALITY_SPEC_VIEW,
      PERMISSIONS.MACHINES_FURNACE_VIEW,
      PERMISSIONS.MACHINES_FURNACE_OPERATE,
      PERMISSIONS.MACHINES_TELEMETRY_VIEW,
      PERMISSIONS.MACHINES_TELEMETRY_LOG,
      PERMISSIONS.INVENTORY_STOCK_VIEW,
      PERMISSIONS.WORKFORCE_ATTENDANCE_MARK
    ]
  },
  {
    code: 'QC_INSPECTOR',
    name: 'Metallurgical QC Inspector',
    description: 'Test specimen preparation, hardness testing, case depth analysis, and inspection logging',
    isSystemRole: true,
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.INVENTORY_ITEM_VIEW,
      PERMISSIONS.PRODUCTION_JOB_VIEW,
      PERMISSIONS.QUALITY_RECIPE_VIEW,
      PERMISSIONS.QUALITY_SPEC_VIEW,
      PERMISSIONS.QUALITY_INSPECTION_RECORD,
      PERMISSIONS.QUALITY_INSPECTION_VIEW,
      PERMISSIONS.QUALITY_COC_GENERATE,
      PERMISSIONS.INVENTORY_HEAT_LOT_VIEW,
      PERMISSIONS.INVENTORY_HEAT_LOT_QUARANTINE,
      PERMISSIONS.WORKFORCE_ATTENDANCE_MARK
    ]
  },
  {
    code: 'MAINTENANCE_TECH',
    name: 'Furnace & Equipment Maintenance Technician',
    description: 'Preventive maintenance execution, thermocouple replacement, and breakdown repair',
    isSystemRole: true,
    permissions: [
      PERMISSIONS.INVENTORY_ITEM_VIEW,
      PERMISSIONS.MACHINES_FURNACE_VIEW,
      PERMISSIONS.MACHINES_FURNACE_CONFIGURE,
      PERMISSIONS.MACHINES_TELEMETRY_VIEW,
      PERMISSIONS.MAINTENANCE_WORKORDER_CREATE,
      PERMISSIONS.MAINTENANCE_WORKORDER_VIEW,
      PERMISSIONS.MAINTENANCE_WORKORDER_UPDATE,
      PERMISSIONS.MAINTENANCE_WORKORDER_COMPLETE,
      PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
      PERMISSIONS.QUALITY_PYROMETRY_VIEW,
      PERMISSIONS.QUALITY_PYROMETRY_CALIBRATE,
      PERMISSIONS.INVENTORY_STOCK_VIEW,
      PERMISSIONS.WORKFORCE_ATTENDANCE_MARK
    ]
  },
  {
    code: 'INVENTORY_CLERK',
    name: 'Stores & Heat-Lot Traceability Clerk',
    description: 'Raw material inwarding, heat-lot tagging, chemical test cert archiving, and stock movement',
    isSystemRole: true,
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.INVENTORY_ITEM_VIEW,
      PERMISSIONS.INVENTORY_ITEM_CREATE,
      PERMISSIONS.INVENTORY_ITEM_UPDATE,
      PERMISSIONS.INVENTORY_HEAT_LOT_INWARD,
      PERMISSIONS.INVENTORY_HEAT_LOT_VIEW,
      PERMISSIONS.INVENTORY_HEAT_LOT_QUARANTINE,
      PERMISSIONS.INVENTORY_STOCK_VIEW,
      PERMISSIONS.INVENTORY_STOCK_ADJUST,
      PERMISSIONS.INVENTORY_STOCK_TRANSFER,
      PERMISSIONS.PRODUCTION_JOB_VIEW,
      PERMISSIONS.WORKFORCE_ATTENDANCE_MARK
    ]
  },
  {
    code: 'DISPATCH_OFFICER',
    name: 'Finished Goods & Shipping Officer',
    description: 'Final quality inspection verification, delivery challan issuance, and packaging checklists',
    isSystemRole: true,
    permissions: [
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.INVENTORY_ITEM_VIEW,
      PERMISSIONS.PRODUCTION_JOB_VIEW,
      PERMISSIONS.QUALITY_COC_GENERATE,
      PERMISSIONS.INVENTORY_STOCK_VIEW,
      PERMISSIONS.DISPATCH_DELIVERY_CREATE,
      PERMISSIONS.DISPATCH_DELIVERY_VIEW,
      PERMISSIONS.DISPATCH_DELIVERY_DISPATCH,
      PERMISSIONS.DISPATCH_PASS_GENERATE,
      PERMISSIONS.WORKFORCE_ATTENDANCE_MARK
    ]
  }
];
