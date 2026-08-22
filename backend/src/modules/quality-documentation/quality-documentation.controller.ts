import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import {
  qualityDocumentationService,
  QualityDocumentationService
} from './quality-documentation.service.js';

export class QualityDocumentationController extends BaseController {
  constructor(private readonly service: QualityDocumentationService = qualityDocumentationService) {
    super();
  }

  public generateDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const result = await this.service.generateDocument(tenantId, actor, req.body);
      this.sendCreated(res, result, `${req.body.reportType} generated successfully`);
    } catch (error) {
      next(error);
    }
  };

  public revokeDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActor(req);
      const id = req.params.id as string;
      const result = await this.service.revokeDocument(tenantId, actor, id, req.body);
      this.sendSuccess(res, result, 'Quality document revoked successfully');
    } catch (error) {
      next(error);
    }
  };

  public verifyDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const code = (req.params.code || req.query.code) as string;
      const result = await this.service.verifyDocument(tenantId, code);
      this.sendSuccess(res, result, 'Document authenticity verified');
    } catch (error) {
      next(error);
    }
  };

  public getDocumentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const id = req.params.id as string;
      const result = await this.service.getDocumentById(tenantId, id);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public getDocumentByNumber = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const documentNumber = req.params.documentNumber as string;
      const result = await this.service.getDocumentByNumber(tenantId, documentNumber);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public queryDocuments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.queryDocuments(tenantId, req.query as any, pagination);
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  private getActor(req: Request) {
    const user = (req as any).user;
    return {
      userId: user?.userId || 'system',
      email: user?.email,
      role: user?.roles?.[0] || 'METALLURGIST',
      fullName: user?.fullName || 'Quality Assurance Authority',
      title: 'Certified QA Metallurgist'
    };
  }
}

export const qualityDocumentationController = new QualityDocumentationController();
