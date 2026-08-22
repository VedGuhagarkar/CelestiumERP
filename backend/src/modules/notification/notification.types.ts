export type NotificationCategory =
  | 'QUALITY'
  | 'EQUIPMENT'
  | 'MAINTENANCE'
  | 'PYROMETRY'
  | 'INVENTORY'
  | 'PRODUCTION'
  | 'DISPATCH'
  | 'FINANCE'
  | 'WORKFORCE'
  | 'SECURITY';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type NotificationChannel = 'IN_APP' | 'EMAIL';

export interface INotificationRecipient {
  userId?: string;
  email?: string;
  role?: string;
}

export interface INotification {
  tenantId: string;
  recipientUserId?: string;
  recipientRole?: string;
  recipientEmail?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  templateId?: string;
  sourceEvent: string;
  sourceEntityType: string;
  sourceEntityId: string;
  actionUrl: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: Date | null;
  isArchived: boolean;
  channelsSent: NotificationChannel[];
  emailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserNotificationPreferences {
  tenantId: string;
  userId: string;
  email?: string;
  enabledChannels: NotificationChannel[];
  categorySubscriptions: Record<NotificationCategory, boolean>;
  minimumPriority: NotificationPriority;
  isMuted: boolean;
  mutedUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryNotificationsDto {
  isRead?: boolean;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface UpdatePreferencesDto {
  enabledChannels?: NotificationChannel[];
  categorySubscriptions?: Partial<Record<NotificationCategory, boolean>>;
  minimumPriority?: NotificationPriority;
  isMuted?: boolean;
  mutedUntil?: string | null;
}

export interface BroadcastAlertDto {
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  targetRole?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface INotificationTemplate {
  templateId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  titleTemplate: string;
  messageTemplate: string;
  defaultActionUrlTemplate: string;
  targetRoles: string[];
}
