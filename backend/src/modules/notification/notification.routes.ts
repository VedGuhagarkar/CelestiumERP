import { Router } from 'express';
import { notificationController } from './notification.controller.js';
import { authenticateJwt } from '../../core/middleware/auth.middleware.js';
import {
  requirePermission,
  requireAnyPermission
} from '../../core/middleware/rbac.middleware.js';
import { validateRequest } from '../../core/middleware/validate.middleware.js';
import { PERMISSIONS } from '../rbac/rbac.constants.js';
import {
  queryNotificationsSchema,
  updatePreferencesSchema,
  broadcastAlertSchema
} from './notification.validator.js';

export const notificationRouter = Router();

notificationRouter.use(authenticateJwt);

// ==========================================
// User Notification Feed & Actions
// ==========================================

notificationRouter.get(
  '/',
  requirePermission(PERMISSIONS.NOTIFICATION_VIEW),
  validateRequest({ query: queryNotificationsSchema }),
  notificationController.getNotifications
);

notificationRouter.get(
  '/unread-count',
  requirePermission(PERMISSIONS.NOTIFICATION_VIEW),
  notificationController.getUnreadCount
);

notificationRouter.post(
  '/mark-all-read',
  requirePermission(PERMISSIONS.NOTIFICATION_VIEW),
  notificationController.markAllAsRead
);

notificationRouter.post(
  '/:id/read',
  requirePermission(PERMISSIONS.NOTIFICATION_VIEW),
  notificationController.markAsRead
);

// ==========================================
// User Preferences Endpoints
// ==========================================

notificationRouter.get(
  '/preferences/me',
  requirePermission(PERMISSIONS.NOTIFICATION_PREFERENCES_UPDATE),
  notificationController.getUserPreferences
);

notificationRouter.put(
  '/preferences/me',
  requirePermission(PERMISSIONS.NOTIFICATION_PREFERENCES_UPDATE),
  validateRequest({ body: updatePreferencesSchema }),
  notificationController.updateUserPreferences
);

// ==========================================
// Admin & Manager Alert Broadcast
// ==========================================

notificationRouter.post(
  '/broadcast',
  requirePermission(PERMISSIONS.NOTIFICATION_BROADCAST),
  validateRequest({ body: broadcastAlertSchema }),
  notificationController.broadcastAlert
);
