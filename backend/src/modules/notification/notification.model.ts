import mongoose, { Schema, Document } from 'mongoose';
import { INotification, IUserNotificationPreferences } from './notification.types.js';

export interface NotificationDocument extends INotification, Document {}
export interface NotificationPreferenceDocument extends IUserNotificationPreferences, Document {}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    recipientUserId: { type: String, index: true },
    recipientRole: { type: String, index: true },
    recipientEmail: { type: String },
    category: {
      type: String,
      required: true,
      enum: [
        'QUALITY',
        'EQUIPMENT',
        'MAINTENANCE',
        'PYROMETRY',
        'INVENTORY',
        'PRODUCTION',
        'DISPATCH',
        'FINANCE',
        'WORKFORCE',
        'SECURITY'
      ],
      index: true
    },
    priority: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
      default: 'MEDIUM',
      index: true
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    templateId: { type: String },
    sourceEvent: { type: String, required: true, index: true },
    sourceEntityType: { type: String, required: true, index: true },
    sourceEntityId: { type: String, required: true, index: true },
    actionUrl: { type: String, required: true },
    idempotencyKey: { type: String, index: true, sparse: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    isArchived: { type: Boolean, default: false, index: true },
    channelsSent: [{ type: String, enum: ['IN_APP', 'EMAIL'] }],
    emailSentAt: { type: Date }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

NotificationSchema.index({ tenantId: 1, recipientUserId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ tenantId: 1, recipientRole: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ tenantId: 1, idempotencyKey: 1 }, { sparse: true });
NotificationSchema.index({ tenantId: 1, category: 1, sourceEntityId: 1, createdAt: -1 });

const NotificationPreferenceSchema = new Schema<NotificationPreferenceDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    email: { type: String },
    enabledChannels: {
      type: [String],
      enum: ['IN_APP', 'EMAIL'],
      default: ['IN_APP', 'EMAIL']
    },
    categorySubscriptions: {
      type: Map,
      of: Boolean,
      default: {
        QUALITY: true,
        EQUIPMENT: true,
        MAINTENANCE: true,
        PYROMETRY: true,
        INVENTORY: true,
        PRODUCTION: true,
        DISPATCH: true,
        FINANCE: true,
        WORKFORCE: true,
        SECURITY: true
      }
    },
    minimumPriority: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
      default: 'LOW'
    },
    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date, default: null }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

NotificationPreferenceSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const Notification = mongoose.model<NotificationDocument>(
  'Notification',
  NotificationSchema
);

export const NotificationPreference = mongoose.model<NotificationPreferenceDocument>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
