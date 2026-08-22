import { Request, Response, NextFunction } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { notificationService, NotificationService, IActorContext } from './notification.service.js';

export class NotificationController extends BaseController {
  constructor(private readonly service: NotificationService = notificationService) {
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

  public getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const pagination = this.parsePagination(req);
      const result = await this.service.getNotifications(
        tenantId,
        actor,
        req.query as any,
        pagination
      );
      this.sendPaginated(res, result.items, result.page, result.limit, result.total);
    } catch (error) {
      next(error);
    }
  };

  public getUnreadCount = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.getUnreadCount(tenantId, actor);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public markAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const id = req.params.id as string;
      const result = await this.service.markAsRead(tenantId, id, actor);
      this.sendSuccess(res, result, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  };

  public markAllAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.markAllAsRead(tenantId, actor);
      this.sendSuccess(res, result, `${result.modifiedCount} notifications marked as read`);
    } catch (error) {
      next(error);
    }
  };

  public getUserPreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.getUserPreferences(tenantId, actor.userId);
      this.sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  public updateUserPreferences = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.updateUserPreferences(tenantId, actor, req.body);
      this.sendSuccess(res, result, 'Notification preferences updated');
    } catch (error) {
      next(error);
    }
  };

  public broadcastAlert = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tenantId = this.getTenantId(req);
      const actor = this.getActorContext(req);
      const result = await this.service.broadcastAlert(tenantId, actor, req.body);
      this.sendCreated(res, result, `Factory Alert broadcasted: ${result.title}`);
    } catch (error) {
      next(error);
    }
  };
}

export const notificationController = new NotificationController();
