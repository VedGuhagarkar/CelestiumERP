import { model, Schema } from 'mongoose';
import { createBaseSchema } from '../../core/models/base.schema.js';
import { IndexRegistry } from '../../core/database/index-registry.js';
import { RecipeDocument } from './recipe.types.js';

const atmosphereControlSubSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'CARBON_POTENTIAL',
        'NITRIDING_POTENTIAL_KN',
        'ENDOTHERMIC',
        'NITROGEN_PURGE',
        'VACUUM',
        'HYDROGEN'
      ]
    },
    setpoint: { type: Number, required: true },
    tolerance: { type: Number, default: 0.05 }
  },
  { _id: false }
);

const quenchParametersSubSchema = new Schema(
  {
    medium: {
      type: String,
      required: true,
      enum: [
        'FAST_QUENCH_OIL',
        'MARTEMPERING_OIL',
        'POLYMER_QUENCH',
        'WATER',
        'BRINE',
        'HIGH_PRESSURE_GAS_N2',
        'HIGH_PRESSURE_GAS_HE',
        'AIR_COOL',
        'FURNACE_COOL'
      ]
    },
    targetTemperatureC: { type: Number, required: true },
    agitationSpeedPercent: { type: Number, min: 0, max: 100 },
    quenchDurationSeconds: { type: Number, min: 0 },
    gasQuenchPressureBar: { type: Number, min: 0 }
  },
  { _id: false }
);

const recipeStageSubSchema = new Schema(
  {
    sequence: { type: Number, required: true },
    stageName: { type: String, required: true, trim: true },
    targetTemperatureC: { type: Number, required: true },
    temperatureToleranceMinusC: { type: Number, required: true, default: 5 },
    temperatureTolerancePlusC: { type: Number, required: true, default: 5 },
    rampRateCPerMin: { type: Number },
    soakTimeMinutes: { type: Number, required: true },
    soakCriteria: {
      type: String,
      enum: ['LOAD_THERMOCOUPLE_REACHED', 'FURNACE_ZONE_REACHED', 'FIXED_TIME'],
      default: 'FIXED_TIME'
    },
    atmosphereControl: { type: atmosphereControlSubSchema },
    quenchParameters: { type: quenchParametersSubSchema }
  },
  { _id: false }
);

const metallurgicalTargetsSubSchema = new Schema(
  {
    targetHardnessMin: { type: Number, required: true },
    targetHardnessMax: { type: Number, required: true },
    hardnessScale: {
      type: String,
      required: true,
      enum: ['HRC', 'HRB', 'HRA', 'HV1', 'HV5', 'HV10', 'HV30', 'HBW']
    },
    effectiveCaseDepthMinMm: { type: Number },
    effectiveCaseDepthMaxMm: { type: Number },
    caseDepthCutoffHRC: { type: Number },
    totalCaseDepthMinMm: { type: Number },
    totalCaseDepthMaxMm: { type: Number },
    coreHardnessMin: { type: Number },
    coreHardnessMax: { type: Number },
    coreHardnessScale: { type: String },
    microstructureRequirements: { type: String, trim: true }
  },
  { _id: false }
);

const machineRequirementsSubSchema = new Schema(
  {
    compatibleFurnaceTypes: { type: [String], required: true },
    minimumFurnaceClass: {
      type: String,
      enum: ['CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5']
    },
    maxOperatingTempRequiredC: { type: Number, required: true }
  },
  { _id: false }
);

const recipeSchema = createBaseSchema<RecipeDocument>(
  {
    recipeCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    revision: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    processFamily: {
      type: String,
      required: true,
      enum: [
        'CARBURIZING',
        'CARBONITRIDING',
        'NEUTRAL_HARDENING',
        'TEMPERING',
        'STRESS_RELIEVING',
        'ANNEALING',
        'NORMALIZING',
        'NITRIDING',
        'SOLUTION_TREATING_AGING',
        'INDUCTION_HARDENING'
      ],
      index: true
    },
    applicableMaterialGrades: {
      type: [String],
      required: true,
      index: true
    },
    stages: {
      type: [recipeStageSubSchema],
      required: true,
      default: []
    },
    metallurgicalTargets: {
      type: metallurgicalTargetsSubSchema,
      required: true
    },
    machineRequirements: {
      type: machineRequirementsSubSchema,
      required: true
    },
    authorId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'RETIRED'],
      default: 'DRAFT',
      index: true
    },
    approvedBy: {
      userId: { type: String },
      email: { type: String },
      role: { type: String },
      approvedAt: { type: Date },
      comments: { type: String }
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    effectiveFrom: {
      type: Date
    },
    effectiveTo: {
      type: Date
    },
    referencedJobCount: {
      type: Number,
      default: 0,
      min: 0
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

// Compound tenant index: Unique on (tenantId, recipeCode, revision)
IndexRegistry.addCompoundIndex(recipeSchema, { recipeCode: 1, revision: 1 }, { unique: true });
IndexRegistry.addStatusFilterIndex(recipeSchema, 'status');
recipeSchema.index({ tenantId: 1, processFamily: 1, status: 1 });
recipeSchema.index({ tenantId: 1, applicableMaterialGrades: 1 });

export const RecipeModel = model<RecipeDocument>('Recipe', recipeSchema);
export type { RecipeDocument };
