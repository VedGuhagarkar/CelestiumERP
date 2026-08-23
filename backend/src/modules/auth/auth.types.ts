import { Document } from 'mongoose';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface IUser {
  tenantId: string;
  email: string;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  roles: string[];
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  failedLoginAttempts: number;
  lockUntil?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDocument extends IUser, Document {}

export interface IRefreshToken {
  tenantId: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  isRevoked: boolean;
  replacedByToken?: string;
  userAgent?: string;
  ipAddress?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenDocument extends IRefreshToken, Document {}

export interface JwtUserPayload {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  type?: 'access';
}

export interface JwtRefreshPayload {
  userId: string;
  tenantId: string;
  familyId: string;
  type: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
}

export interface AuthResponseData {
  user: {
    id: string;
    tenantId: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    roles: string[];
    status: UserStatus;
    lastLoginAt?: Date;
  };
  tokens: AuthTokens;
}

export interface RegisterUserDto {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  roles?: string[];
}

export interface LoginDto {
  identifier: string; // email or username
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}
