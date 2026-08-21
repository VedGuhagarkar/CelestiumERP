/**
 * Astralis ERP 44 Granular Permission Keys & Sensitivity Classifications
 * Authoritative Reference: CelestiumERP.md Section 3.1
 */

export const Permissions = {
  // Jobs Domain
  JOB_VIEW: 'JOB_VIEW',
  JOB_CREATE: 'JOB_CREATE',
  JOB_UPDATE: 'JOB_UPDATE',
  JOB_DELETE: 'JOB_DELETE',
  JOB_DISPATCH: 'JOB_DISPATCH',

  // Quality Domain
  QC_INSPECT: 'QC_INSPECT',
  QC_ASSIGN: 'QC_ASSIGN',
  QC_APPROVE: 'QC_APPROVE',
  QC_REJECT: 'QC_REJECT',

  // Machines & Equipment Domain
  MACHINE_VIEW: 'MACHINE_VIEW',
  MACHINE_CREATE: 'MACHINE_CREATE',
  MACHINE_UPDATE: 'MACHINE_UPDATE',
  MACHINE_DELETE: 'MACHINE_DELETE',
  MACHINE_MAINTAIN: 'MACHINE_MAINTAIN',

  // Inventory & Heat Lots Domain
  INVENTORY_VIEW: 'INVENTORY_VIEW',
  INVENTORY_UPDATE: 'INVENTORY_UPDATE',
  INVENTORY_MANAGE: 'INVENTORY_MANAGE',

  // Personnel & Employee Directory Domain
  EMPLOYEE_VIEW: 'EMPLOYEE_VIEW',
  EMPLOYEE_CREATE: 'EMPLOYEE_CREATE',
  EMPLOYEE_UPDATE: 'EMPLOYEE_UPDATE',
  EMPLOYEE_DELETE: 'EMPLOYEE_DELETE',
  EMPLOYEE_DEACTIVATE: 'EMPLOYEE_DEACTIVATE',
  EMPLOYEE_REACTIVATE: 'EMPLOYEE_REACTIVATE',
  EMPLOYEE_ASSIGN: 'EMPLOYEE_ASSIGN',
  EMPLOYEE_MANAGE_SKILLS: 'EMPLOYEE_MANAGE_SKILLS',

  // Workforce & Attendance Domain
  ATTENDANCE_VIEW: 'ATTENDANCE_VIEW',
  ATTENDANCE_MARK: 'ATTENDANCE_MARK',
  WORKFORCE_MANAGE: 'WORKFORCE_MANAGE',

  // Dispatch Logistics Domain
  DISPATCH_VIEW: 'DISPATCH_VIEW',
  DISPATCH_CREATE: 'DISPATCH_CREATE',
  DISPATCH_SCHEDULE: 'DISPATCH_SCHEDULE',
  DISPATCH_APPROVE: 'DISPATCH_APPROVE',
  DISPATCH_MARK: 'DISPATCH_MARK',
  DISPATCH_CANCEL: 'DISPATCH_CANCEL',

  // Reports & Analytics Domain
  REPORTS_VIEW: 'REPORTS_VIEW',
  REPORTS_MANAGE: 'REPORTS_MANAGE',

  // Customer Registry Domain
  CUSTOMER_VIEW: 'CUSTOMER_VIEW',
  CUSTOMER_CREATE: 'CUSTOMER_CREATE',
  CUSTOMER_UPDATE: 'CUSTOMER_UPDATE',
  CUSTOMER_DELETE: 'CUSTOMER_DELETE',

  // Notifications Domain
  NOTIFICATIONS_VIEW: 'NOTIFICATIONS_VIEW',
  NOTIFICATIONS_MANAGE: 'NOTIFICATIONS_MANAGE',

  // Administration & Governance Domain
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  TENANT_MANAGE: 'TENANT_MANAGE',
  AUDIT_VIEW: 'AUDIT_VIEW',

  // Workflow State Engine Domain
  WORKFLOW_VIEW: 'WORKFLOW_VIEW',
  WORKFLOW_EXECUTE: 'WORKFLOW_EXECUTE',
  WORKFLOW_MANAGE: 'WORKFLOW_MANAGE'
} as const;

export type PermissionKey = keyof typeof Permissions;

export enum PermissionSensitivity {
  STANDARD = 'STANDARD',
  SENSITIVE = 'SENSITIVE',
  CRITICAL = 'CRITICAL'
}

export interface PermissionDefinition {
  key: PermissionKey;
  domain: string;
  sensitivity: PermissionSensitivity;
  description: string;
}

export const PERMISSION_CATALOG: Record<PermissionKey, PermissionDefinition> = {
  // Jobs
  JOB_VIEW: { key: 'JOB_VIEW', domain: 'Jobs', sensitivity: PermissionSensitivity.STANDARD, description: 'View production jobs and work order timelines' },
  JOB_CREATE: { key: 'JOB_CREATE', domain: 'Jobs', sensitivity: PermissionSensitivity.STANDARD, description: 'Create new production work orders and batches' },
  JOB_UPDATE: { key: 'JOB_UPDATE', domain: 'Jobs', sensitivity: PermissionSensitivity.STANDARD, description: 'Update work order recipes, targets, and allocations' },
  JOB_DELETE: { key: 'JOB_DELETE', domain: 'Jobs', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Soft-delete or cancel draft production jobs' },
  JOB_DISPATCH: { key: 'JOB_DISPATCH', domain: 'Jobs', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Authorize completed job transfer to dispatch staging' },

  // Quality
  QC_INSPECT: { key: 'QC_INSPECT', domain: 'Quality', sensitivity: PermissionSensitivity.STANDARD, description: 'Record lab measurements, hardness surveys, and microstructures' },
  QC_ASSIGN: { key: 'QC_ASSIGN', domain: 'Quality', sensitivity: PermissionSensitivity.STANDARD, description: 'Assign certified inspectors to inspection work orders' },
  QC_APPROVE: { key: 'QC_APPROVE', domain: 'Quality', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Sign off and approve Certificates of Conformance (CoC)' },
  QC_REJECT: { key: 'QC_REJECT', domain: 'Quality', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Reject non-conforming lots and raise NCRs' },

  // Machines
  MACHINE_VIEW: { key: 'MACHINE_VIEW', domain: 'Machines', sensitivity: PermissionSensitivity.STANDARD, description: 'View machinery fleet status and pyrometry telemetry' },
  MACHINE_CREATE: { key: 'MACHINE_CREATE', domain: 'Machines', sensitivity: PermissionSensitivity.STANDARD, description: 'Register new furnaces, quench tanks, and CNC equipment' },
  MACHINE_UPDATE: { key: 'MACHINE_UPDATE', domain: 'Machines', sensitivity: PermissionSensitivity.STANDARD, description: 'Update machine parameters, capabilities, and zones' },
  MACHINE_DELETE: { key: 'MACHINE_DELETE', domain: 'Machines', sensitivity: PermissionSensitivity.STANDARD, description: 'Decommission or archive factory machines' },
  MACHINE_MAINTAIN: { key: 'MACHINE_MAINTAIN', domain: 'Machines', sensitivity: PermissionSensitivity.STANDARD, description: 'Create and log preventive/corrective maintenance records' },

  // Inventory
  INVENTORY_VIEW: { key: 'INVENTORY_VIEW', domain: 'Inventory', sensitivity: PermissionSensitivity.STANDARD, description: 'View stock levels, heat lots, and MTR certificates' },
  INVENTORY_UPDATE: { key: 'INVENTORY_UPDATE', domain: 'Inventory', sensitivity: PermissionSensitivity.STANDARD, description: 'Record goods receipts, issues, and transfers' },
  INVENTORY_MANAGE: { key: 'INVENTORY_MANAGE', domain: 'Inventory', sensitivity: PermissionSensitivity.STANDARD, description: 'Perform supervisor stock adjustments and manage SKU master data' },

  // Employees
  EMPLOYEE_VIEW: { key: 'EMPLOYEE_VIEW', domain: 'Employees', sensitivity: PermissionSensitivity.STANDARD, description: 'View personnel directory and certified skills' },
  EMPLOYEE_CREATE: { key: 'EMPLOYEE_CREATE', domain: 'Employees', sensitivity: PermissionSensitivity.STANDARD, description: 'Add new employees and operator profiles' },
  EMPLOYEE_UPDATE: { key: 'EMPLOYEE_UPDATE', domain: 'Employees', sensitivity: PermissionSensitivity.STANDARD, description: 'Update employee contact details and departments' },
  EMPLOYEE_DELETE: { key: 'EMPLOYEE_DELETE', domain: 'Employees', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Soft-delete or offboard an employee profile' },
  EMPLOYEE_DEACTIVATE: { key: 'EMPLOYEE_DEACTIVATE', domain: 'Employees', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Suspend or deactivate employee system access' },
  EMPLOYEE_REACTIVATE: { key: 'EMPLOYEE_REACTIVATE', domain: 'Employees', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Restore or reactivate suspended employee access' },
  EMPLOYEE_ASSIGN: { key: 'EMPLOYEE_ASSIGN', domain: 'Employees', sensitivity: PermissionSensitivity.STANDARD, description: 'Assign operators to production cells and departments' },
  EMPLOYEE_MANAGE_SKILLS: { key: 'EMPLOYEE_MANAGE_SKILLS', domain: 'Employees', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Certify pyrometry and thermal processing skills' },

  // Attendance
  ATTENDANCE_VIEW: { key: 'ATTENDANCE_VIEW', domain: 'Attendance', sensitivity: PermissionSensitivity.STANDARD, description: 'View shift rosters, clock-in logs, and calendar schedules' },
  ATTENDANCE_MARK: { key: 'ATTENDANCE_MARK', domain: 'Attendance', sensitivity: PermissionSensitivity.STANDARD, description: 'Clock-in/out and record attendance timestamps' },
  WORKFORCE_MANAGE: { key: 'WORKFORCE_MANAGE', domain: 'Attendance', sensitivity: PermissionSensitivity.STANDARD, description: 'Manage shift definitions, approve leaves, and authorize overtime' },

  // Dispatch
  DISPATCH_VIEW: { key: 'DISPATCH_VIEW', domain: 'Dispatch', sensitivity: PermissionSensitivity.STANDARD, description: 'View outbound consignments, challans, and shipping status' },
  DISPATCH_CREATE: { key: 'DISPATCH_CREATE', domain: 'Dispatch', sensitivity: PermissionSensitivity.STANDARD, description: 'Draft new outbound dispatch orders' },
  DISPATCH_SCHEDULE: { key: 'DISPATCH_SCHEDULE', domain: 'Dispatch', sensitivity: PermissionSensitivity.STANDARD, description: 'Assign carriers, vehicles, and delivery schedules' },
  DISPATCH_APPROVE: { key: 'DISPATCH_APPROVE', domain: 'Dispatch', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Authorize shipment departure and gate release' },
  DISPATCH_MARK: { key: 'DISPATCH_MARK', domain: 'Dispatch', sensitivity: PermissionSensitivity.STANDARD, description: 'Mark shipment as dispatched or delivered with PoD' },
  DISPATCH_CANCEL: { key: 'DISPATCH_CANCEL', domain: 'Dispatch', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Cancel outbound dispatch and return items to storage' },

  // Reports
  REPORTS_VIEW: { key: 'REPORTS_VIEW', domain: 'Reports', sensitivity: PermissionSensitivity.STANDARD, description: 'Access executive dashboards and operational analytics' },
  REPORTS_MANAGE: { key: 'REPORTS_MANAGE', domain: 'Reports', sensitivity: PermissionSensitivity.STANDARD, description: 'Configure automated scheduled reports and data exports' },

  // Customers
  CUSTOMER_VIEW: { key: 'CUSTOMER_VIEW', domain: 'Customers', sensitivity: PermissionSensitivity.STANDARD, description: 'View customer accounts and contact directory' },
  CUSTOMER_CREATE: { key: 'CUSTOMER_CREATE', domain: 'Customers', sensitivity: PermissionSensitivity.STANDARD, description: 'Register new client companies and billing profiles' },
  CUSTOMER_UPDATE: { key: 'CUSTOMER_UPDATE', domain: 'Customers', sensitivity: PermissionSensitivity.STANDARD, description: 'Update customer credit terms and addresses' },
  CUSTOMER_DELETE: { key: 'CUSTOMER_DELETE', domain: 'Customers', sensitivity: PermissionSensitivity.STANDARD, description: 'Archive or soft-delete customer master records' },

  // Notifications
  NOTIFICATIONS_VIEW: { key: 'NOTIFICATIONS_VIEW', domain: 'Notifications', sensitivity: PermissionSensitivity.STANDARD, description: 'View in-app alerts and notifications' },
  NOTIFICATIONS_MANAGE: { key: 'NOTIFICATIONS_MANAGE', domain: 'Notifications', sensitivity: PermissionSensitivity.STANDARD, description: 'Manage notification templates and delivery rules' },

  // Admin
  SYSTEM_ADMIN: { key: 'SYSTEM_ADMIN', domain: 'Admin', sensitivity: PermissionSensitivity.CRITICAL, description: 'Full administrative access to platform configuration and maintenance' },
  TENANT_MANAGE: { key: 'TENANT_MANAGE', domain: 'Admin', sensitivity: PermissionSensitivity.CRITICAL, description: 'Configure tenant profiles, rate limits, and feature flags' },
  AUDIT_VIEW: { key: 'AUDIT_VIEW', domain: 'Admin', sensitivity: PermissionSensitivity.CRITICAL, description: 'Inspect immutable system audit logs and change diffs' },

  // Workflow
  WORKFLOW_VIEW: { key: 'WORKFLOW_VIEW', domain: 'Workflow', sensitivity: PermissionSensitivity.STANDARD, description: 'View workflow state machine definitions and execution graphs' },
  WORKFLOW_EXECUTE: { key: 'WORKFLOW_EXECUTE', domain: 'Workflow', sensitivity: PermissionSensitivity.STANDARD, description: 'Execute transition actions on active workflow instances' },
  WORKFLOW_MANAGE: { key: 'WORKFLOW_MANAGE', domain: 'Workflow', sensitivity: PermissionSensitivity.SENSITIVE, description: 'Create, version, and configure state machine definitions' }
};
