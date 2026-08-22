import { model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { UserDocument } from './auth.types.js';

const userSchema = createBaseSchema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true
    },
    roles: {
      type: [String],
      default: ['operator']
    },
    lastLoginAt: {
      type: Date
    },
    passwordChangedAt: {
      type: Date
    },
    resetPasswordToken: {
      type: String
    },
    resetPasswordExpires: {
      type: Date
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
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
          delete ret.passwordHash;
          delete ret.resetPasswordToken;
          delete ret.resetPasswordExpires;
        }
        return ret;
      }
    }
  }
);

// Enforce tenant-unique email and username
IndexRegistry.addTenantUniqueIndex(userSchema, 'email');
IndexRegistry.addTenantUniqueIndex(userSchema, 'username');
IndexRegistry.addStatusFilterIndex(userSchema, 'status');

export const UserModel = model<UserDocument>('User', userSchema);
export type { UserDocument };
