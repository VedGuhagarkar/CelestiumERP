import { Schema, SchemaDefinition, SchemaOptions } from 'mongoose';
import { softDeletePlugin } from '../plugins/soft-delete.plugin.js';

/**
 * Base Schema Factory
 * Automatically applies tenant isolation index, soft-delete plugin, timestamps, and JSON transformation.
 *
 * ARCHITECTURAL CONTRACT:
 * - Models are pure schema definitions and database constraints.
 * - Models MUST NOT contain service-layer business logic or algorithms.
 * - Models MUST enforce compound tenant indexes (e.g. { tenantId: 1, code: 1 }).
 * - Models MUST NOT import Services, Repositories, Controllers, or Routes.
 * Reference: CelestiumERP.md Section 1.1, 1.5 & 1.9
 */

export function createBaseSchema<T = any>(
  definition: SchemaDefinition<T> | Record<string, any>,
  options: SchemaOptions = {}
): Schema<T> {
  const baseDefinition = {
    tenantId: {
      type: String,
      required: true,
      index: true
    },
    ...definition
  };

  const baseOptions: SchemaOptions = {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        if (ret && typeof ret === 'object') {
          if (ret._id) {
            ret.id = ret._id.toString();
          }
          delete ret._id;
          delete ret.__v;
        }
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: (_doc: any, ret: any) => {
        if (ret && typeof ret === 'object') {
          if (ret._id) {
            ret.id = ret._id.toString();
          }
          delete ret._id;
          delete ret.__v;
        }
        return ret;
      }
    },
    ...options
  };

  const schema = new Schema(baseDefinition as any, baseOptions) as unknown as Schema<T>;

  // Apply tenant-aware soft-delete plugin automatically
  schema.plugin(softDeletePlugin);

  return schema;
}
