import { env } from '../config/env.config.js';

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('astralis_access_token') || localStorage.getItem('token') || '';
  const tenantId = localStorage.getItem('astralis_tenant_id') || env.DEFAULT_TENANT_ID;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};
