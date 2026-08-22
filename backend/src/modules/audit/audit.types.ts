import { Document } from 'mongoose';

export type AuditStatus = 'SUCCESS' | 'FAILURE';

export interface FieldDiff {
  old: any;
  new: any;
}

export type StateDiff = Record<string, FieldDiff>;

export interface IAuditLog {
  tenantId: string;
  actorId: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  diff?: StateDiff;
  status: AuditStatus;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogDocument extends IAuditLog, Document {}

export interface RecordAuditOptions {
  actorId: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  status?: AuditStatus;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface AuditQueryFilters {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  status?: AuditStatus;
  startDate?: string;
  endDate?: string;
}
