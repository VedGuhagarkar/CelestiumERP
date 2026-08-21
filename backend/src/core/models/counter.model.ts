import mongoose, { Schema, Document } from 'mongoose';

/**
 * Atomic Sequential Counter Model
 * Reference: CelestiumERP.md Section 1.4
 */

export interface ICounter extends Document {
  tenantId: string;
  domain: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    tenantId: {
      type: String,
      required: true,
      index: true
    },
    domain: {
      type: String,
      required: true
    },
    seq: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'counters'
  }
);

// Compound unique index per tenant and domain
CounterSchema.index({ tenantId: 1, domain: 1 }, { unique: true });

export const CounterModel = mongoose.model<ICounter>('Counter', CounterSchema);
