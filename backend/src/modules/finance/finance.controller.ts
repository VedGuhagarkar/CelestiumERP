import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { financeService, FinanceService, IActorContext } from './finance.service.js';

export class FinanceController extends BaseController {
  constructor(private readonly service: FinanceService = financeService) {
    super();
  }

  private getActorContext(req: Request): IActorContext {
    const user = this.getUser(req);
    return {
      userId: user.userId,
      email: user.email,
      role: user.roles?.[0],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      correlationId: (req.headers['x-correlation-id'] as string) || undefined
    };
  }

  // ==========================================
  // Chart of Accounts
  // ==========================================

  public createAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.createAccount(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Chart of Accounts entry created successfully');
    } catch (error) {
      next(error);
    }
  };

  public getAllAccounts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const onlyActive = req.query.includeInactive !== 'true';
      const result = await this.service.getAllAccounts(tenantId, onlyActive);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getAccountByCode = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const code = req.params.code as string;
      const result = await this.service.getAccountByCode(tenantId, code);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public updateAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const code = req.params.code as string;
      const result = await this.service.updateAccount(tenantId, actor, code, req.body);
      this.sendSuccess(res, result, 'Account updated successfully');
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // Factory Cost Centers
  // ==========================================

  public createCostCenter = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.createCostCenter(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Factory Cost Center created successfully');
    } catch (error) {
      next(error);
    }
  };

  public getAllCostCenters = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const onlyActive = req.query.includeInactive !== 'true';
      const result = await this.service.getAllCostCenters(tenantId, onlyActive);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // Accounting Periods
  // ==========================================

  public createPeriod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.createPeriod(tenantId, actor, req.body);
      this.sendCreated(res, result, 'Accounting period opened successfully');
    } catch (error) {
      next(error);
    }
  };

  public getAllPeriods = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getAllPeriods(tenantId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public closePeriod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const periodCode = req.params.periodCode as string;
      const result = await this.service.closePeriod(tenantId, actor, periodCode, req.body);
      this.sendSuccess(res, result, `Accounting Period '${periodCode}' closed successfully`);
    } catch (error) {
      next(error);
    }
  };

  public reopenPeriod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const periodCode = req.params.periodCode as string;
      const result = await this.service.reopenPeriod(tenantId, actor, periodCode);
      this.sendSuccess(res, result, `Accounting Period '${periodCode}' reopened successfully`);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // Double-Entry Journals
  // ==========================================

  public createJournalEntry = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.createJournalEntry(tenantId, actor, req.body);
      this.sendCreated(
        res,
        result,
        `Journal entry '${result.entryNumber}' created in status '${result.status}'`
      );
    } catch (error) {
      next(error);
    }
  };

  public postJournalEntry = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.postJournalEntry(tenantId, actor, id);
      this.sendSuccess(res, result, `Journal entry '${result.entryNumber}' posted to general ledger`);
    } catch (error) {
      next(error);
    }
  };

  public reverseJournalEntry = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.reverseJournalEntry(tenantId, actor, id, req.body);
      this.sendSuccess(
        res,
        result,
        `Journal entry reversed. Reversal entry created: '${result.reversalEntry.entryNumber}'`
      );
    } catch (error) {
      next(error);
    }
  };

  public queryJournals = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryJournals(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  public getJournalById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getJournalById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getJournalByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const entryNumber = req.params.entryNumber as string;
      const result = await this.service.getJournalByNumber(tenantId, entryNumber);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // Ledger & Trial Balance Reports
  // ==========================================

  public getGeneralLedgerReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getGeneralLedgerReport(tenantId, req.query as any);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getTrialBalanceReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const result = await this.service.getTrialBalanceReport(tenantId, req.query as any);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}

export const financeController = new FinanceController();
