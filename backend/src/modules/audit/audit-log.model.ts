import { model, Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { AuditLogDocument } from './audit.types.js';

const auditLogSchema = createBaseSchema<AuditLogDocument>(
  {
    actorId: {
      type: String,
      required: true,
      index: true
    },
    actorEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    actorRole: {
      type: String,
      trim: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    beforeState: {
      type: Schema.Types.Mixed,
      default: null
    },
    afterState: {
      type: Schema.Types.Mixed,
      default: null
    },
    diff: {
      type: Schema.Types.Mixed,
      default: null
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      default: 'SUCCESS',
      index: true
    },
    errorMessage: {
      type: String,
      default: null
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    correlationId: {
      type: String,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret && typeof ret === 'object') {
          if (ret._id) {
            ret.id = ret._id.toString();
          }
          delete ret._id;
          delete ret.__v;
        }
        return ret;
      }
    }
  }
);

// High-velocity compound indexes for regulatory traceability and audit search
auditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, occurredAt: -1 });
auditLogSchema.index({ tenantId: 1, actorId: 1, occurredAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, occurredAt: -1 });
auditLogSchema.index({ tenantId: 1, occurredAt: -1 });

export const AuditLogModel = model<AuditLogDocument>('AuditLog', auditLogSchema);
export type { AuditLogDocument };
