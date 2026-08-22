import mongoose, { Schema } from 'mongoose';
import {
  AccountDocument,
  CostCenterDocument,
  AccountingPeriodDocument,
  JournalEntryDocument
} from './finance.types.js';

const ActorSnapshotSchema = new Schema(
  {
    userId: { type: String, required: true },
    email: { type: String },
    role: { type: String }
  },
  { _id: false }
);

// 1. Chart of Accounts Schema
const AccountSchema = new Schema<AccountDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    accountCode: { type: String, required: true, uppercase: true },
    accountName: { type: String, required: true, trim: true },
    accountType: {
      type: String,
      required: true,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE']
    },
    normalBalance: {
      type: String,
      required: true,
      enum: ['DEBIT', 'CREDIT']
    },
    parentAccountCode: { type: String, uppercase: true },
    description: { type: String },
    isActive: { type: Boolean, required: true, default: true, index: true },
    isSystem: { type: Boolean, required: true, default: false }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

AccountSchema.index({ tenantId: 1, accountCode: 1 }, { unique: true });
AccountSchema.index({ tenantId: 1, accountType: 1, isActive: 1 });

// 2. Cost Center Schema
const CostCenterSchema = new Schema<CostCenterDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    costCenterCode: { type: String, required: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    description: { type: String },
    isActive: { type: Boolean, required: true, default: true, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

CostCenterSchema.index({ tenantId: 1, costCenterCode: 1 }, { unique: true });

// 3. Accounting Period Schema
const AccountingPeriodSchema = new Schema<AccountingPeriodDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    periodCode: { type: String, required: true, uppercase: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'CLOSING', 'CLOSED'],
      default: 'OPEN',
      index: true
    },
    closedBy: { type: ActorSnapshotSchema },
    closedAt: { type: Date },
    closingNotes: { type: String }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

AccountingPeriodSchema.index({ tenantId: 1, periodCode: 1 }, { unique: true });
AccountingPeriodSchema.index({ tenantId: 1, startDate: 1, endDate: 1 });

// 4. Journal Entry Schema
const JournalLineSchema = new Schema(
  {
    lineId: { type: String, required: true },
    accountCode: { type: String, required: true, uppercase: true },
    accountName: { type: String, required: true },
    costCenterCode: { type: String, uppercase: true },
    debit: { type: Number, required: true, min: 0, default: 0 },
    credit: { type: Number, required: true, min: 0, default: 0 },
    description: { type: String },
    jobId: { type: String },
    jobNumber: { type: String },
    customerId: { type: String },
    customerCode: { type: String },
    itemId: { type: String },
    itemCode: { type: String }
  },
  { _id: false }
);

const JournalEntrySchema = new Schema<JournalEntryDocument>(
  {
    tenantId: { type: String, required: true, index: true },
    entryNumber: { type: String, required: true, uppercase: true },
    postingDate: { type: Date, required: true, index: true },
    accountingPeriod: { type: String, required: true, uppercase: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'POSTED', 'REVERSED'],
      default: 'DRAFT',
      index: true
    },
    entryType: {
      type: String,
      required: true,
      enum: ['STANDARD', 'OPERATIONAL', 'REVERSAL', 'CLOSING', 'ADJUSTMENT'],
      default: 'STANDARD'
    },
    sourceModule: {
      type: String,
      required: true,
      enum: [
        'PRODUCTION',
        'QUALITY',
        'INVENTORY',
        'DISPATCH',
        'MAINTENANCE',
        'WORKFORCE',
        'MANUAL'
      ],
      default: 'MANUAL'
    },
    sourceReferenceId: { type: String },
    sourceReferenceNumber: { type: String },
    description: { type: String, required: true },
    lines: { type: [JournalLineSchema], default: [] },
    totalDebit: { type: Number, required: true, min: 0 },
    totalCredit: { type: Number, required: true, min: 0 },
    isBalanced: { type: Boolean, required: true, default: true },
    postedBy: { type: ActorSnapshotSchema },
    postedAt: { type: Date },
    reversedBy: { type: ActorSnapshotSchema },
    reversedAt: { type: Date },
    reversalEntryId: { type: String },
    reversalReason: { type: String },
    notes: { type: String },
    isDeleted: { type: Boolean, required: true, default: false, index: true }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

JournalEntrySchema.index({ tenantId: 1, entryNumber: 1 }, { unique: true });
JournalEntrySchema.index({ tenantId: 1, accountingPeriod: 1, status: 1 });
JournalEntrySchema.index({ tenantId: 1, 'lines.accountCode': 1, status: 1 });
JournalEntrySchema.index({ tenantId: 1, 'lines.costCenterCode': 1 });
JournalEntrySchema.index({ tenantId: 1, 'lines.jobNumber': 1 });
JournalEntrySchema.index({ tenantId: 1, sourceReferenceNumber: 1 });

export const AccountModel =
  mongoose.models.Account || mongoose.model<AccountDocument>('Account', AccountSchema);

export const CostCenterModel =
  mongoose.models.CostCenter ||
  mongoose.model<CostCenterDocument>('CostCenter', CostCenterSchema);

export const AccountingPeriodModel =
  mongoose.models.AccountingPeriod ||
  mongoose.model<AccountingPeriodDocument>('AccountingPeriod', AccountingPeriodSchema);

export const JournalEntryModel =
  mongoose.models.JournalEntry ||
  mongoose.model<JournalEntryDocument>('JournalEntry', JournalEntrySchema);
