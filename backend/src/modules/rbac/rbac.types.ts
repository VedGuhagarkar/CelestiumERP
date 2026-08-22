import { Document } from 'mongoose';
import { PermissionKey } from './rbac.constants.js';

export interface IRole {
  tenantId: string;
  code: string;
  name: string;
  description: string;
  permissions: PermissionKey[] | string[];
  isSystemRole: boolean;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleDocument extends IRole, Document {}

export interface CreateRoleDto {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
  status?: 'active' | 'inactive';
}

export interface AssignRolesDto {
  roles: string[];
}

export interface UserEffectivePermissions {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}
