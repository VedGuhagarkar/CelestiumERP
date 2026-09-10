/**
 * Astralis ERP Domain Lifecycle Status Enums
 * Authoritative Reference: CelestiumERP.md
 */

// 12-Stage Heat Treatment Lifecycle State Machine (Section 6.1)
export enum JobStatus {
  WAITING_FOR_PRODUCTION = 'WAITING_FOR_PRODUCTION',
  IN_PRODUCTION = 'IN_PRODUCTION',
  WAITING_FOR_INSPECTION = 'WAITING_FOR_INSPECTION',
  IN_INSPECTION = 'IN_INSPECTION',
  WAITING_FOR_DISPATCH = 'WAITING_FOR_DISPATCH',
  INSPECTION = 'INSPECTION',
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  QUALITY_CHECK = 'QUALITY_CHECK',
  STORAGE = 'STORAGE',
  READY_FOR_DISPATCH = 'READY_FOR_DISPATCH',
  DISPATCHED = 'DISPATCHED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// 5-Tier Quality Inspection Status Hierarchy (Section 7.1)
export enum QualityInspectionStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REINSPECTION = 'REINSPECTION'
}

// Machine Operational States (Section 8.1)
export enum MachineStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  MAINTENANCE = 'MAINTENANCE',
  BREAKDOWN = 'BREAKDOWN',
  OFFLINE = 'OFFLINE',
  CALIBRATING = 'CALIBRATING'
}

// Shipment Lifecycle State Machine (Section 13.1)
export enum DispatchStatus {
  DRAFT = 'DRAFT',
  QUALITY_VERIFIED = 'QUALITY_VERIFIED',
  SCHEDULED = 'SCHEDULED',
  APPROVED = 'APPROVED',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

// Employee Status
export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED'
}

// Stock Transaction Types
export enum StockTransactionType {
  RECEIPT = 'RECEIPT',
  ISSUE = 'ISSUE',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  SCRAP = 'SCRAP'
}
