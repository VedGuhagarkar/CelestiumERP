import { model, Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { RefreshTokenDocument } from './auth.types.js';

const refreshTokenSchema = createBaseSchema<RefreshTokenDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      index: true
    },
    familyId: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index automatically cleans up expired tokens
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    replacedByToken: {
      type: String
    },
    userAgent: {
      type: String
    },
    ipAddress: {
      type: String
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
          delete ret.tokenHash;
        }
        return ret;
      }
    }
  }
);

// Compound indexes for high-speed token validation and user session lookup
refreshTokenSchema.index({ tenantId: 1, tokenHash: 1 });
refreshTokenSchema.index({ tenantId: 1, userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ tenantId: 1, familyId: 1 });

export const RefreshTokenModel = model<RefreshTokenDocument>('RefreshToken', refreshTokenSchema);
export type { RefreshTokenDocument };
