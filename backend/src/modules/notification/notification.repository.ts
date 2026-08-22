import mongoose from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationPreference,
  NotificationPreferenceDocument
} from './notification.model.js';
import {
  INotification,
  IUserNotificationPreferences,
  QueryNotificationsDto
} from './notification.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export interface INotificationRepository {
  createNotification(tenantId: string, data: Partial<INotification>): Promise<NotificationDocument>;
  findNotificationById(tenantId: string, id: string): Promise<NotificationDocument | null>;
  findNotificationsByRecipient(
    tenantId: string,
    userId: string,
    role: string | undefined,
    query: QueryNotificationsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<NotificationDocument>>;
  getUnreadNotificationCount(tenantId: string, userId: string, role?: string): Promise<number>;
  markNotificationAsRead(
    tenantId: string,
    id: string,
    userId?: string
  ): Promise<NotificationDocument | null>;
  markAllNotificationsAsRead(tenantId: string, userId: string, role?: string): Promise<number>;
  findDuplicateByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string
  ): Promise<NotificationDocument | null>;
  getUserPreferences(
    tenantId: string,
    userId: string
  ): Promise<NotificationPreferenceDocument | null>;
  saveUserPreferences(
    tenantId: string,
    userId: string,
    data: Partial<IUserNotificationPreferences>
  ): Promise<NotificationPreferenceDocument>;
  checkRateLimitCooldown(
    tenantId: string,
    category: string,
    sourceEntityId: string,
    cooldownSeconds: number
  ): Promise<boolean>;
}

export class NotificationRepository implements INotificationRepository {
  public async createNotification(
    tenantId: string,
    data: Partial<INotification>
  ): Promise<NotificationDocument> {
    const notification = new Notification({
      ...data,
      tenantId
    });
    return await notification.save();
  }

  public async findNotificationById(
    tenantId: string,
    id: string
  ): Promise<NotificationDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || mongoose.connection.readyState === 0) {
      return null;
    }
    return await Notification.findOne({ _id: id, tenantId });
  }

  public async findNotificationsByRecipient(
    tenantId: string,
    userId: string,
    role: string | undefined,
    query: QueryNotificationsDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<NotificationDocument>> {
    if (mongoose.connection.readyState === 0) {
      return { items: [], total: 0, page: pagination.page || 1, limit: pagination.limit || 20, totalPages: 0 };
    }

    const recipientFilter: Record<string, any>[] = [{ recipientUserId: userId }];
    if (role) {
      recipientFilter.push({ recipientRole: role });
    }
    // Also include global broadcast notifications
    recipientFilter.push({ recipientUserId: null, recipientRole: null });

    const filterCriteria: Record<string, any> = {
      tenantId,
      isArchived: false,
      $or: recipientFilter
    };

    if (query.isRead !== undefined) {
      filterCriteria.isRead = query.isRead;
    }

    if (query.category) {
      filterCriteria.category = query.category;
    }

    if (query.priority) {
      filterCriteria.priority = query.priority;
    }

    if (query.startDate || query.endDate) {
      filterCriteria.createdAt = {};
      if (query.startDate) filterCriteria.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) filterCriteria.createdAt.$lte = new Date(query.endDate);
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filterCriteria.$and = [
        {
          $or: [
            { title: searchRegex },
            { message: searchRegex },
            { sourceEntityType: searchRegex },
            { sourceEntityId: searchRegex }
          ]
        }
      ];
    }

    const page = Math.max(pagination.page || 1, 1);
    const limit = Math.max(pagination.limit || 20, 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Notification.find(filterCriteria).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filterCriteria)
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async getUnreadNotificationCount(
    tenantId: string,
    userId: string,
    role?: string
  ): Promise<number> {
    if (mongoose.connection.readyState === 0) return 0;

    const recipientFilter: Record<string, any>[] = [{ recipientUserId: userId }];
    if (role) {
      recipientFilter.push({ recipientRole: role });
    }
    recipientFilter.push({ recipientUserId: null, recipientRole: null });

    return await Notification.countDocuments({
      tenantId,
      isRead: false,
      isArchived: false,
      $or: recipientFilter
    });
  }

  public async markNotificationAsRead(
    tenantId: string,
    id: string,
    _userId?: string
  ): Promise<NotificationDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || mongoose.connection.readyState === 0) {
      return null;
    }

    return await Notification.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
  }

  public async markAllNotificationsAsRead(
    tenantId: string,
    userId: string,
    role?: string
  ): Promise<number> {
    if (mongoose.connection.readyState === 0) return 0;

    const recipientFilter: Record<string, any>[] = [{ recipientUserId: userId }];
    if (role) {
      recipientFilter.push({ recipientRole: role });
    }
    recipientFilter.push({ recipientUserId: null, recipientRole: null });

    const result = await Notification.updateMany(
      {
        tenantId,
        isRead: false,
        isArchived: false,
        $or: recipientFilter
      },
      {
        $set: { isRead: true, readAt: new Date() }
      }
    );

    return result.modifiedCount;
  }

  public async findDuplicateByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string
  ): Promise<NotificationDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await Notification.findOne({ tenantId, idempotencyKey });
  }

  public async getUserPreferences(
    tenantId: string,
    userId: string
  ): Promise<NotificationPreferenceDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await NotificationPreference.findOne({ tenantId, userId });
  }

  public async saveUserPreferences(
    tenantId: string,
    userId: string,
    data: Partial<IUserNotificationPreferences>
  ): Promise<NotificationPreferenceDocument> {
    const existing = await NotificationPreference.findOne({ tenantId, userId });
    if (existing) {
      Object.assign(existing, data);
      return await existing.save();
    }

    const created = new NotificationPreference({
      ...data,
      tenantId,
      userId
    });
    return await created.save();
  }

  public async checkRateLimitCooldown(
    tenantId: string,
    category: string,
    sourceEntityId: string,
    cooldownSeconds: number
  ): Promise<boolean> {
    if (mongoose.connection.readyState === 0) return false;
    const cooldownThreshold = new Date(Date.now() - cooldownSeconds * 1000);

    const recent = await Notification.findOne({
      tenantId,
      category,
      sourceEntityId,
      createdAt: { $gte: cooldownThreshold }
    });

    // Returns true if rate limited (in cooldown)
    return Boolean(recent);
  }
}

export const notificationRepository = new NotificationRepository();
