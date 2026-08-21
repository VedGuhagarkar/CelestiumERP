import { PermissionKey } from '../constants/permissions.js';

export interface AuthenticatedUserPayload {
  userId: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: PermissionKey[];
  firstName?: string;
  lastName?: string;
}

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      user?: AuthenticatedUserPayload;
      idempotencyKey?: string;
      correlationId?: string;
    }
  }
}
