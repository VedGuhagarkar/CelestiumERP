import { INotificationTemplate } from './notification.types.js';

export const FACTORY_NOTIFICATION_TEMPLATES: Record<string, INotificationTemplate> = {
  QC_INSPECTION_REJECTED: {
    templateId: 'QC_INSPECTION_REJECTED',
    category: 'QUALITY',
    priority: 'HIGH',
    titleTemplate: 'QC Inspection Rejected: Job {jobNumber}',
    messageTemplate:
      'Quality inspection {inspectionNumber} for Job {jobNumber} (Heat-Lot {heatLotNumber}) was REJECTED: {defectDetails}. Immediate disposition required.',
    defaultActionUrlTemplate: '/quality/inspections/{inspectionId}',
    targetRoles: ['METALLURGIST', 'PLANT_MANAGER']
  },
  QC_NCR_RAISED: {
    templateId: 'QC_NCR_RAISED',
    category: 'QUALITY',
    priority: 'HIGH',
    titleTemplate: 'NCR Raised: {ncrNumber} ({severity})',
    messageTemplate:
      'Non-Conformance Report {ncrNumber} has been raised for Job {jobNumber}: {title}. Quarantined quantity: {quarantinedQuantity} {uom}.',
    defaultActionUrlTemplate: '/quality/ncrs/{ncrId}',
    targetRoles: ['METALLURGIST', 'PLANT_MANAGER']
  },
  MACHINE_BREAKDOWN: {
    templateId: 'MACHINE_BREAKDOWN',
    category: 'EQUIPMENT',
    priority: 'CRITICAL',
    titleTemplate: 'CRITICAL: Machine Breakdown on {machineCode}',
    messageTemplate:
      'Emergency breakdown reported on {machineCode} ({machineName}) in {bay}. Work order {workOrderNumber} created: {failureDetails}.',
    defaultActionUrlTemplate: '/machines/{machineId}',
    targetRoles: ['MAINTENANCE_TECH', 'PLANT_MANAGER', 'FURNACE_OPERATOR']
  },
  MAINTENANCE_OVERDUE: {
    templateId: 'MAINTENANCE_OVERDUE',
    category: 'MAINTENANCE',
    priority: 'HIGH',
    titleTemplate: 'Overdue Maintenance: {workOrderNumber}',
    messageTemplate:
      'Preventive Maintenance work order {workOrderNumber} on {machineCode} is OVERDUE by {daysOverdue} days.',
    defaultActionUrlTemplate: '/maintenance/workorders/{workOrderId}',
    targetRoles: ['MAINTENANCE_TECH', 'PLANT_MANAGER']
  },
  PYROMETRY_EXPIRING: {
    templateId: 'PYROMETRY_EXPIRING',
    category: 'PYROMETRY',
    priority: 'HIGH',
    titleTemplate: 'Pyrometry Calibration Expiring: {machineCode}',
    messageTemplate:
      'Pyrometry calibration ({calibrationType}) for {machineCode} will expire on {expiryDate} ({daysRemaining} days remaining). Schedule TUS/SAT calibration.',
    defaultActionUrlTemplate: '/pyrometry/{machineId}',
    targetRoles: ['METALLURGIST', 'PLANT_MANAGER']
  },
  PYROMETRY_EXPIRED: {
    templateId: 'PYROMETRY_EXPIRED',
    category: 'PYROMETRY',
    priority: 'CRITICAL',
    titleTemplate: 'CRITICAL: Pyrometry Calibration EXPIRED on {machineCode}',
    messageTemplate:
      'Pyrometry calibration on {machineCode} is EXPIRED. Furnace operating privileges are locked for aerospace/automotive certified production until recalibration.',
    defaultActionUrlTemplate: '/pyrometry/{machineId}',
    targetRoles: ['METALLURGIST', 'PLANT_MANAGER', 'FURNACE_OPERATOR']
  },
  INVENTORY_SHORTAGE: {
    templateId: 'INVENTORY_SHORTAGE',
    category: 'INVENTORY',
    priority: 'HIGH',
    titleTemplate: 'Material Shortage Alert: {itemCode}',
    messageTemplate:
      'Inventory stock for {itemCode} ({itemName}) has dropped to {currentStock} {uom}, breaching safety stock threshold ({safetyStock} {uom}).',
    defaultActionUrlTemplate: '/inventory/items/{itemId}',
    targetRoles: ['STORES_KEEPER', 'PLANT_MANAGER']
  },
  DISPATCH_PENDING_APPROVAL: {
    templateId: 'DISPATCH_PENDING_APPROVAL',
    category: 'DISPATCH',
    priority: 'MEDIUM',
    titleTemplate: 'Dispatch Pending Authorization: {dispatchNumber}',
    messageTemplate:
      'Finished goods consignment {dispatchNumber} for {customerName} is packed and quality-verified. Awaiting Gate Pass & Dispatch authorization.',
    defaultActionUrlTemplate: '/dispatches/{dispatchId}',
    targetRoles: ['DISPATCH_CLERK', 'PLANT_MANAGER']
  },
  PRODUCTION_JOB_HELD: {
    templateId: 'PRODUCTION_JOB_HELD',
    category: 'PRODUCTION',
    priority: 'HIGH',
    titleTemplate: 'Job Placed on HOLD: {jobNumber}',
    messageTemplate:
      'Production Job {jobNumber} (Heat-Lot {heatLotNumber}) was placed on HOLD: {holdReason}.',
    defaultActionUrlTemplate: '/production-jobs/{jobId}',
    targetRoles: ['FURNACE_OPERATOR', 'METALLURGIST', 'PLANT_MANAGER']
  },
  PRODUCTION_CYCLE_EXCEEDED: {
    templateId: 'PRODUCTION_CYCLE_EXCEEDED',
    category: 'PRODUCTION',
    priority: 'MEDIUM',
    titleTemplate: 'Abnormal Cycle Time Detected: {jobNumber}',
    messageTemplate:
      'Job {jobNumber} on {furnaceCode} exceeded planned thermal cycle time by {varianceHours} hours ({actualHours}h vs {plannedHours}h).',
    defaultActionUrlTemplate: '/production-jobs/{jobId}',
    targetRoles: ['FURNACE_OPERATOR', 'PLANT_MANAGER']
  },
  RECIPE_PENDING_APPROVAL: {
    templateId: 'RECIPE_PENDING_APPROVAL',
    category: 'QUALITY',
    priority: 'MEDIUM',
    titleTemplate: 'Recipe Pending Metallurgical Approval: {recipeCode}',
    messageTemplate:
      'New Recipe Revision {revisionNumber} for {recipeCode} ({name}) created and awaiting Chief Metallurgist sign-off.',
    defaultActionUrlTemplate: '/quality/recipes/{recipeId}',
    targetRoles: ['METALLURGIST']
  }
};

/**
 * Replace placeholders like {key} with values from parameters dictionary
 */
export function renderTemplateString(template: string, params: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    return params[key] !== undefined && params[key] !== null ? String(params[key]) : '';
  });
}
