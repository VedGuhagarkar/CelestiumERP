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
    for (const defRole of DEFAULT_FACTORY_ROLES) {
      await this.model.findOneAndUpdate(
        { tenantId, code: defRole.code },
        {
          $set: {
            name: defRole.name,
            description: defRole.description,
            isSystemRole: defRole.isSystemRole,
            permissions: defRole.permissions,
            status: 'active'
          }
        },
        { upsert: true, new: true }
      );
    }

    return this.find(tenantId);
  }
}

export const roleRepository = new RoleRepository();
