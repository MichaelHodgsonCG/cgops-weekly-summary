import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

interface User {
  id: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (userId: string, userName: string, role: string) => void;
  logout: () => void;
  isAdmin: boolean;
  isHQ: boolean;
  isExecChef: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = (userId: string, userName: string, role: string) => {
    const userData = { id: userId, name: userName, role };
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    // Office cohort signed in via the CGOPS handoff: end that Supabase session
    // and return to CGOPS rather than dropping them on a PIN screen they can't
    // use. Chefs (PIN login) just clear their local session.
    const viaCgops = localStorage.getItem('auth_via') === 'cgops';
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_via');
    if (viaCgops) {
      void supabase.auth.signOut();
      const cgopsUrl = import.meta.env.VITE_CGOPS_URL as string | undefined;
      if (cgopsUrl) window.location.replace(cgopsUrl);
    }
  };

  const normalizedRole = (user?.role || '').toLowerCase().trim();
  const isAdmin = normalizedRole === 'admin';
  const isHQ = normalizedRole === 'hq';
  const isExecChef = normalizedRole.includes('exec');

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isHQ, isExecChef }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
