import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authenticatedFetch, performTokenRefresh, apiClient } from './apiClient.js';
import { store } from '../store/store.js';
import { setCredentials, logout } from '../store/slices/authSlice.js';

// Mock localStorage in memory
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => {
    mockStorage[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  })
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Frontend API Client & Token Refresh Transport Layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorageMock.clear();
    store.dispatch(logout());
  });

  it('1. Normal Authenticated Request: should attach Authorization Bearer token and tenant header', async () => {
    const mockUser = {
      id: 'usr_1',
      email: 'admin@astralis.internal',
      firstName: 'Admin',
      lastName: 'User',
      roles: ['admin'],
      tenantId: 'tenant_default_001'
    };
    store.dispatch(
      setCredentials({
        user: mockUser,
        token: 'initial_valid_access_token_123',
        refreshToken: 'valid_refresh_token_789',
        tenantId: 'tenant_default_001'
      })
    );

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { status: 'healthy' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    globalThis.fetch = mockFetch;

    const res = await authenticatedFetch('http://localhost:5000/api/v1/health');

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledInit = mockFetch.mock.calls[0][1];
    const headers = new Headers(calledInit.headers);
    expect(headers.get('Authorization')).toBe('Bearer initial_valid_access_token_123');
    expect(headers.get('x-tenant-id')).toBe('tenant_default_001');
  });

  it('2. Expired Access Token: should intercept 401, perform refresh, and retry original request with new token', async () => {
    store.dispatch(
      setCredentials({
        user: { id: 'usr_1', email: 'test@factory.com', firstName: 'A', lastName: 'B', roles: [], tenantId: 'tenant_001' },
        token: 'expired_access_token',
        refreshToken: 'valid_refresh_token',
        tenantId: 'tenant_001'
      })
    );

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.toString();

      // Refresh endpoint
      if (url.includes('/auth/refresh-token')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: 'new_fresh_access_token_456', refreshToken: 'new_rotated_refresh_token_999' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // First protected call returns 401
      if (callCount === 0) {
        callCount++;
        return new Response(
          JSON.stringify({ success: false, message: 'Session expired: Access token has expired' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Retried protected call returns 200
      return new Response(
        JSON.stringify({ success: true, data: { fleet: ['furnace_01'] } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    globalThis.fetch = mockFetch;

    const res = await apiClient.get('http://localhost:5000/api/v1/machines');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.fleet).toEqual(['furnace_01']);

    // Check that Redux store and localStorage were updated with the fresh token
    const state = store.getState();
    expect(state.auth.token).toBe('new_fresh_access_token_456');
    expect(state.auth.refreshToken).toBe('new_rotated_refresh_token_999');
    expect(localStorageMock.getItem('astralis_access_token')).toBe('new_fresh_access_token_456');
  });

  it('3. Successful Refresh: performTokenRefresh should return fresh access token and update state', async () => {
    localStorageMock.setItem('astralis_refresh_token', 'rt_token_abc');
    localStorageMock.setItem('astralis_tenant_id', 'tenant_001');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { accessToken: 'refreshed_at_123', refreshToken: 'refreshed_rt_456' }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const freshToken = await performTokenRefresh();

    expect(freshToken).toBe('refreshed_at_123');
    expect(store.getState().auth.token).toBe('refreshed_at_123');
    expect(store.getState().auth.refreshToken).toBe('refreshed_rt_456');
  });

  it('4. Failed Refresh: should clear invalid authentication state, log out, and return null', async () => {
    localStorageMock.setItem('astralis_refresh_token', 'revoked_or_dead_rt');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: 'Refresh token has expired. Please log in again.'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const freshToken = await performTokenRefresh();

    expect(freshToken).toBeNull();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(store.getState().auth.token).toBeNull();
    expect(localStorageMock.getItem('astralis_access_token')).toBeNull();
    expect(localStorageMock.getItem('astralis_refresh_token')).toBeNull();
  });

  it('5. Simultaneous Expired Requests (Single-Flight Lock): exactly 1 refresh request is triggered for parallel 401s', async () => {
    store.dispatch(
      setCredentials({
        user: { id: 'usr_1', email: 'test@factory.com', firstName: 'A', lastName: 'B', roles: [], tenantId: 'tenant_001' },
        token: 'expired_token',
        refreshToken: 'valid_refresh_token',
        tenantId: 'tenant_001'
      })
    );

    let refreshEndpointCallCount = 0;

    const mockFetch = vi.fn().mockImplementation(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/auth/refresh-token')) {
        refreshEndpointCallCount++;
        // Simulate minor async network delay
        await new Promise((r) => setTimeout(r, 10));
        return new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: 'single_flight_fresh_token', refreshToken: 'fresh_rt_lock' }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const headers = new Headers(init?.headers || input.headers || {});
      const auth = headers.get('Authorization') || '';

      // If called with expired token, return 401
      if (!auth.includes('single_flight_fresh_token')) {
        return new Response(JSON.stringify({ message: 'Session expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // If called with refreshed token, return 200
      return new Response(JSON.stringify({ success: true, data: { endpoint: url } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    globalThis.fetch = mockFetch;

    // Launch 4 parallel requests that all fail with 401 simultaneously
    const [res1, res2, res3, res4] = await Promise.all([
      authenticatedFetch('http://localhost:5000/api/v1/items'),
      authenticatedFetch('http://localhost:5000/api/v1/heat-lots'),
      authenticatedFetch('http://localhost:5000/api/v1/machines'),
      authenticatedFetch('http://localhost:5000/api/v1/dispatches')
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
    expect(res4.status).toBe(200);

    // CRITICAL: Refresh endpoint must only have been invoked EXACTLY 1 time due to single-flight mutex!
    expect(refreshEndpointCallCount).toBe(1);
  });

  it('6. Logout during active session: should clear tokens and terminate session', async () => {
    store.dispatch(
      setCredentials({
        user: { id: 'usr_1', email: 'test@factory.com', firstName: 'A', lastName: 'B', roles: [], tenantId: 'tenant_001' },
        token: 'token_to_logout',
        refreshToken: 'rt_to_logout',
        tenantId: 'tenant_001'
      })
    );

    expect(store.getState().auth.isAuthenticated).toBe(true);

    store.dispatch(logout());

    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(store.getState().auth.token).toBeNull();
    expect(store.getState().auth.refreshToken).toBeNull();
    expect(localStorageMock.getItem('astralis_access_token')).toBeNull();
  });

  it('7. Refresh failure during navigation: should return original 401 and clean state without infinite loops', async () => {
    localStorageMock.setItem('astralis_refresh_token', 'bad_token');

    globalThis.fetch = vi.fn().mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/refresh-token')) {
        return new Response(JSON.stringify({ message: 'Token invalid' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ message: 'Access token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const res = await authenticatedFetch('http://localhost:5000/api/v1/billing/invoices');

    expect(res.status).toBe(401);
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
