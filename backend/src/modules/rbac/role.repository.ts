import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { RoleModel, RoleDocument } from './role.model.js';
import { DEFAULT_FACTORY_ROLES } from './rbac.constants.js';

export interface IRoleRepository extends IBaseRepository<RoleDocument> {
  findByCode(tenantId: string, code: string): Promise<RoleDocument | null>;
  findRolesByCodes(tenantId: string, codes: string[]): Promise<RoleDocument[]>;
  seedDefaultRolesForTenant(tenantId: string): Promise<RoleDocument[]>;
}

export class RoleRepository extends BaseRepository<RoleDocument> implements IRoleRepository {
  constructor() {
    super(RoleModel);
  }

  public async findByCode(tenantId: string, code: string): Promise<RoleDocument | null> {
    return this.findOne(tenantId, { code: code.toUpperCase() });
  }

  public async findRolesByCodes(tenantId: string, codes: string[]): Promise<RoleDocument[]> {
    const uppercaseCodes = codes.map((c) => c.toUpperCase());
    return this.find(tenantId, {
      code: { $in: uppercaseCodes },
      status: 'active'
    });
  }

  public async seedDefaultRolesForTenant(tenantId: string): Promise<RoleDocument[]> {
    const existingRoles = await this.find(tenantId);
    const existingCodes = new Set(existingRoles.map((r) => r.code));

    const rolesToSeed = DEFAULT_FACTORY_ROLES.filter((role) => !existingCodes.has(role.code));

    if (rolesToSeed.length > 0) {
      await this.insertMany(tenantId, rolesToSeed as any);
    }

    return this.find(tenantId);
  }
}

export const roleRepository = new RoleRepository();
