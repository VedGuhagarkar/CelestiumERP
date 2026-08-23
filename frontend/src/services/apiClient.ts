import { env } from '../config/env.config.js';
import { store } from '../store/store.js';
import { updateTokens, logout } from '../store/slices/authSlice.js';

let refreshPromise: Promise<string | null> | null = null;

/**
 * Performs a synchronized single-flight token refresh.
 * Multiple concurrent callers will receive the same in-flight Promise.
 */
export async function performTokenRefresh(): Promise<string | null> {
  // If a refresh is already in flight, reuse the same promise (single-flight mutex)
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('astralis_refresh_token')
          : null;
      const tenantId =
        (typeof localStorage !== 'undefined'
          ? localStorage.getItem('astralis_tenant_id')
          : null) || env.DEFAULT_TENANT_ID;

      if (!refreshToken) {
        handleSessionExpiration();
        return null;
      }

      // Native fetch bypassing authenticatedFetch to avoid recursion loops
      const response = await fetch(`${env.API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        handleSessionExpiration();
        return null;
      }

      const data = await response.json();
      const tokens = data.data || data;
      const newAccessToken = tokens.accessToken;
      const newRefreshToken = tokens.refreshToken;

      if (!newAccessToken) {
        handleSessionExpiration();
        return null;
      }

      // Update Redux state and localStorage synchronously
      store.dispatch(
        updateTokens({
          token: newAccessToken,
          refreshToken: newRefreshToken || undefined
        })
      );

      return newAccessToken;
    } catch {
      handleSessionExpiration();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Terminates frontend session cleanly when refresh fails or tokens are invalid
 */
export function handleSessionExpiration(): void {
  try {
    store.dispatch(logout());
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('astralis_access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('astralis_refresh_token');
      localStorage.removeItem('astralis_user');
    }
    if (
      typeof window !== 'undefined' &&
      window.location &&
      window.location.pathname !== '/login'
    ) {
      // Use replace so back button does not bounce back to expired page
      window.location.replace('/login');
    }
  } catch {
    // Graceful handling for non-browser or test execution
  }
}

/**
 * Core Authenticated Fetch wrapper with automatic token injection and 401 refresh-and-retry
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlString = typeof input === 'string' ? input : input.toString();

  // 1. Prepare Authorization & Tenant Headers
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('astralis_access_token') || localStorage.getItem('token')
      : null;
  const tenantId =
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('astralis_tenant_id')
      : null) || env.DEFAULT_TENANT_ID;

  const headers = new Headers(init?.headers || {});

  if (!headers.has('x-tenant-id')) {
    headers.set('x-tenant-id', tenantId);
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const modifiedInit: RequestInit = {
    ...init,
    headers
  };

  // 2. Execute Request
  const response = await fetch(input, modifiedInit);

  // 3. Handle 401 Unauthorized with Automatic Token Refresh
  if (response.status === 401) {
    const isAuthEndpoint =
      urlString.includes('/auth/login') ||
      urlString.includes('/auth/register') ||
      urlString.includes('/auth/refresh') ||
      urlString.includes('/auth/refresh-token');

    if (!isAuthEndpoint) {
      const newAccessToken = await performTokenRefresh();

      if (newAccessToken) {
        // Retry the original request with the fresh access token exactly once
        const retryHeaders = new Headers(modifiedInit.headers);
        retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);

        return fetch(input, {
          ...modifiedInit,
          headers: retryHeaders
        });
      }
    }
  }

  return response;
}

/**
 * Centralized REST API client
 */
export const apiClient = {
  get: (url: string, init?: RequestInit) =>
    authenticatedFetch(url, { ...init, method: 'GET' }),

  post: (url: string, body?: any, init?: RequestInit) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = new Headers(init?.headers || {});
    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return authenticatedFetch(url, {
      ...init,
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
  },

  put: (url: string, body?: any, init?: RequestInit) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = new Headers(init?.headers || {});
    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return authenticatedFetch(url, {
      ...init,
      method: 'PUT',
      headers,
      body: isFormData ? body : JSON.stringify(body)
    });
  },

  delete: (url: string, init?: RequestInit) =>
    authenticatedFetch(url, { ...init, method: 'DELETE' })
};
