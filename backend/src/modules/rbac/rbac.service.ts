import { BaseService } from '../../core/services/base.service.js';
import { IRoleRepository, roleRepository } from './role.repository.js';
import { IUserRepository, userRepository } from '../auth/user.repository.js';
import { refreshTokenRepository, IRefreshTokenRepository } from '../auth/refresh-token.repository.js';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRolesDto,
  RoleDocument,
  UserEffectivePermissions
} from './rbac.types.js';
import { ALL_PERMISSIONS } from './rbac.constants.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/app-error.js';

export class RbacService extends BaseService {
  constructor(
    private readonly roleRepo: IRoleRepository = roleRepository,
    private readonly userRepo: IUserRepository = userRepository,
    private readonly tokenRepo: IRefreshTokenRepository = refreshTokenRepository
  ) {
    super('RbacService');
  }

  /**
   * Retrieves the full platform permission catalog
   */
  public getPermissionsCatalog(): string[] {
    return ALL_PERMISSIONS;
  }

  /**
   * Computes the effective union of permissions for a user across all assigned active roles
   */
  public async getUserEffectivePermissions(
    tenantId: string,
    userId: string,
    userRoles: string[] = []
  ): Promise<UserEffectivePermissions> {
    const isSuperAdmin = userRoles.map((r) => r.toUpperCase()).includes('ADMIN');

    if (isSuperAdmin) {
      return {
        userId,
        tenantId,
        roles: userRoles,
        permissions: ALL_PERMISSIONS,
        isSuperAdmin: true
      };
    }

    // Ensure default factory roles are seeded
    await this.roleRepo.seedDefaultRolesForTenant(tenantId);

    // Fetch active roles assigned to user
    const roles = await this.roleRepo.findRolesByCodes(tenantId, userRoles);

    // Aggregate unique permissions
    const permissionSet = new Set<string>();
    for (const role of roles) {
      role.permissions.forEach((perm) => permissionSet.add(perm));
    }

    return {
      userId,
      tenantId,
      roles: userRoles,
      permissions: Array.from(permissionSet),
      isSuperAdmin: false
    };
  }

  /**
   * Retrieves all roles configured for a tenant (auto-seeds defaults if empty)
   */
  public async getRolesForTenant(tenantId: string): Promise<RoleDocument[]> {
    return this.roleRepo.seedDefaultRolesForTenant(tenantId);
  }

  /**
   * Creates a custom factory role within the tenant
   */
  public async createRole(tenantId: string, dto: CreateRoleDto): Promise<RoleDocument> {
    const existing = await this.roleRepo.findByCode(tenantId, dto.code);
    if (existing) {
      throw new ConflictError(`Role code '${dto.code}' already exists in tenant`);
    }

    // Validate that all submitted permissions are valid platform permissions
    const validPermSet = new Set<string>(ALL_PERMISSIONS);
    const invalidPerms = dto.permissions.filter((p) => !validPermSet.has(p));
    if (invalidPerms.length > 0) {
      throw new BadRequestError(`Invalid permissions specified: ${invalidPerms.join(', ')}`);
    }

    const role = await this.roleRepo.create(tenantId, {
      code: dto.code.toUpperCase(),
      name: dto.name,
      description: dto.description || '',
      permissions: dto.permissions,
      isSystemRole: false,
      status: 'active'
    });

    this.logger.info(`🎭 Custom role created: [${role.code}] on tenant [${tenantId}]`);

    this.publishEvent('ROLE_CREATED', tenantId, {
      roleId: role.id,
      code: role.code,
      name: role.name
    });

    return role;
  }

  /**
   * Updates an existing role
   */
  public async updateRole(
    tenantId: string,
    roleId: string,
    dto: UpdateRoleDto,
    actorRoles: string[] = []
  ): Promise<RoleDocument> {
    const role = await this.roleRepo.findById(tenantId, roleId);
    if (!role) {
      throw new NotFoundError(`Role with ID '${roleId}' not found`);
    }

    const isSuperAdmin = actorRoles.map((r) => r.toUpperCase()).includes('ADMIN');

    // System roles can only have permissions modified by tenant ADMIN
    if (role.isSystemRole && dto.permissions && !isSuperAdmin) {
      throw new ForbiddenError('System foundational role permissions can only be altered by Tenant Administrators');
    }

    if (dto.permissions) {
      const validPermSet = new Set<string>(ALL_PERMISSIONS);
      const invalidPerms = dto.permissions.filter((p) => !validPermSet.has(p));
      if (invalidPerms.length > 0) {
        throw new BadRequestError(`Invalid permissions specified: ${invalidPerms.join(', ')}`);
      }
    }

    const updated = await this.roleRepo.updateById(tenantId, roleId, { $set: dto });
    if (!updated) {
      throw new NotFoundError(`Role with ID '${roleId}' not found`);
    }

    this.publishEvent('ROLE_UPDATED', tenantId, {
      roleId: updated.id,
      code: updated.code
    });

    return updated;
  }

  /**
   * Assigns roles to a user with strict privilege escalation checks
   */
  public async assignRolesToUser(
    tenantId: string,
    targetUserId: string,
    dto: AssignRolesDto,
    actorUserId: string,
    actorRoles: string[] = []
  ): Promise<{ targetUserId: string; roles: string[] }> {
    const targetUser = await this.userRepo.findById(tenantId, targetUserId);
    if (!targetUser) {
      throw new NotFoundError(`Target user with ID '${targetUserId}' not found`);
    }

    // Ensure default roles are seeded
    await this.roleRepo.seedDefaultRolesForTenant(tenantId);

    // Verify all assigned roles exist in tenant
    const targetRoles = await this.roleRepo.findRolesByCodes(tenantId, dto.roles);
    if (targetRoles.length !== dto.roles.length) {
      const foundCodes = new Set(targetRoles.map((r) => r.code));
      const missingCodes = dto.roles.filter((c) => !foundCodes.has(c.toUpperCase()));
      throw new BadRequestError(`Invalid or non-existent roles: ${missingCodes.join(', ')}`);
    }

    const isActorAdmin = actorRoles.map((r) => r.toUpperCase()).includes('ADMIN');

    // PRIVILEGE ESCALATION CHECK: Non-admin users cannot grant permissions they do not possess
    if (!isActorAdmin) {
      const actorPerms = await this.getUserEffectivePermissions(tenantId, actorUserId, actorRoles);
      const actorPermSet = new Set(actorPerms.permissions);

      for (const role of targetRoles) {
        const excessPerms = role.permissions.filter((p) => !actorPermSet.has(p));
        if (excessPerms.length > 0) {
          throw new ForbiddenError(
            `Privilege escalation violation: You cannot assign role [${role.code}] because it contains permissions you do not possess (${excessPerms.slice(0, 3).join(', ')}...)`
          );
        }
      }
    }

    // Update target user roles
    await this.userRepo.updateById(tenantId, targetUserId, {
      $set: { roles: dto.roles.map((r) => r.toUpperCase()) }
    });

    // Invalidate sessions so new roles are immediately enforced
    await this.tokenRepo.revokeAllForUser(tenantId, targetUserId);

    this.logger.info(`👑 Assigned roles [${dto.roles.join(', ')}] to user [${targetUser.email}]`);

    this.publishEvent('USER_ROLES_ASSIGNED', tenantId, {
      targetUserId,
      assignedRoles: dto.roles,
      actorUserId
    });

    return {
      targetUserId,
      roles: dto.roles.map((r) => r.toUpperCase())
    };
  }
}

export const rbacService = new RbacService();
