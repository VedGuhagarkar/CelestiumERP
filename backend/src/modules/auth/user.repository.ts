import { BaseRepository, IBaseRepository } from '../../core/repository/base.repository.js';
import { UserModel, UserDocument } from './user.model.js';

export interface IUserRepository extends IBaseRepository<UserDocument> {
  findByEmail(tenantId: string, email: string): Promise<UserDocument | null>;
  findByUsername(tenantId: string, username: string): Promise<UserDocument | null>;
  findByIdentifier(tenantId: string, identifier: string): Promise<UserDocument | null>;
  findByResetToken(tokenHash: string): Promise<UserDocument | null>;
  updatePassword(tenantId: string, userId: string, passwordHash: string): Promise<UserDocument | null>;
  recordLoginSuccess(tenantId: string, userId: string): Promise<void>;
  recordFailedAttempt(tenantId: string, userId: string, maxAttempts?: number, lockDurationMs?: number): Promise<void>;
  setResetToken(tenantId: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  clearResetToken(tenantId: string, userId: string): Promise<void>;
}

export class UserRepository extends BaseRepository<UserDocument> implements IUserRepository {
  constructor() {
    super(UserModel);
  }

  public async findByEmail(tenantId: string, email: string): Promise<UserDocument | null> {
    return this.findOne(tenantId, { email: email.toLowerCase() });
  }

  public async findByUsername(tenantId: string, username: string): Promise<UserDocument | null> {
    return this.findOne(tenantId, { username: username.toLowerCase() });
  }

  public async findByIdentifier(tenantId: string, identifier: string): Promise<UserDocument | null> {
    const cleanId = identifier.toLowerCase().trim();
    return this.findOne(tenantId, {
      $or: [{ email: cleanId }, { username: cleanId }]
    });
  }

  public async findByResetToken(tokenHash: string): Promise<UserDocument | null> {
    return this.model
      .findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: new Date() },
        isDeleted: false
      })
      .exec();
  }

  public async updatePassword(tenantId: string, userId: string, passwordHash: string): Promise<UserDocument | null> {
    return this.updateById(tenantId, userId, {
      $set: {
        passwordHash,
        passwordChangedAt: new Date(),
        resetPasswordToken: null,
        resetPasswordExpires: null,
        failedLoginAttempts: 0,
        lockUntil: null
      }
    });
  }

  public async recordLoginSuccess(tenantId: string, userId: string): Promise<void> {
    await this.updateById(tenantId, userId, {
      $set: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockUntil: null
      }
    });
  }

  public async recordFailedAttempt(
    tenantId: string,
    userId: string,
    maxAttempts = 5,
    lockDurationMs = 15 * 60 * 1000 // 15 mins
  ): Promise<void> {
    const user = await this.findById(tenantId, userId);
    if (!user) return;

    const attempts = (user.failedLoginAttempts || 0) + 1;
    const update: any = { $inc: { failedLoginAttempts: 1 } };

    if (attempts >= maxAttempts) {
      update.$set = { lockUntil: new Date(Date.now() + lockDurationMs) };
    }

    await this.updateById(tenantId, userId, update);
  }

  public async setResetToken(tenantId: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.updateById(tenantId, userId, {
      $set: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: expiresAt
      }
    });
  }

  public async clearResetToken(tenantId: string, userId: string): Promise<void> {
    await this.updateById(tenantId, userId, {
      $set: {
        resetPasswordToken: null,
        resetPasswordExpires: null
      }
    });
  }
}

export const userRepository = new UserRepository();
