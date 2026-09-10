import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../lib/api';

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  role: string;
  createdAt?: string;
}

export interface RegisterParams {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterParams) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  setAuthData: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'emart_token';
const TOKEN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // Refresh every 6 hours

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore user profile if token exists on app load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      console.log('[Auth] Initializing auth, token exists:', !!storedToken);
      
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      // Don't block rendering - load profile in background
      setToken(storedToken);
      setIsLoading(false);

      try {
        const userData = await api.get<User>('/auth/profile');
        console.log('[Auth] User profile loaded:', userData);
        setUser(userData);
      } catch (error) {
        console.error('[Auth] Session restoration failed:', error);
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    };

    initAuth();
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    try {
      const res = await api.post<{ token: string }>('/auth/refresh-token');
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }, []);

  // Auto refresh token periodically
  useEffect(() => {
    if (!token || !user) return;

    const refreshInterval = setInterval(async () => {
      try {
        await refreshToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails, clear auth state
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    }, TOKEN_REFRESH_INTERVAL);

    return () => clearInterval(refreshInterval);
  }, [token, user, refreshToken]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post<{ user: User; token: string }>('/auth/login', {
        email,
        password,
      });

      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      if (error instanceof ApiError) {
        throw new Error(error.message);
      }
      throw new Error('Login failed. Please check your connection and try again.');
    }
  }, []);

  const register = useCallback(async (data: RegisterParams) => {
    try {
      const res = await api.post<{ user: User; token: string }>('/auth/register', data);

      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(error.message);
      }
      throw new Error('Registration failed. Please try again.');
    }
  }, []);

  const logout = useCallback(() => {
    // Call logout endpoint (fire and forget)
    if (token) {
      api.post('/auth/logout').catch(() => {
        // Ignore errors on logout
      });
    }

    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  const updateProfile = useCallback(
    async (data: { firstName?: string; lastName?: string; phone?: string }) => {
      try {
        const updatedUser = await api.put<User>('/auth/profile', data);
        setUser(updatedUser);
      } catch (error) {
        if (error instanceof ApiError) {
          throw new Error(error.message);
        }
        throw new Error('Profile update failed. Please try again.');
      }
    },
    []
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
      try {
        await api.post('/auth/change-password', {
          currentPassword,
          newPassword,
          confirmPassword,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          throw new Error(error.message);
        }
        throw new Error('Password change failed. Please try again.');
      }
    },
    []
  );

  const setAuthData = useCallback((newToken: string, newUser: User) => {
    console.log('[Auth] Setting auth data:', { user: newUser, hasToken: !!newToken });
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        refreshToken,
        setAuthData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
