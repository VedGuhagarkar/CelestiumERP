import { env } from '../config/env.config.js';
import { authenticatedFetch, apiClient, performTokenRefresh, handleSessionExpiration } from '../services/apiClient.js';

export { authenticatedFetch, apiClient, performTokenRefresh, handleSessionExpiration };

/**
 * Returns baseline auth and tenant headers
 */
export const getAuthHeaders = (): Record<string, string> => {
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('astralis_access_token') || localStorage.getItem('token') || ''
      : '';
  const tenantId =
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('astralis_tenant_id')
      : null) || env.DEFAULT_TENANT_ID;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};
