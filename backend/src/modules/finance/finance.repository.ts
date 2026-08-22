import mongoose from 'mongoose';
import {
  AccountModel,
  CostCenterModel,
  AccountingPeriodModel,
  JournalEntryModel
} from './finance.model.js';
import {
  AccountDocument,
  CostCenterDocument,
  AccountingPeriodDocument,
  JournalEntryDocument,
  QueryJournalEntriesDto
} from './finance.types.js';
import { PaginationOptions, PaginatedResult } from '../../core/types/pagination.js';

export const DEFAULT_FACTORY_COA = [
  // 1000 Assets
  { accountCode: '1010', accountName: 'Cash & Operating Bank Account', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '1100', accountName: 'Accounts Receivable (Trade Customers)', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '1200', accountName: 'Raw Materials & Components Inventory', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '1210', accountName: 'Work In Progress (Heat-Treat WIP)', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '1220', accountName: 'Finished Goods Inventory', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '1230', accountName: 'Quarantined & Non-Conforming Stock', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '1500', accountName: 'Furnaces, Quench Systems & Plant Equipment', accountType: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '1510', accountName: 'Accumulated Depreciation - Furnaces & Plant', accountType: 'ASSET', normalBalance: 'CREDIT', isSystem: true },

  // 2000 Liabilities
  { accountCode: '2010', accountName: 'Accounts Payable (Trade Vendors & Suppliers)', accountType: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { accountCode: '2100', accountName: 'Accrued Factory Payroll & Operator Wages', accountType: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { accountCode: '2110', accountName: 'Accrued Factory Power & Gas Utilities', accountType: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { accountCode: '2200', accountName: 'Statutory Taxes Payable (GST / VAT)', accountType: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },

  // 3000 Equity
  { accountCode: '3010', accountName: 'Owner Capital / Common Stock', accountType: 'EQUITY', normalBalance: 'CREDIT', isSystem: true },
  { accountCode: '3020', accountName: 'Retained Earnings', accountType: 'EQUITY', normalBalance: 'CREDIT', isSystem: true },

  // 4000 Revenue
  { accountCode: '4010', accountName: 'Commercial Heat-Treatment Service Revenue', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: true },
  { accountCode: '4020', accountName: 'Metallurgical Laboratory Testing & Cert Fees', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: true },
  { accountCode: '4030', accountName: 'AOG & Expedited Turnaround Surcharges', accountType: 'REVENUE', normalBalance: 'CREDIT', isSystem: true },
  { accountCode: '4090', accountName: 'Sales Returns & Quality Concessions', accountType: 'REVENUE', normalBalance: 'DEBIT', isSystem: true },

  // 5000 COGS & Direct Manufacturing Expenses
  { accountCode: '5010', accountName: 'Direct Furnace Operator Labor', accountType: 'COGS', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '5020', accountName: 'Furnace Electricity & Gas Energy Expense', accountType: 'COGS', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '5030', accountName: 'Quench Media, Salts & Process Chemicals', accountType: 'COGS', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '5040', accountName: 'Metallurgical Lab Consumables & Reagents', accountType: 'COGS', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '5050', accountName: 'Scrap, Rework & Material Loss Expense', accountType: 'COGS', normalBalance: 'DEBIT', isSystem: true },

  // 6000 Factory Overhead & Operating Expenses
  { accountCode: '6010', accountName: 'Preventive Maintenance & Spare Parts', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '6020', accountName: 'Thermocouple Replacement & Calibration Expenses', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '6030', accountName: 'Factory Plant & Furnace Depreciation', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '6040', accountName: 'Quality Control & NADCAP Compliance Overhead', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },
  { accountCode: '6050', accountName: 'Finished Goods Packaging & Shipping Freight', accountType: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true }
];

export const DEFAULT_FACTORY_COST_CENTERS = [
  { costCenterCode: 'CC-FURNACE-VAC', name: 'Vacuum Furnaces & Gas Quench Bay', department: 'HEAT_TREAT_PRODUCTION' },
  { costCenterCode: 'CC-FURNACE-ATM', name: 'Atmosphere Sealed Quench Carburizing Line', department: 'HEAT_TREAT_PRODUCTION' },
  { costCenterCode: 'CC-TEMPER-NIT', name: 'Tempering, Annealing & Nitriding Line', department: 'HEAT_TREAT_PRODUCTION' },
  { costCenterCode: 'CC-LAB-MET', name: 'Metallurgical QC & Pyrometry Laboratory', department: 'QUALITY_ASSURANCE' },
  { costCenterCode: 'CC-MAINT-ENG', name: 'Furnace Maintenance & Calibration Engineering', department: 'PLANT_ENGINEERING' },
  { costCenterCode: 'CC-STORES-LOG', name: 'Raw Stores, Quarantine & Dispatch Logistics', department: 'SUPPLY_CHAIN' },
  { costCenterCode: 'CC-ADMIN-MGT', name: 'Plant Operations & Factory Management', department: 'EXECUTIVE_OPS' }
];

export interface IFinanceRepository {
  // Accounts
  createAccount(tenantId: string, data: Partial<AccountDocument>): Promise<AccountDocument>;
  findAccountByCode(tenantId: string, accountCode: string): Promise<AccountDocument | null>;
  findAllAccounts(tenantId: string, onlyActive?: boolean): Promise<AccountDocument[]>;
  updateAccount(tenantId: string, accountCode: string, data: Partial<AccountDocument>): Promise<AccountDocument | null>;
  seedDefaultAccounts(tenantId: string): Promise<AccountDocument[]>;

  // Cost Centers
  createCostCenter(tenantId: string, data: Partial<CostCenterDocument>): Promise<CostCenterDocument>;
  findCostCenterByCode(tenantId: string, code: string): Promise<CostCenterDocument | null>;
  findAllCostCenters(tenantId: string, onlyActive?: boolean): Promise<CostCenterDocument[]>;
  seedDefaultCostCenters(tenantId: string): Promise<CostCenterDocument[]>;

  // Periods
  createPeriod(tenantId: string, data: Partial<AccountingPeriodDocument>): Promise<AccountingPeriodDocument>;
  findPeriodByCode(tenantId: string, periodCode: string): Promise<AccountingPeriodDocument | null>;
  findPeriodForDate(tenantId: string, date: Date): Promise<AccountingPeriodDocument | null>;
  findAllPeriods(tenantId: string): Promise<AccountingPeriodDocument[]>;
  updatePeriod(tenantId: string, periodCode: string, data: Partial<AccountingPeriodDocument>): Promise<AccountingPeriodDocument | null>;
  seedDefaultPeriods(tenantId: string): Promise<AccountingPeriodDocument[]>;

  // Journals
  createJournalEntry(tenantId: string, data: Partial<JournalEntryDocument>): Promise<JournalEntryDocument>;
  findJournalById(tenantId: string, id: string): Promise<JournalEntryDocument | null>;
  findJournalByNumber(tenantId: string, entryNumber: string): Promise<JournalEntryDocument | null>;
  updateJournal(tenantId: string, id: string, data: Partial<JournalEntryDocument>): Promise<JournalEntryDocument | null>;
  queryJournalEntries(tenantId: string, query: QueryJournalEntriesDto, pagination: PaginationOptions): Promise<PaginatedResult<JournalEntryDocument>>;
  generateNextEntryNumber(tenantId: string): Promise<string>;
  getJournalEntriesForLedger(tenantId: string, accountCode: string, startDate?: Date, endDate?: Date, costCenterCode?: string): Promise<JournalEntryDocument[]>;
  getAllPostedJournalsUpTo(tenantId: string, asOfDate: Date): Promise<JournalEntryDocument[]>;
}

export class FinanceRepository implements IFinanceRepository {
  // Accounts
  public async createAccount(tenantId: string, data: Partial<AccountDocument>): Promise<AccountDocument> {
    const account = new AccountModel({
      ...data,
      accountCode: data.accountCode?.toUpperCase(),
      tenantId
    });
    return await account.save();
  }

  public async findAccountByCode(tenantId: string, accountCode: string): Promise<AccountDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await AccountModel.findOne({
      tenantId,
      accountCode: accountCode.toUpperCase()
    });
  }

  public async findAllAccounts(tenantId: string, onlyActive = true): Promise<AccountDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    const filter: Record<string, any> = { tenantId };
    if (onlyActive) filter.isActive = true;
    return await AccountModel.find(filter).sort({ accountCode: 1 });
  }

  public async updateAccount(tenantId: string, accountCode: string, data: Partial<AccountDocument>): Promise<AccountDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await AccountModel.findOneAndUpdate(
      { tenantId, accountCode: accountCode.toUpperCase() },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async seedDefaultAccounts(tenantId: string): Promise<AccountDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    const results: AccountDocument[] = [];
    for (const coa of DEFAULT_FACTORY_COA) {
      const existing = await this.findAccountByCode(tenantId, coa.accountCode);
      if (!existing) {
        const created = await this.createAccount(tenantId, coa as any);
        results.push(created);
      } else {
        results.push(existing);
      }
    }
    return results;
  }

  // Cost Centers
  public async createCostCenter(tenantId: string, data: Partial<CostCenterDocument>): Promise<CostCenterDocument> {
    const cc = new CostCenterModel({
      ...data,
      costCenterCode: data.costCenterCode?.toUpperCase(),
      tenantId
    });
    return await cc.save();
  }

  public async findCostCenterByCode(tenantId: string, code: string): Promise<CostCenterDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await CostCenterModel.findOne({
      tenantId,
      costCenterCode: code.toUpperCase()
    });
  }

  public async findAllCostCenters(tenantId: string, onlyActive = true): Promise<CostCenterDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    const filter: Record<string, any> = { tenantId };
    if (onlyActive) filter.isActive = true;
    return await CostCenterModel.find(filter).sort({ costCenterCode: 1 });
  }

  public async seedDefaultCostCenters(tenantId: string): Promise<CostCenterDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    const results: CostCenterDocument[] = [];
    for (const cc of DEFAULT_FACTORY_COST_CENTERS) {
      const existing = await this.findCostCenterByCode(tenantId, cc.costCenterCode);
      if (!existing) {
        const created = await this.createCostCenter(tenantId, cc as any);
        results.push(created);
      } else {
        results.push(existing);
      }
    }
    return results;
  }

  // Periods
  public async createPeriod(tenantId: string, data: Partial<AccountingPeriodDocument>): Promise<AccountingPeriodDocument> {
    const period = new AccountingPeriodModel({
      ...data,
      periodCode: data.periodCode?.toUpperCase(),
      tenantId,
      status: data.status || 'OPEN'
    });
    return await period.save();
  }

  public async findPeriodByCode(tenantId: string, periodCode: string): Promise<AccountingPeriodDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await AccountingPeriodModel.findOne({
      tenantId,
      periodCode: periodCode.toUpperCase()
    });
  }

  public async findPeriodForDate(tenantId: string, date: Date): Promise<AccountingPeriodDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await AccountingPeriodModel.findOne({
      tenantId,
      startDate: { $lte: date },
      endDate: { $gte: date }
    });
  }

  public async findAllPeriods(tenantId: string): Promise<AccountingPeriodDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await AccountingPeriodModel.find({ tenantId }).sort({ startDate: -1 });
  }

  public async updatePeriod(tenantId: string, periodCode: string, data: Partial<AccountingPeriodDocument>): Promise<AccountingPeriodDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await AccountingPeriodModel.findOneAndUpdate(
      { tenantId, periodCode: periodCode.toUpperCase() },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async seedDefaultPeriods(tenantId: string): Promise<AccountingPeriodDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const results: AccountingPeriodDocument[] = [];

    for (let month = 1; month <= 12; month++) {
      const monthStr = String(month).padStart(2, '0');
      const periodCode = `${currentYear}-${monthStr}`;
      const startDate = new Date(Date.UTC(currentYear, month - 1, 1));
      const endDate = new Date(Date.UTC(currentYear, month, 0, 23, 59, 59, 999));
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const name = `${monthNames[month - 1]} ${currentYear}`;

      const existing = await this.findPeriodByCode(tenantId, periodCode);
      if (!existing) {
        const created = await this.createPeriod(tenantId, {
          periodCode,
          name,
          startDate,
          endDate,
          status: 'OPEN'
        });
        results.push(created);
      } else {
        results.push(existing);
      }
    }
    return results;
  }

  // Journals
  public async createJournalEntry(tenantId: string, data: Partial<JournalEntryDocument>): Promise<JournalEntryDocument> {
    const entry = new JournalEntryModel({
      ...data,
      tenantId,
      isDeleted: false
    });
    return await entry.save();
  }

  public async findJournalById(tenantId: string, id: string): Promise<JournalEntryDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || mongoose.connection.readyState === 0) return null;
    return await JournalEntryModel.findOne({
      _id: id,
      tenantId,
      isDeleted: false
    });
  }

  public async findJournalByNumber(tenantId: string, entryNumber: string): Promise<JournalEntryDocument | null> {
    if (mongoose.connection.readyState === 0) return null;
    return await JournalEntryModel.findOne({
      tenantId,
      entryNumber: entryNumber.toUpperCase(),
      isDeleted: false
    });
  }

  public async updateJournal(tenantId: string, id: string, data: Partial<JournalEntryDocument>): Promise<JournalEntryDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id) || mongoose.connection.readyState === 0) return null;
    return await JournalEntryModel.findOneAndUpdate(
      { _id: id, tenantId, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  public async queryJournalEntries(
    tenantId: string,
    query: QueryJournalEntriesDto,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<JournalEntryDocument>> {
    const filter: Record<string, any> = { tenantId, isDeleted: false };

    if (query.status) filter.status = query.status;
    if (query.entryType) filter.entryType = query.entryType;
    if (query.sourceModule) filter.sourceModule = query.sourceModule;
    if (query.accountingPeriod) filter.accountingPeriod = query.accountingPeriod.toUpperCase();
    if (query.accountCode) filter['lines.accountCode'] = query.accountCode.toUpperCase();
    if (query.costCenterCode) filter['lines.costCenterCode'] = query.costCenterCode.toUpperCase();
    if (query.jobNumber) filter['lines.jobNumber'] = new RegExp(query.jobNumber, 'i');
    if (query.customerCode) filter['lines.customerCode'] = query.customerCode.toUpperCase();

    if (query.startDate || query.endDate) {
      filter.postingDate = {};
      if (query.startDate) filter.postingDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.postingDate.$lte = new Date(query.endDate);
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { entryNumber: searchRegex },
        { description: searchRegex },
        { sourceReferenceNumber: searchRegex },
        { 'lines.accountName': searchRegex }
      ];
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      JournalEntryModel.find(filter)
        .sort({ postingDate: -1, entryNumber: -1 })
        .skip(skip)
        .limit(limit),
      JournalEntryModel.countDocuments(filter)
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async generateNextEntryNumber(tenantId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `JE-${yearMonth}-`;

    if (mongoose.connection.readyState === 0) {
      return `${prefix}0001`;
    }

    const latest: any = await JournalEntryModel.findOne({
      tenantId,
      entryNumber: new RegExp(`^${prefix}`)
    })
      .sort({ entryNumber: -1 })
      .lean();

    let seq = 1;
    if (latest && latest.entryNumber) {
      const parts = latest.entryNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  public async getJournalEntriesForLedger(
    tenantId: string,
    accountCode: string,
    startDate?: Date,
    endDate?: Date,
    costCenterCode?: string
  ): Promise<JournalEntryDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    const filter: Record<string, any> = {
      tenantId,
      status: 'POSTED',
      isDeleted: false,
      'lines.accountCode': accountCode.toUpperCase()
    };

    if (startDate || endDate) {
      filter.postingDate = {};
      if (startDate) filter.postingDate.$gte = startDate;
      if (endDate) filter.postingDate.$lte = endDate;
    }

    if (costCenterCode) {
      filter['lines.costCenterCode'] = costCenterCode.toUpperCase();
    }

    return await JournalEntryModel.find(filter).sort({ postingDate: 1, entryNumber: 1 });
  }

  public async getAllPostedJournalsUpTo(tenantId: string, asOfDate: Date): Promise<JournalEntryDocument[]> {
    if (mongoose.connection.readyState === 0) return [];
    return await JournalEntryModel.find({
      tenantId,
      status: 'POSTED',
      isDeleted: false,
      postingDate: { $lte: asOfDate }
    }).sort({ postingDate: 1 });
  }
}

export const financeRepository = new FinanceRepository();
