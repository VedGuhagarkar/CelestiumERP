import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { env } from '../config/env.config.js';
import type { RootState } from './store.js';

/**
 * Base RTK Query API Slice
 * Automatically injects JWT Bearer token and active tenant header.
 * Reference: CelestiumERP.md Section 21
 */

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: env.API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as RootState;
      const token = state.auth.token;
      const tenantId = state.auth.tenantId || env.DEFAULT_TENANT_ID;

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      if (tenantId) {
        headers.set('x-tenant-id', tenantId);
      }

      headers.set('Accept', 'application/json');
      return headers;
    }
  }),
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
