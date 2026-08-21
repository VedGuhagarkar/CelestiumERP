import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
}

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  tenantId: string;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('astralis_access_token') || null,
  refreshToken: localStorage.getItem('astralis_refresh_token') || null,
  tenantId: localStorage.getItem('astralis_tenant_id') || 'tenant_default_001',
  isAuthenticated: !!localStorage.getItem('astralis_access_token')
};

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

      localStorage.setItem('astralis_access_token', token);
      if (refreshToken) localStorage.setItem('astralis_refresh_token', refreshToken);
      if (tenantId) localStorage.setItem('astralis_tenant_id', tenantId);
    },
    setTenantId: (state, action: PayloadAction<string>) => {
      state.tenantId = action.payload;
      localStorage.setItem('astralis_tenant_id', action.payload);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;

      localStorage.removeItem('astralis_access_token');
      localStorage.removeItem('astralis_refresh_token');
    }
  }
});

export const { setCredentials, setTenantId, logout } = authSlice.actions;
export default authSlice.reducer;
