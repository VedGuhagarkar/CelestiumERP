import mongoose from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { MaterialReservationDocument } from './material-requirements.types.js';

const materialReservationSchema = createBaseSchema<MaterialReservationDocument>({
  reservationNumber: { type: String, required: true, uppercase: true },
  planId: { type: String, required: true },
  planNumber: { type: String, required: true, uppercase: true },
  jobCardId: { type: String, default: null },
  jobCardNumber: { type: String, default: null, uppercase: true },
  targetType: {
    type: String,
    enum: ['HEAT_LOT', 'INVENTORY_ITEM'],
    required: true
  },
  targetId: { type: String, required: true },
  targetIdentifier: { type: String, required: true, uppercase: true },
  itemId: { type: String, required: true },
  itemCode: { type: String, required: true, uppercase: true },
  materialGrade: { type: String, required: true },
  reservedQuantity: { type: Number, required: true, min: 0.001 },
  uom: { type: String, required: true },
  status: {
    type: String,
    enum: ['ACTIVE', 'CONSUMED', 'RELEASED'],
    default: 'ACTIVE'
  },
  reservedByActorId: { type: String, required: true },
  releasedByActorId: { type: String, default: null },
  releaseReason: { type: String, default: null },
  releasedAt: { type: Date, default: null },
  consumedAt: { type: Date, default: null },
  notes: { type: String, default: null }
});

materialReservationSchema.index({ tenantId: 1, reservationNumber: 1 }, { unique: true });
materialReservationSchema.index({ tenantId: 1, planId: 1, status: 1 });
materialReservationSchema.index({ tenantId: 1, targetType: 1, targetId: 1, status: 1 });
materialReservationSchema.index({ tenantId: 1, itemCode: 1, status: 1 });

export const MaterialReservationModel =
  mongoose.models.MaterialReservation ||
  mongoose.model<MaterialReservationDocument>('MaterialReservation', materialReservationSchema);
