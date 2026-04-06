import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface AuthState {
  shopId: string;
  email: string;
  plan?: string;
}

interface AuthContextType {
  auth: AuthState | null;
  login: (state: AuthState) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  credentials: { shopId: string } | null;
}

const STORAGE_KEY = "ow_merchant_ui";

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
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  /* On mount, verify the HttpOnly session cookie is still valid by hitting /api/auth/me.
   * If the cookie is missing or expired, clear the local UI state. */
  useEffect(() => {
    const savedState = readFromStorage();
    if (!savedState) {
      setIsLoading(false);
      return;
    }

    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          setAuth(null);
          try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
        }
      })
      .catch(() => {
        // Network error — keep UI state optimistically, server will 401 on real requests
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = (state: AuthState) => {
    setAuth(state);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
    }
    setAuth(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
    }
    setLocation("/");
  };

  const credentials = auth ? { shopId: auth.shopId } : null;

  return (
    <AuthContext.Provider value={{ auth, login, logout, isAuthenticated: !!auth, isLoading, credentials }}>
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
