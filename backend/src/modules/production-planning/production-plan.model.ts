import mongoose, { Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { ProductionPlanDocument } from './production-plan.types.js';

const planCustomerSchema = new Schema(
  {
    customerId: { type: String, required: true },
    customerCode: { type: String, required: true, uppercase: true },
    customerName: { type: String, required: true }
  },
  { _id: false }
);

const planItemSchema = new Schema(
  {
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true, uppercase: true },
    itemName: { type: String, required: true },
    materialGrade: { type: String, required: true },
    uom: { type: String, required: true }
  },
  { _id: false }
);

const planRecipeSchema = new Schema(
  {
    recipeId: { type: String, required: true },
    recipeCode: { type: String, required: true, uppercase: true },
    recipeRevision: { type: Number, required: true },
    processFamily: { type: String, required: true }
  },
  { _id: false }
);

const planSpecificationSchema = new Schema(
  {
    specificationId: { type: String, required: true },
    specCode: { type: String, required: true, uppercase: true },
    specRevision: { type: Number, required: true }
  },
  { _id: false }
);

const planQuantityTargetsSchema = new Schema(
  {
    plannedQuantity: { type: Number, required: true, min: 1 },
    scheduledQuantity: { type: Number, default: 0, min: 0 },
    inProgressQuantity: { type: Number, default: 0, min: 0 },
    completedQuantity: { type: Number, default: 0, min: 0 },
    scrappedQuantity: { type: Number, default: 0, min: 0 },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 }
  },
  { _id: false }
);

const planTimelineSchema = new Schema(
  {
    plannedStartDate: { type: Date, required: true },
    targetCompletionDate: { type: Date, required: true },
    actualStartDate: { type: Date, default: null },
    actualCompletionDate: { type: Date, default: null }
  },
  { _id: false }
);

const planConstraintsSchema = new Schema(
  {
    materialAvailability: {
      type: String,
      enum: ['AVAILABLE', 'PARTIALLY_AVAILABLE', 'PENDING_INWARD', 'BLOCKED_QUARANTINE'],
      default: 'PENDING_INWARD'
    },
    availableStockQuantity: { type: Number, default: 0, min: 0 },
    requiredHeatLotNumber: { type: String, default: null },
    compatibleFurnaceTypes: { type: [String], default: [] },
    estimatedFurnaceHours: { type: Number, default: 0, min: 0 },
    operatorCertificationsRequired: { type: [String], default: [] },
    maxBatchWeightKg: { type: Number, default: null }
  },
  { _id: false }
);

const productionPlanSchema = createBaseSchema<ProductionPlanDocument>({
  planNumber: { type: String, required: true, uppercase: true },
  title: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['DRAFT', 'PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'],
    default: 'DRAFT'
  },
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'AOG_CRITICAL'],
    default: 'NORMAL'
  },
  customer: { type: planCustomerSchema, required: true },
  item: { type: planItemSchema, required: true },
  recipe: { type: planRecipeSchema, required: true },
  specification: { type: planSpecificationSchema, required: true },
  quantityTargets: { type: planQuantityTargetsSchema, required: true },
  timeline: { type: planTimelineSchema, required: true },
  constraints: { type: planConstraintsSchema, required: true },
  assignedJobCardIds: { type: [String], default: [] },
  notes: { type: String, default: null },
  statusReason: { type: String, default: null },
  createdByActorId: { type: String, required: true },
  updatedByActorId: { type: String, default: null }
});

productionPlanSchema.index({ tenantId: 1, planNumber: 1 }, { unique: true });
productionPlanSchema.index({ tenantId: 1, status: 1 });
productionPlanSchema.index({ tenantId: 1, priority: 1 });
productionPlanSchema.index({ tenantId: 1, 'customer.customerCode': 1 });
productionPlanSchema.index({ tenantId: 1, 'item.itemCode': 1 });
productionPlanSchema.index({ tenantId: 1, 'recipe.recipeCode': 1 });
productionPlanSchema.index({ tenantId: 1, 'timeline.targetCompletionDate': 1 });

export const ProductionPlanModel =
  mongoose.models.ProductionPlan ||
  mongoose.model<ProductionPlanDocument>('ProductionPlan', productionPlanSchema);
