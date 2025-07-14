'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  profile: {
    id: string;
    fullName: string | null;
    role: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  requestMagicLink: (email: string) => Promise<{ error: string | null }>;
  verifyMagicLink: (token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      const token = localStorage.getItem('auth_token');

      if (token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('auth_token');
          }
        } catch (error) {
          console.error('Error checking session:', error);
          localStorage.removeItem('auth_token');
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const requestMagicLink = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        setLoading(false);
        return { error: data.error || 'Erro ao enviar link mágico' };
      }

      setLoading(false);
      return { error: null };
    } catch (error) {
      console.error('Error requesting magic link:', error);
      setLoading(false);
      return { error: 'Erro de conexão' };
    }
  }, []);

  const verifyMagicLink = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (!response.ok) {
        setLoading(false);
        return { error: data.error || 'Token inválido' };
      }

      // Store token and set user
      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
      setLoading(false);
      return { error: null };
    } catch (error) {
      console.error('Error verifying magic link:', error);
      setLoading(false);
      return { error: 'Erro de conexão' };
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      localStorage.removeItem('auth_token');
      setUser(null);
      setLoading(false);
      return { error: null };
    } catch (error) {
      console.error('Error signing out:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
      setLoading(false);
      return { error: 'Erro ao fazer logout' };
    }
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    requestMagicLink,
    verifyMagicLink,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
