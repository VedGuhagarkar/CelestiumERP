import { Schema, Document, Query } from 'mongoose';

/**
 * Soft Delete Mongoose Plugin
 * Reference: CelestiumERP.md Section 1.5
 */

export interface ISoftDeletable {
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: string | null;
}

export function softDeletePlugin(schema: Schema): void {
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: String,
      default: null
    }
  });

  // Query middleware: filter out soft-deleted records by default unless explicitly requested
  const excludeDeleted = function (this: Query<any, any>) {
    const currentFilter = this.getFilter();
    if (currentFilter.isDeleted === undefined) {
      this.where({ isDeleted: false });
    }
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('updateMany', excludeDeleted);
  schema.pre('distinct', excludeDeleted);
  schema.pre('count' as any, excludeDeleted);

  // Aggregation middleware: filter out soft-deleted records in aggregation pipelines
  schema.pre('aggregate', function () {
    const pipeline = this.pipeline();
    const hasIsDeletedMatch = pipeline.some(
      (stage: any) => stage.$match && stage.$match.isDeleted !== undefined
    );
    if (!hasIsDeletedMatch) {
      if (
        pipeline.length > 0 &&
        (pipeline[0].$geoNear || pipeline[0].$collStats || pipeline[0].$indexStats)
      ) {
        pipeline.splice(1, 0, { $match: { isDeleted: false } });
      } else {
        pipeline.unshift({ $match: { isDeleted: false } });
      }
    }
  });

  // Schema instance methods
  schema.methods.softDelete = function (deletedBy?: string) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy || null;
    return this.save();
  };

  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}
