import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../services/api';

export interface AuthUser {
  email: string;
  role: string;
  tenant_id: string;
  user_id?: string;
  auth_mode?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  tenantId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, orgName: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'retainai_jwt';
const TENANT_KEY = 'retainai_tenant_id';
const USER_KEY = 'retainai_user';

function persist(token: string, tenantId: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TENANT_KEY, tenantId);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // also set api header + X-Tenant-Id
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  api.defaults.headers.common['X-Tenant-Id'] = tenantId;
}

function clearPersist() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(USER_KEY);
  delete api.defaults.headers.common['Authorization'];
  delete api.defaults.headers.common['X-Tenant-Id'];
}

function loadPersist(): { token: string | null; tenantId: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const tenantId = localStorage.getItem(TENANT_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
    return { token, tenantId, user };
  } catch {
    return { token: null, tenantId: null, user: null };
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [{ token, tenantId, user }, setAuth] = useState(() => loadPersist());
  const [loading, setLoading] = useState(false);

  // hydrate api headers on mount
  useEffect(() => {
    if (token && tenantId) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.defaults.headers.common['X-Tenant-Id'] = tenantId;
    }
    // try refresh me if token exists but user is demo stub
    if (token) {
      refreshMe().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMe = async () => {
    if (!token) return;
    try {
      const r = await api.get('/auth/me');
      const data = r.data as { email: string; role: string; tenant_id: string; auth_mode?: string };
      if (data?.email && data?.tenant_id) {
        const nextUser: AuthUser = { email: data.email, role: data.role, tenant_id: data.tenant_id, auth_mode: data.auth_mode };
        const nextTid = data.tenant_id;
        setAuth(prev => ({ ...prev, user: nextUser, tenantId: nextTid }));
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        localStorage.setItem(TENANT_KEY, nextTid);
        api.defaults.headers.common['X-Tenant-Id'] = nextTid;
      }
    } catch {
      // token may be demo bypass valid; keep as is
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const r = await api.post('/auth/login', { email, password });
      const data = r.data as { access_token: string; role: string; tenant_id?: string; expires_in: number };
      const t = data.access_token;
      const tid = data.tenant_id || (JSON.parse(atob(t.split('.')[1])) as { tid?: string }).tid || 'demo-tenant-001';
      const role = data.role || 'MEMBER';
      const nextUser: AuthUser = { email: email.toLowerCase().trim(), role, tenant_id: tid, auth_mode: 'JWT' };
      persist(t, tid, nextUser);
      setAuth({ token: t, tenantId: tid, user: nextUser });
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string, orgName: string) => {
    setLoading(true);
    try {
      const r = await api.post('/auth/signup', { email, password, orgName, name: orgName, tenant_name: orgName });
      const data = r.data as { access_token: string; role: string; tenant_id: string; user_id: string; expires_in: number };
      const t = data.access_token;
      const tid = data.tenant_id;
      const nextUser: AuthUser = { email: email.toLowerCase().trim(), role: data.role || 'ADMIN', tenant_id: tid, user_id: data.user_id, auth_mode: 'JWT' };
      persist(t, tid, nextUser);
      setAuth({ token: t, tenantId: tid, user: nextUser });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearPersist();
    setAuth({ token: null, tenantId: null, user: null });
  };

  const isDemo = !token || user?.auth_mode === 'DEMO_BYPASS' || tenantId === 'demo-tenant-001';
  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, tenantId, loading, isAuthenticated, isDemo, login, signup, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
