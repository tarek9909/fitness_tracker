import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

export interface AdminUser {
  id: number;
  role: string;
  firstName: string;
  lastName: string | null;
  email: string;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Clean up any legacy app tokens to ensure zero token persistence in browser storage
  useEffect(() => {
    try {
      localStorage.removeItem('fitness_admin_token');
      localStorage.removeItem('fitness_admin_user');
      localStorage.removeItem('fitness_admin_refresh');
      sessionStorage.removeItem('fitness_admin_token');
      sessionStorage.removeItem('fitness_admin_user');
      sessionStorage.removeItem('fitness_admin_refresh');
    } catch {
      // Ignore storage access errors if in restricted iframe/sandbox
    }
  }, []);

  useEffect(() => {
    // Listen for session expiry from API client
    const unsubscribe = api.onSessionExpired(() => {
      setUser(null);
    });

    const initAuth = async () => {
      try {
        // Validate active session via HttpOnly cookie
        const me = await api.get('/me');
        if (me && (me.role === 'admin' || me.role === 'super_admin')) {
          const adminUser: AdminUser = {
            id: me.id,
            role: me.role,
            firstName: me.first_name || me.firstName || 'Admin',
            lastName: me.last_name || me.lastName || null,
            email: me.email,
          };
          setUser(adminUser);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: any; expiresInSeconds: number; csrfToken?: string }>(
      '/auth/login',
      {
        email,
        password,
        clientType: 'web',
        deviceName: 'Admin Dashboard',
      }
    );

    if (res.user.role !== 'admin' && res.user.role !== 'super_admin') {
      await logout();
      throw new Error('Access denied: Administrator privileges required.');
    }

    setUser({
      id: res.user.id,
      role: res.user.role,
      firstName: res.user.first_name || res.user.firstName || 'Admin',
      lastName: res.user.last_name || res.user.lastName || null,
      email: res.user.email,
    });
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore logout transport errors
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
