import React, { createContext, useContext, useState, useEffect } from 'react';

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
    setUser(null);
    localStorage.removeItem('user');
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
