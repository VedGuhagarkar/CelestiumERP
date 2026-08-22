import { BaseService } from '../../core/services/base.service.js';
import {
  INotificationRepository,
  notificationRepository
} from './notification.repository.js';
import { DomainEvents } from '../../core/constants/events.js';
import { IDomainEvent } from '../../core/events/domain-event-bus.js';
import { auditService } from '../audit/audit.service.js';
import { NotFoundError, BadRequestError } from '../../core/errors/app-error.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';
import {
  NotificationDocument,
  NotificationPreferenceDocument
} from './notification.model.js';
import {
  INotification,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
  QueryNotificationsDto,
  UpdatePreferencesDto,
  BroadcastAlertDto
} from './notification.types.js';
import {
  FACTORY_NOTIFICATION_TEMPLATES,
  renderTemplateString
} from './notification.templates.js';

export interface IActorContext {
  userId: string;
  email?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class NotificationService extends BaseService {
  private static isSubscribed = false;

  constructor(private readonly repo: INotificationRepository = notificationRepository) {
    super('NotificationService');
    this.registerEventSubscriptions();
  }

  /**
   * Register Domain Event Handlers on initialization (Single-subscriber guard)
   */
  public registerEventSubscriptions(): void {
    if (NotificationService.isSubscribed) return;
    NotificationService.isSubscribed = true;

    // 1. Quality Events
    this.eventBus.subscribe(DomainEvents.QC_REJECTED, (event) =>
      this.handleQcRejectedEvent(event)
    );
    this.eventBus.subscribe(DomainEvents.QC_NCR_RAISED, (event) =>
      this.handleNcrRaisedEvent(event)
    );

    // 2. Machine & Equipment Events
    this.eventBus.subscribe(DomainEvents.MACHINE_BREAKDOWN_REPORTED, (event) =>
      this.handleMachineBreakdownEvent(event)
    );
    this.eventBus.subscribe(DomainEvents.MAINTENANCE_WORK_ORDER_CREATED, (event) =>
      this.handleMaintenanceWorkOrderEvent(event)
    );
    this.eventBus.subscribe(DomainEvents.MACHINE_CALIBRATION_LOGGED, (event) =>
      this.handlePyrometryCalibrationEvent(event)
    );

    // 3. Inventory & Shortage Events
    this.eventBus.subscribe(DomainEvents.INVENTORY_LOW_STOCK_ALERT, (event) =>
      this.handleLowStockAlertEvent(event)
    );

    // 4. Dispatch Events
    this.eventBus.subscribe(DomainEvents.DISPATCH_SCHEDULED, (event) =>
      this.handleDispatchScheduledEvent(event)
    );

    // 5. Production Events
    this.eventBus.subscribe(DomainEvents.JOB_PAUSED, (event) =>
      this.handleJobPausedEvent(event)
    );
  }

  // ==========================================
  // Domain Event Handlers (Decoupled Reactive Listeners)
  // ==========================================

  public async handleQcRejectedEvent(event: IDomainEvent): Promise<void> {
    const payload = event.payload || {};
    const inspectionId = payload.inspectionId || payload.id || 'insp_unknown';
    const jobNumber = payload.jobNumber || 'JOB-UNKNOWN';
    const inspectionNumber = payload.inspectionNumber || 'INSP-UNKNOWN';
    const heatLotNumber = payload.heatLotNumber || 'HL-UNKNOWN';
    const defectDetails = payload.defectDetails || payload.rejectionReason || 'Hardness out of specification';

    const idempotencyKey = `QC_REJECTED:${event.tenantId}:${inspectionId}`;
    const params = { jobNumber, inspectionNumber, heatLotNumber, defectDetails, inspectionId };

    await this.dispatchTemplatedNotification(event.tenantId, {
      templateId: 'QC_INSPECTION_REJECTED',
      sourceEvent: event.name,
      sourceEntityType: 'QualityInspection',
      sourceEntityId: inspectionId,
      idempotencyKey,
      params,
      metadata: payload
    });
  }

  public async handleNcrRaisedEvent(event: IDomainEvent): Promise<void> {
    const payload = event.payload || {};
    const ncrId = payload.ncrId || payload.id || 'ncr_unknown';
    const ncrNumber = payload.ncrNumber || 'NCR-UNKNOWN';
    const title = payload.title || 'Quality Non-Conformance';
    const severity = payload.severity || 'MAJOR';
    const jobNumber = payload.jobNumber || 'JOB-UNKNOWN';
    const quarantinedQuantity = payload.quarantinedQuantity || payload.affectedQuantity || 0;
    const uom = payload.uom || 'PCS';

    const idempotencyKey = `NCR_RAISED:${event.tenantId}:${ncrId}`;
    const params = { ncrNumber, title, severity, jobNumber, quarantinedQuantity, uom, ncrId };

    await this.dispatchTemplatedNotification(event.tenantId, {
      templateId: 'QC_NCR_RAISED',
      sourceEvent: event.name,
      sourceEntityType: 'NonConformanceReport',
      sourceEntityId: ncrId,
      idempotencyKey,
      params,
      metadata: payload
    });
  }

  public async handleMachineBreakdownEvent(event: IDomainEvent): Promise<void> {
    const payload = event.payload || {};
    const machineId = payload.machineId || payload.id || 'mach_unknown';
    const machineCode = payload.machineCode || 'FURNACE-UNKNOWN';
    const machineName = payload.machineName || 'Heat Treatment Furnace';
    const bay = payload.bay || 'Bay 1';
    const workOrderNumber = payload.workOrderNumber || 'WO-EMERGENCY';
    const failureDetails = payload.failureDetails || payload.description || 'Emergency Heating Breakdown';

    const idempotencyKey = `BREAKDOWN:${event.tenantId}:${machineId}:${Date.now()}`;
    const params = { machineCode, machineName, bay, workOrderNumber, failureDetails, machineId };

    // Rate Limit Cooldown: 120s per machine to prevent alert storms from repeated sensor telemetry
    const isRateLimited = await this.repo.checkRateLimitCooldown(event.tenantId, 'EQUIPMENT', machineId, 120);
    if (isRateLimited) {
      this.logger.debug(`[NotificationService] Suppressing breakdown storm for machine ${machineCode}`);
      return;
    }

    await this.dispatchTemplatedNotification(event.tenantId, {
      templateId: 'MACHINE_BREAKDOWN',
      sourceEvent: event.name,
      sourceEntityType: 'Machine',
      sourceEntityId: machineId,
      idempotencyKey,
      params,
      metadata: payload
    });
  }

  public async handleMaintenanceWorkOrderEvent(event: IDomainEvent): Promise<void> {
    const payload = event.payload || {};
    if (payload.isOverdue || payload.status === 'OVERDUE') {
      const workOrderId = payload.workOrderId || payload.id || 'wo_unknown';
      const workOrderNumber = payload.workOrderNumber || 'WO-UNKNOWN';
      const machineCode = payload.machineCode || 'FURNACE-01';
      const daysOverdue = payload.daysOverdue || 3;

      const idempotencyKey = `WO_OVERDUE:${event.tenantId}:${workOrderId}`;
      const params = { workOrderNumber, machineCode, daysOverdue, workOrderId };

      await this.dispatchTemplatedNotification(event.tenantId, {
        templateId: 'MAINTENANCE_OVERDUE',
        sourceEvent: event.name,
        sourceEntityType: 'MaintenanceWorkOrder',
        sourceEntityId: workOrderId,
        idempotencyKey,
        params,
        metadata: payload
      });
    }
  }

  public async handlePyrometryCalibrationEvent(event: IDomainEvent): Promise<void> {
    const payload = event.payload || {};
    const machineId = payload.machineId || payload.id || 'mach_unknown';
    const machineCode = payload.machineCode || 'FURNACE-01';
    const calibrationType = payload.calibrationType || 'TUS';
    const daysRemaining = payload.daysRemaining !== undefined ? payload.daysRemaining : 7;
    const expiryDate = payload.expiryDate ? new Date(payload.expiryDate).toLocaleDateString() : 'Upcoming';

    if (daysRemaining <= 0) {
      const idempotencyKey = `PYRO_EXPIRED:${event.tenantId}:${machineId}`;
      const params = { machineCode, machineId };
      await this.dispatchTemplatedNotification(event.tenantId, {
        templateId: 'PYROMETRY_EXPIRED',
        sourceEvent: event.name,
        sourceEntityType: 'Machine',
        sourceEntityId: machineId,
        idempotencyKey,
        params,
        metadata: payload
      });
    } else if (daysRemaining <= 14) {
      const idempotencyKey = `PYRO_EXPIRING:${event.tenantId}:${machineId}:${calibrationType}`;
      const params = { machineCode, calibrationType, daysRemaining, expiryDate, machineId };
      await this.dispatchTemplatedNotification(event.tenantId, {
        templateId: 'PYROMETRY_EXPIRING',
        sourceEvent: event.name,
        sourceEntityType: 'Machine',
        sourceEntityId: machineId,
        idempotencyKey,
        params,
        metadata: payload
      });
    }
  }

  public async handleLowStockAlertEvent(event: IDomainEvent): Promise<void> {
    const payload = event.payload || {};
    const itemId = payload.itemId || payload.id || 'item_unknown';
    const itemCode = payload.itemCode || 'PART-001';
    const itemName = payload.itemName || 'Raw Alloy Material';
    const currentStock = payload.currentStock || payload.quantity || 0;
    const safetyStock = payload.safetyStock || 50;
    const uom = payload.uom || 'KG';

    // Rate Limit Cooldown: 300s (5m) to prevent multiple stock transaction alert storms
    const isRateLimited = await this.repo.checkRateLimitCooldown(event.tenantId, 'INVENTORY', itemId, 300);
    if (isRateLimited) return;

    const idempotencyKey = `LOW_STOCK:${event.tenantId}:${itemId}`;
    const params = { itemCode, itemName, currentStock, safetyStock, uom, itemId };

    await this.dispatchTemplatedNotification(event.tenantId, {
      templateId: 'INVENTORY_SHORTAGE',
      sourceEvent: event.name,
      sourceEntityType: 'Item',
      sourceEntityId: itemId,
      idempotencyKey,
      params,
      metadata: payload
    });
  }

  public async handleDispatchScheduledEvent(event: IDomainEvent): Promise<void> {
    const payload = event.payload || {};
    const dispatchId = payload.dispatchId || payload.id || 'dsp_unknown';
    const dispatchNumber = payload.dispatchNumber || 'DSP-UNKNOWN';
    const customerName = payload.customerName || 'Customer';

    const idempotencyKey = `DISPATCH_PENDING:${event.tenantId}:${dispatchId}`;
    const params = { dispatchNumber, customerName, dispatchId };

    await this.dispatchTemplatedNotification(event.tenantId, {
      templateId: 'DISPATCH_PENDING_APPROVAL',
      sourceEvent: event.name,
      sourceEntityType: 'DispatchConsignment',
      sourceEntityId: dispatchId,
      idempotencyKey,
      params,
      metadata: payload
    });
  }

  public async handleJobPausedEvent(event: IDomainEvent): Promise<void> {
    const payload = event.payload || {};
    const jobId = payload.jobId || payload.id || 'job_unknown';
    const jobNumber = payload.jobNumber || 'JOB-UNKNOWN';
    const heatLotNumber = payload.heatLotNumber || 'HL-UNKNOWN';
    const holdReason = payload.holdReason || payload.reason || 'Process parameters deviation';

    const idempotencyKey = `JOB_HOLD:${event.tenantId}:${jobId}`;
    const params = { jobNumber, heatLotNumber, holdReason, jobId };

    await this.dispatchTemplatedNotification(event.tenantId, {
      templateId: 'PRODUCTION_JOB_HELD',
      sourceEvent: event.name,
      sourceEntityType: 'ProductionJob',
      sourceEntityId: jobId,
      idempotencyKey,
      params,
      metadata: payload
    });
  }

  // ==========================================
  // Core Dispatch Engine (Idempotency, Channels & Filtering)
  // ==========================================

  public async dispatchTemplatedNotification(
    tenantId: string,
    options: {
      templateId: string;
      sourceEvent: string;
      sourceEntityType: string;
      sourceEntityId: string;
      idempotencyKey: string;
      params: Record<string, any>;
      metadata?: Record<string, any>;
    }
  ): Promise<NotificationDocument[] | null> {
    // 1. Idempotency Check (Prevent duplicate notification from re-published events)
    if (options.idempotencyKey) {
      const existing = await this.repo.findDuplicateByIdempotencyKey(tenantId, options.idempotencyKey);
      if (existing) {
        this.logger.debug(`[NotificationService] Duplicate event skipped for key: ${options.idempotencyKey}`);
        return null;
      }
    }

    const template = FACTORY_NOTIFICATION_TEMPLATES[options.templateId];
    if (!template) {
      this.logger.warn(`[NotificationService] Template ${options.templateId} not found`);
      return null;
    }

    const title = renderTemplateString(template.titleTemplate, options.params);
    const message = renderTemplateString(template.messageTemplate, options.params);
    const actionUrl = renderTemplateString(template.defaultActionUrlTemplate, options.params);

    const createdNotifications: NotificationDocument[] = [];

    // Dispatch to target roles
    for (const targetRole of template.targetRoles) {
      const notification = await this.repo.createNotification(tenantId, {
        recipientRole: targetRole,
        category: template.category,
        priority: template.priority,
        title,
        message,
        templateId: template.templateId,
        sourceEvent: options.sourceEvent,
        sourceEntityType: options.sourceEntityType,
        sourceEntityId: options.sourceEntityId,
        actionUrl,
        idempotencyKey: `${options.idempotencyKey}:${targetRole}`,
        metadata: options.metadata,
        isRead: false,
        isArchived: false,
        channelsSent: ['IN_APP', 'EMAIL']
      });

      // Execute simulated/pluggable email dispatch
      this.dispatchEmailNotification(notification);

      createdNotifications.push(notification);
    }

    return createdNotifications;
  }

  // ==========================================
  // Public Notification Queries & Actions
  // ==========================================

  public async getNotifications(
    tenantId: string,
    actor: IActorContext,
    query: QueryNotificationsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<NotificationDocument>> {
    return await this.repo.findNotificationsByRecipient(
      tenantId,
      actor.userId,
      actor.role,
      query,
      pagination
    );
  }

  public async getUnreadCount(tenantId: string, actor: IActorContext): Promise<{ unreadCount: number }> {
    const unreadCount = await this.repo.getUnreadNotificationCount(tenantId, actor.userId, actor.role);
    return { unreadCount };
  }

  public async markAsRead(tenantId: string, id: string, actor: IActorContext): Promise<NotificationDocument> {
    const notification = await this.repo.findNotificationById(tenantId, id);
    if (!notification) {
      throw new NotFoundError(`Notification with ID '${id}' not found`);
    }

    const updated = await this.repo.markNotificationAsRead(tenantId, id, actor.userId);
    return updated!;
  }

  public async markAllAsRead(tenantId: string, actor: IActorContext): Promise<{ modifiedCount: number }> {
    const modifiedCount = await this.repo.markAllNotificationsAsRead(tenantId, actor.userId, actor.role);
    return { modifiedCount };
  }

  public async getUserPreferences(tenantId: string, userId: string): Promise<NotificationPreferenceDocument> {
    let prefs = await this.repo.getUserPreferences(tenantId, userId);
    if (!prefs) {
      prefs = await this.repo.saveUserPreferences(tenantId, userId, {
        enabledChannels: ['IN_APP', 'EMAIL'],
        minimumPriority: 'LOW',
        isMuted: false
      });
    }
    return prefs;
  }

  public async updateUserPreferences(
    tenantId: string,
    actor: IActorContext,
    dto: UpdatePreferencesDto
  ): Promise<NotificationPreferenceDocument> {
    const beforeState = await this.getUserPreferences(tenantId, actor.userId);
    const updated = await this.repo.saveUserPreferences(tenantId, actor.userId, dto as any);

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'NOTIFICATION_PREFERENCES_UPDATED',
      entityType: 'NotificationPreference',
      entityId: updated.id,
      beforeState: beforeState.toJSON(),
      afterState: updated.toJSON(),
      metadata: { userId: actor.userId }
    });

    return updated;
  }

  public async broadcastAlert(
    tenantId: string,
    actor: IActorContext,
    dto: BroadcastAlertDto
  ): Promise<NotificationDocument> {
    const notification = await this.repo.createNotification(tenantId, {
      recipientRole: dto.targetRole,
      category: dto.category,
      priority: dto.priority,
      title: dto.title,
      message: dto.message,
      sourceEvent: 'System.AlertTriggered',
      sourceEntityType: 'SystemBroadcast',
      sourceEntityId: `broadcast_${Date.now()}`,
      actionUrl: dto.actionUrl || '/dashboard',
      metadata: dto.metadata,
      isRead: false,
      isArchived: false,
      channelsSent: ['IN_APP', 'EMAIL']
    });

    await auditService.record(tenantId, {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'NOTIFICATION_ALERT_BROADCAST',
      entityType: 'Notification',
      entityId: notification.id,
      afterState: notification.toJSON(),
      metadata: {
        title: dto.title,
        priority: dto.priority,
        targetRole: dto.targetRole
      }
    });

    this.dispatchEmailNotification(notification);

    return notification;
  }

  // ==========================================
  // Private Helper: Email Dispatcher
  // ==========================================

  private dispatchEmailNotification(notification: NotificationDocument): void {
    if (notification.channelsSent.includes('EMAIL')) {
      this.logger.info(
        `[EmailNotificationDispatcher] Sending notification email to role ${notification.recipientRole || 'BROADCAST'}: "${notification.title}"`
      );
      notification.emailSentAt = new Date();
    }
  }
}

export const notificationService = new NotificationService();
