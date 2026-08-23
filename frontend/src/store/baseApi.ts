import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError
} from '@reduxjs/toolkit/query/react';
import { env } from '../config/env.config.js';
import type { RootState } from './store.js';
import { performTokenRefresh } from '../services/apiClient.js';

/**
 * Raw Base Query with header injection
 */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState;
    const token = state.auth.token;
    const tenantId = state.auth.tenantId || env.DEFAULT_TENANT_ID;

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (tenantId && !headers.has('x-tenant-id')) {
      headers.set('x-tenant-id', tenantId);
    }

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    return headers;
  }
});

/**
 * BaseQuery with centralized re-authentication interceptor
 * Automatically retries the failed query once when a fresh access token is acquired.
 */
const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const url = typeof args === 'string' ? args : args.url;
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/refresh-token');

    if (!isAuthEndpoint) {
      const newAccessToken = await performTokenRefresh();

      if (newAccessToken) {
        // Retry the original query with the updated access token
        result = await rawBaseQuery(args, api, extraOptions);
      }
    }
  }

  return result;
};

/**
 * Base RTK Query API Slice
 * Reference: CelestiumERP.md Section 21
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'User',
    'Role',
    'Tenant',
    'Customer',
    'ItemMaster',
    'Recipe',
    'Specification',
    'Machine',
    'Maintenance',
    'Employee',
    'Shift',
    'Attendance',
    'Leave',
    'Overtime',
    'Inventory',
    'Batch',
    'Warehouse',
    'Job',
    'QualityInspection',
    'Dispatch',
    'Costing',
    'Finance',
    'Report',
    'Notification',
    'Workflow',
    'AuditLog'
  ],
  endpoints: () => ({})
});
