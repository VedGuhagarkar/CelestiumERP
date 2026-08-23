import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions?: string[];
  tenantId: string;
  status?: string;
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  tenantId: string;
  isAuthenticated: boolean;
}

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, val: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {}
  }
};

export const isTokenExpired = (jwtToken: string | null): boolean => {
  if (!jwtToken) return true;
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    // Buffer by 5 seconds
    return payload.exp * 1000 <= Date.now() + 5000;
  } catch {
    return true;
  }
};

const getStoredUser = (): UserProfile | null => {
  try {
    const raw = safeStorage.getItem('astralis_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getInitialAuthState = (): AuthState => {
  const token = safeStorage.getItem('astralis_access_token') || safeStorage.getItem('token') || null;
  const refreshToken = safeStorage.getItem('astralis_refresh_token') || null;
  const user = getStoredUser();
  const tenantId = safeStorage.getItem('astralis_tenant_id') || 'tenant_default_001';

  // Determine initial authentication validity
  // A session is valid on startup if access token is valid OR if a non-expired refresh token exists
  const hasValidRefreshToken = refreshToken && !isTokenExpired(refreshToken);
  const hasValidAccessToken = token && !isTokenExpired(token);

  const isAuthenticated = Boolean(user && (hasValidAccessToken || hasValidRefreshToken));

  if (!isAuthenticated && !hasValidRefreshToken && !hasValidAccessToken) {
    safeStorage.removeItem('astralis_access_token');
    safeStorage.removeItem('token');
    safeStorage.removeItem('astralis_refresh_token');
    safeStorage.removeItem('astralis_user');
  }

  return {
    user: isAuthenticated ? user : null,
    token: hasValidAccessToken ? token : null,
    refreshToken: hasValidRefreshToken ? refreshToken : null,
    tenantId,
    isAuthenticated
  };
};

const initialState: AuthState = getInitialAuthState();

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: UserProfile; token: string; refreshToken?: string; tenantId?: string }>
    ) => {
      const { user, token, refreshToken, tenantId } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      if (refreshToken) state.refreshToken = refreshToken;
      if (tenantId) state.tenantId = tenantId;

      safeStorage.setItem('astralis_access_token', token);
      safeStorage.setItem('token', token);
      safeStorage.setItem('astralis_user', JSON.stringify(user));
      if (refreshToken) safeStorage.setItem('astralis_refresh_token', refreshToken);
      if (tenantId) safeStorage.setItem('astralis_tenant_id', tenantId);
    },
    updateTokens: (
      state,
      action: PayloadAction<{ token: string; refreshToken?: string }>
    ) => {
      state.token = action.payload.token;
      state.isAuthenticated = true;
      safeStorage.setItem('astralis_access_token', action.payload.token);
      safeStorage.setItem('token', action.payload.token);
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
        safeStorage.setItem('astralis_refresh_token', action.payload.refreshToken);
      }
    },
    setTenantId: (state, action: PayloadAction<string>) => {
      state.tenantId = action.payload;
      safeStorage.setItem('astralis_tenant_id', action.payload);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;

      safeStorage.removeItem('astralis_access_token');
      safeStorage.removeItem('token');
      safeStorage.removeItem('astralis_user');
      safeStorage.removeItem('astralis_refresh_token');
    }
  }
});

export const { setCredentials, updateTokens, setTenantId, logout } = authSlice.actions;
export default authSlice.reducer;
