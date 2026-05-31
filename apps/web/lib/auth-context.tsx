'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface AuthUser {
  id: string;
  googleId: string;
  email: string;
  name: string | null;
  username: string;
  imageUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isNewUser: boolean;
  login: (token: string, user: AuthUser, isNew?: boolean) => void;
  logout: () => void;
  updateUser: (user: AuthUser, token?: string) => void;
  clearNewUser: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  isNewUser: false,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
  clearNewUser: () => {},
});

const STORAGE_KEY = 'bc_auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  const login = useCallback((newToken: string, newUser: AuthUser, isNew = false) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setIsNewUser(isNew);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    setIsNewUser(false);
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser, newToken?: string) => {
    setUser(updatedUser);
    if (newToken) {
      localStorage.setItem(STORAGE_KEY, newToken);
      setToken(newToken);
    }
  }, []);

  const clearNewUser = useCallback(() => {
    setIsNewUser(false);
  }, []);

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }

    // Validate token with backend
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then((data: AuthUser) => {
        setToken(stored);
        setUser(data);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isNewUser, login, logout, updateUser, clearNewUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
