import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getAuthProfile, ApiError } from '../lib/api';
import { apiCache } from '../lib/apiCache';
import type { UserRole } from '../types/role';

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  /** CUSTOMER | SELLER | ADMIN — assigned server-side, never by the client. */
  role: UserRole;
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
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterParams) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  setAuthData: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'emart_token';
const PROFILE_CACHE_KEY = 'emart_profile_cache';
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const TOKEN_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // Refresh every 6 hours

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore user profile if token exists on app load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      // Try cache first
      const cachedProfile = localStorage.getItem(PROFILE_CACHE_KEY);
      if (cachedProfile) {
        try {
          const { profile, timestamp } = JSON.parse(cachedProfile);
          if (Date.now() - timestamp < PROFILE_CACHE_TTL) {
            setUser(profile);
            setToken(storedToken);
            setIsLoading(false);
            return; // Skip API call
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }

      // No valid cache, fetch profile
      setToken(storedToken);

      try {
        const userData = await getAuthProfile<User>();
        setUser(userData);
        // Cache profile
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
          profile: userData,
          timestamp: Date.now(),
        }));
      } catch (error) {
        // Only discard the stored session on an authentication failure
        // (401/403). A transient network error or server error must NOT
        // destroy a valid session — keep the token so the next reload can
        // retry, otherwise a single backend hiccup silently logs users out.
        const isAuthFailure = error instanceof ApiError && (error.status === 401 || error.status === 403);
        if (isAuthFailure) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(PROFILE_CACHE_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
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
        // Only clear the session if the token is actually rejected (401/403).
        // Network/server hiccups should not wipe a valid session.
        const isAuthFailure = error instanceof ApiError && (error.status === 401 || error.status === 403);
        if (isAuthFailure) {
          console.error('Token refresh failed:', error);
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
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
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        profile: res.user,
        timestamp: Date.now(),
      }));
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } catch (error) {
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
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        profile: res.user,
        timestamp: Date.now(),
      }));
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
    localStorage.removeItem(PROFILE_CACHE_KEY);
    // Drop all cached API responses so no seller/order/profile data from the
    // previous account can surface after switching users.
    apiCache.clear();
    setToken(null);
    setUser(null);
  }, [token]);

  const updateProfile = useCallback(
    async (data: { firstName?: string; lastName?: string; phone?: string; email?: string }) => {
      try {
        const updatedUser = await api.put<User>('/auth/profile', data);
        setUser(updatedUser);
        // Update cache
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
          profile: updatedUser,
          timestamp: Date.now(),
        }));
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
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      profile: newUser,
      timestamp: Date.now(),
    }));
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
