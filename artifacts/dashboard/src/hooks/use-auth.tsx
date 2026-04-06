import { createContext, useContext, useState, ReactNode } from "react";
import { useLocation } from "wouter";

interface AuthState {
  token: string;
  shopId: string;
  email: string;
  plan?: string;
}

interface AuthContextType {
  auth: AuthState | null;
  login: (state: AuthState) => void;
  logout: () => void;
  isAuthenticated: boolean;
  credentials: { shopId: string; token: string } | null;
}

const STORAGE_KEY = "ow_merchant_session";

function readFromStorage(): AuthState | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthState) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => readFromStorage());
  const [, setLocation] = useLocation();

  const login = (state: AuthState) => {
    setAuth(state);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
    }
  };

  const logout = () => {
    setAuth(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
    }
    setLocation("/");
  };

  const credentials = auth ? { shopId: auth.shopId, token: auth.token } : null;

  return (
    <AuthContext.Provider value={{ auth, login, logout, isAuthenticated: !!auth, credentials }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
