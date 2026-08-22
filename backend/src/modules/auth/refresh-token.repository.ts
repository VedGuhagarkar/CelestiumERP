import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { RefreshTokenModel, RefreshTokenDocument } from './refresh-token.model.js';

export interface IRefreshTokenRepository extends IBaseRepository<RefreshTokenDocument> {
  findByTokenHash(tenantId: string, tokenHash: string): Promise<RefreshTokenDocument | null>;
  revokeToken(tenantId: string, tokenId: string, replacedByToken?: string): Promise<RefreshTokenDocument | null>;
  revokeFamily(tenantId: string, familyId: string): Promise<void>;
  revokeAllForUser(tenantId: string, userId: string): Promise<void>;
}

export class RefreshTokenRepository
  extends BaseRepository<RefreshTokenDocument>
  implements IRefreshTokenRepository
{
  constructor() {
    super(RefreshTokenModel);
  }

  public async findByTokenHash(tenantId: string, tokenHash: string): Promise<RefreshTokenDocument | null> {
    return this.findOne(tenantId, { tokenHash });
  }

  public async revokeToken(
    tenantId: string,
    tokenId: string,
    replacedByToken?: string
  ): Promise<RefreshTokenDocument | null> {
    return this.updateById(tenantId, tokenId, {
      $set: {
        isRevoked: true,
        replacedByToken: replacedByToken || null
      }
    });
  }

  public async revokeFamily(tenantId: string, familyId: string): Promise<void> {
    await this.model
      .updateMany(this.withTenant(tenantId, { familyId }), {
        $set: { isRevoked: true }
      })
      .exec();
  }

  public async revokeAllForUser(tenantId: string, userId: string): Promise<void> {
    await this.model
      .updateMany(this.withTenant(tenantId, { userId }), {
        $set: { isRevoked: true }
      })
      .exec();
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
