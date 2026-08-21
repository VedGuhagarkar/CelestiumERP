import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store/store.js';
import { logout, setCredentials, UserProfile } from '../store/slices/authSlice.js';

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);

  return {
    user: auth.user,
    token: auth.token,
    tenantId: auth.tenantId,
    isAuthenticated: auth.isAuthenticated,
    login: (user: UserProfile, token: string, refreshToken?: string, tenantId?: string) =>
      dispatch(setCredentials({ user, token, refreshToken, tenantId })),
    logout: () => dispatch(logout())
  };
}
