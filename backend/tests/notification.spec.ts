import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/app.config.js';
import { notificationRepository } from '../src/modules/notification/notification.repository.js';
import { notificationService } from '../src/modules/notification/notification.service.js';
import { auditService } from '../src/modules/audit/audit.service.js';
import { roleRepository } from '../src/modules/rbac/role.repository.js';
import { DEFAULT_FACTORY_ROLES } from '../src/modules/rbac/rbac.constants.js';
import { DomainEvents } from '../src/core/constants/events.js';
import { eventBus } from '../src/core/events/domain-event-bus.js';

describe('Manufacturing Event-Driven Notification & Alerting Subsystem', () => {
  const app = createApp();
  const testTenant = 'tenant_heat_treat_001';
  const otherTenant = 'tenant_heat_treat_002';

  const generateToken = (userId: string, roles: string[], tenant: string = testTenant) => {
    return jwt.sign(
      { userId, tenantId: tenant, email: `${userId}@factory.com`, roles },
      config.auth.jwtSecret
    );
  };

  const mockNotification: any = {
    id: 'notif_001',
    tenantId: testTenant,
    recipientRole: 'METALLURGIST',
    category: 'QUALITY',
    priority: 'HIGH',
    title: 'QC Inspection Rejected: Job JOB-202608-0010',
    message: 'Quality inspection INSP-001 for Job JOB-202608-0010 was REJECTED: Hardness out of specification.',
    sourceEvent: 'QualityInspection.Rejected',
    sourceEntityType: 'QualityInspection',
    sourceEntityId: 'insp_001',
    actionUrl: '/quality/inspections/insp_001',
    isRead: false,
    isArchived: false,
    channelsSent: ['IN_APP', 'EMAIL'],
    createdAt: new Date(),
    toJSON: function () {
      return { ...this };
    }
  };

  beforeEach(() => {
    jest.spyOn(auditService, 'record').mockResolvedValue({} as any);
    jest.spyOn(roleRepository, 'seedDefaultRolesForTenant').mockResolvedValue([] as any);
    jest.spyOn(roleRepository, 'findRolesByCodes').mockImplementation(async (_tenantId, codes) => {
      return DEFAULT_FACTORY_ROLES.filter((r) => codes.includes(r.code)).map((r) => ({
        ...r,
        id: `role_${r.code}`,
        status: 'active'
      })) as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Event-to-Notification Reaction Flows', () => {
    it('should generate high-priority quality notification upon QC_REJECTED domain event', async () => {
      const createNotificationSpy = jest
        .spyOn(notificationRepository, 'createNotification')
        .mockResolvedValue(mockNotification);
      jest.spyOn(notificationRepository, 'findDuplicateByIdempotencyKey').mockResolvedValue(null);

      await notificationService.handleQcRejectedEvent({
        name: DomainEvents.QC_REJECTED,
        tenantId: testTenant,
        occurredAt: new Date(),
        payload: {
          inspectionId: 'insp_001',
          jobNumber: 'JOB-202608-0010',
          inspectionNumber: 'INSP-001',
          heatLotNumber: 'HL-4340-99',
          defectDetails: 'Surface hardness 42 HRC is below 58-62 HRC specification'
        }
      });

      expect(createNotificationSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          category: 'QUALITY',
          priority: 'HIGH',
          title: expect.stringContaining('QC Inspection Rejected'),
          sourceEntityType: 'QualityInspection',
          actionUrl: '/quality/inspections/insp_001'
        })
      );
    });

    it('should generate critical equipment alert upon MACHINE_BREAKDOWN_REPORTED domain event', async () => {
      const createNotificationSpy = jest
        .spyOn(notificationRepository, 'createNotification')
        .mockResolvedValue({ ...mockNotification, category: 'EQUIPMENT', priority: 'CRITICAL' });
      jest.spyOn(notificationRepository, 'findDuplicateByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(notificationRepository, 'checkRateLimitCooldown').mockResolvedValue(false);

      await notificationService.handleMachineBreakdownEvent({
        name: DomainEvents.MACHINE_BREAKDOWN_REPORTED,
        tenantId: testTenant,
        occurredAt: new Date(),
        payload: {
          machineId: 'furn_01',
          machineCode: 'FURNACE-VAC-01',
          machineName: 'Vacuum Hardening Furnace #1',
          bay: 'Bay 1',
          workOrderNumber: 'WO-EMERGENCY-01',
          failureDetails: 'Vacuum seal failure during 950C heating phase'
        }
      });

      expect(createNotificationSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          category: 'EQUIPMENT',
          priority: 'CRITICAL',
          title: expect.stringContaining('CRITICAL: Machine Breakdown'),
          actionUrl: '/machines/furn_01'
        })
      );
    });

    it('should generate critical alert when pyrometry calibration has expired', async () => {
      const createNotificationSpy = jest
        .spyOn(notificationRepository, 'createNotification')
        .mockResolvedValue({ ...mockNotification, category: 'PYROMETRY', priority: 'CRITICAL' });
      jest.spyOn(notificationRepository, 'findDuplicateByIdempotencyKey').mockResolvedValue(null);

      await notificationService.handlePyrometryCalibrationEvent({
        name: DomainEvents.MACHINE_CALIBRATION_LOGGED,
        tenantId: testTenant,
        occurredAt: new Date(),
        payload: {
          machineId: 'furn_02',
          machineCode: 'FURNACE-PIT-01',
          calibrationType: 'SAT',
          daysRemaining: 0 // Expired
        }
      });

      expect(createNotificationSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          category: 'PYROMETRY',
          priority: 'CRITICAL',
          title: expect.stringContaining('EXPIRED on FURNACE-PIT-01'),
          actionUrl: '/pyrometry/furn_02'
        })
      );
    });

    it('should generate material shortage alert when stock is below safety threshold', async () => {
      const createNotificationSpy = jest
        .spyOn(notificationRepository, 'createNotification')
        .mockResolvedValue({ ...mockNotification, category: 'INVENTORY', priority: 'HIGH' });
      jest.spyOn(notificationRepository, 'findDuplicateByIdempotencyKey').mockResolvedValue(null);
      jest.spyOn(notificationRepository, 'checkRateLimitCooldown').mockResolvedValue(false);

      await notificationService.handleLowStockAlertEvent({
        name: DomainEvents.INVENTORY_LOW_STOCK_ALERT,
        tenantId: testTenant,
        occurredAt: new Date(),
        payload: {
          itemId: 'item_01',
          itemCode: 'BAR-4340-50MM',
          itemName: 'AISI 4340 Round Bar 50mm',
          currentStock: 12,
          safetyStock: 50,
          uom: 'KG'
        }
      });

      expect(createNotificationSpy).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          category: 'INVENTORY',
          priority: 'HIGH',
          title: expect.stringContaining('Material Shortage Alert'),
          actionUrl: '/inventory/items/item_01'
        })
      );
    });
  });

  describe('Duplicate Prevention & Notification Storm Throttling', () => {
    it('should suppress duplicate notifications for the same idempotency key', async () => {
      const createNotificationSpy = jest.spyOn(notificationRepository, 'createNotification');
      jest
        .spyOn(notificationRepository, 'findDuplicateByIdempotencyKey')
        .mockResolvedValue(mockNotification);

      const result = await notificationService.dispatchTemplatedNotification(testTenant, {
        templateId: 'QC_INSPECTION_REJECTED',
        sourceEvent: 'QualityInspection.Rejected',
        sourceEntityType: 'QualityInspection',
        sourceEntityId: 'insp_001',
        idempotencyKey: 'QC_REJECTED:tenant_heat_treat_001:insp_001',
        params: { jobNumber: 'JOB-01', inspectionNumber: 'INSP-01', heatLotNumber: 'HL-01', defectDetails: 'Hardness out of spec', inspectionId: 'insp_001' }
      });

      expect(result).toBeNull();
      expect(createNotificationSpy).not.toHaveBeenCalled();
    });

    it('should throttle repetitive sensor alerts during rate limit cooldown window', async () => {
      const createNotificationSpy = jest.spyOn(notificationRepository, 'createNotification');
      jest.spyOn(notificationRepository, 'checkRateLimitCooldown').mockResolvedValue(true); // in cooldown

      await notificationService.handleMachineBreakdownEvent({
        name: DomainEvents.MACHINE_BREAKDOWN_REPORTED,
        tenantId: testTenant,
        occurredAt: new Date(),
        payload: {
          machineId: 'furn_01',
          machineCode: 'FURNACE-VAC-01'
        }
      });

      expect(createNotificationSpy).not.toHaveBeenCalled();
    });
  });

  describe('Notification Feed & Read Status Management', () => {
    it('should retrieve paginated notifications for logged-in user', async () => {
      const token = generateToken('usr_metallurgist', ['METALLURGIST']);

      jest.spyOn(notificationRepository, 'findNotificationsByRecipient').mockResolvedValue({
        items: [mockNotification],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].category).toBe('QUALITY');
    });

    it('should return unread notification count', async () => {
      const token = generateToken('usr_metallurgist', ['METALLURGIST']);

      jest.spyOn(notificationRepository, 'getUnreadNotificationCount').mockResolvedValue(5);

      const res = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(5);
    });

    it('should mark a single notification as read', async () => {
      const token = generateToken('usr_metallurgist', ['METALLURGIST']);

      const readNotification = { ...mockNotification, isRead: true, readAt: new Date() };
      jest.spyOn(notificationRepository, 'findNotificationById').mockResolvedValue(mockNotification);
      jest.spyOn(notificationRepository, 'markNotificationAsRead').mockResolvedValue(readNotification);

      const res = await request(app)
        .post('/api/v1/notifications/notif_001/read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      const token = generateToken('usr_metallurgist', ['METALLURGIST']);

      jest.spyOn(notificationRepository, 'markAllNotificationsAsRead').mockResolvedValue(4);

      const res = await request(app)
        .post('/api/v1/notifications/mark-all-read')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.modifiedCount).toBe(4);
    });
  });

  describe('User Preferences & Broadcast Alerts', () => {
    it('should update user notification preferences with audit record', async () => {
      const token = generateToken('usr_metallurgist', ['METALLURGIST']);

      const mockPrefs: any = {
        tenantId: testTenant,
        userId: 'usr_metallurgist',
        enabledChannels: ['IN_APP'],
        minimumPriority: 'HIGH',
        categorySubscriptions: { QUALITY: true, EQUIPMENT: true },
        isMuted: false,
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(notificationRepository, 'getUserPreferences').mockResolvedValue(mockPrefs);
      jest.spyOn(notificationRepository, 'saveUserPreferences').mockResolvedValue(mockPrefs);

      const res = await request(app)
        .put('/api/v1/notifications/preferences/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          enabledChannels: ['IN_APP'],
          minimumPriority: 'HIGH'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.minimumPriority).toBe('HIGH');
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'NOTIFICATION_PREFERENCES_UPDATED',
          entityType: 'NotificationPreference'
        })
      );
    });

    it('should allow authorized plant manager to broadcast factory alert', async () => {
      const token = generateToken('usr_plant_mgr', ['PLANT_MANAGER']);

      const broadcastNotification: any = {
        id: 'notif_broadcast_01',
        tenantId: testTenant,
        category: 'EQUIPMENT',
        priority: 'CRITICAL',
        title: 'PLANT SHUTDOWN DRILL',
        message: 'Annual emergency power generator switchover scheduled at 14:00.',
        sourceEvent: 'System.AlertTriggered',
        sourceEntityType: 'SystemBroadcast',
        actionUrl: '/dashboard',
        channelsSent: ['IN_APP', 'EMAIL'],
        toJSON: function () {
          return { ...this };
        }
      };

      jest.spyOn(notificationRepository, 'createNotification').mockResolvedValue(broadcastNotification);

      const res = await request(app)
        .post('/api/v1/notifications/broadcast')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'EQUIPMENT',
          priority: 'CRITICAL',
          title: 'PLANT SHUTDOWN DRILL',
          message: 'Annual emergency power generator switchover scheduled at 14:00.',
          actionUrl: '/dashboard'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('PLANT SHUTDOWN DRILL');
      expect(auditService.record).toHaveBeenCalledWith(
        testTenant,
        expect.objectContaining({
          action: 'NOTIFICATION_ALERT_BROADCAST',
          entityType: 'Notification'
        })
      );
    });
  });

  describe('Tenant Isolation & Authorization', () => {
    it('should reject unauthenticated requests to notifications', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('should reject broadcast alerts from unauthorized roles', async () => {
      const operatorToken = generateToken('usr_furnace_op', ['FURNACE_OPERATOR']);

      const res = await request(app)
        .post('/api/v1/notifications/broadcast')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          category: 'EQUIPMENT',
          priority: 'HIGH',
          title: 'Test',
          message: 'Test message'
        });

      expect(res.status).toBe(403);
    });
  });
});
