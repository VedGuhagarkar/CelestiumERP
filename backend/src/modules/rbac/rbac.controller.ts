import { Request, Response } from 'express';
import { BaseController } from '../../core/controllers/base.controller.js';
import { rbacService, RbacService } from './rbac.service.js';

export class RbacController extends BaseController {
  constructor(private readonly service: RbacService = rbacService) {
    super();
  }

  public getPermissionsCatalog = async (_req: Request, res: Response): Promise<Response> => {
    const permissions = this.service.getPermissionsCatalog();
    return this.sendSuccess(res, permissions, 'Permissions catalog retrieved successfully');
  };

  public getMyPermissions = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const user = this.getUser(req);
    const permissions = await this.service.getUserEffectivePermissions(tenantId, user.userId, user.roles);
    return this.sendSuccess(res, permissions, 'User effective permissions retrieved successfully');
  };

  public getRoles = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const roles = await this.service.getRolesForTenant(tenantId);
    return this.sendSuccess(res, roles, 'Tenant roles retrieved successfully');
  };

  public createRole = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const role = await this.service.createRole(tenantId, req.body);
    return this.sendCreated(res, role, 'Role created successfully');
  };

  public updateRole = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getUser(req);
    const roleId = req.params.id as string;
    const role = await this.service.updateRole(tenantId, roleId, req.body, actor.roles);
    return this.sendSuccess(res, role, 'Role updated successfully');
  };

  public assignRolesToUser = async (req: Request, res: Response): Promise<Response> => {
    const tenantId = this.getTenantId(req);
    const actor = this.getUser(req);
    const targetUserId = req.params.userId as string;
    const result = await this.service.assignRolesToUser(
      tenantId,
      targetUserId,
      req.body,
      actor.userId,
      actor.roles
    );
    return this.sendSuccess(res, result, 'Roles successfully assigned to user');
  };
}

export const rbacController = new RbacController();
