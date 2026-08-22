import { model } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { RoleDocument } from './rbac.types.js';

const roleSchema = createBaseSchema<RoleDocument>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    permissions: {
      type: [String],
      required: true,
      default: []
    },
    isSystemRole: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
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

// Enforce tenant-unique role code
IndexRegistry.addTenantUniqueIndex(roleSchema, 'code');
IndexRegistry.addStatusFilterIndex(roleSchema, 'status');

export const RoleModel = model<RoleDocument>('Role', roleSchema);
export type { RoleDocument };
