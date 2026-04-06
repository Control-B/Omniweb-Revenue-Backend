import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface AuthState {
  shopId: string;
  email: string;
  plan?: string;
  authProvider?: "legacy" | "clerk";
}

interface AuthContextType {
  auth: AuthState | null;
  login: (state: AuthState) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  credentials: { shopId: string } | null;
  isClerkEnabled: boolean;
}

export interface ClerkBridgeState {
  getToken?: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
}

interface MeResponse {
  shopId: string;
  email: string;
  plan: string;
}

interface ClerkSyncResponse {
  merchantId: string;
  shopId: string;
  email: string;
  plan: string;
  onboardingComplete: boolean;
}

interface AuthProvidersResponse {
  clerkEnabled: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, clerk }: { children: ReactNode; clerk?: ClerkBridgeState }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [isClerkEnabled, setIsClerkEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  /*
   * On every mount, we validate the HttpOnly session cookie by calling /api/auth/me.
   * This is the single source of truth — we do not read from sessionStorage first.
   * If the server says the session is valid, we hydrate auth from its response.
   * This ensures new tabs, restored sessions, and page refreshes all work correctly.
   */
  useEffect(() => {
    let isCancelled = false;

    const hydrate = async () => {
      try {
        const providerRes = await fetch("/api/auth/providers", { credentials: "include" });
        if (providerRes.ok) {
          const providerData = await providerRes.json() as AuthProvidersResponse;
          if (!isCancelled) {
            setIsClerkEnabled(Boolean(providerData.clerkEnabled));
          }
        }

        if (clerk?.isLoaded && clerk.isSignedIn && clerk.getToken) {
          const token = await clerk.getToken();
          if (token) {
            const pendingShopId = window.sessionStorage.getItem("ow_pending_clerk_shop_id") ?? undefined;
            const syncRes = await fetch("/api/auth/clerk/sync", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({ shopId: pendingShopId }),
            });

            if (syncRes.ok) {
              const data = await syncRes.json() as ClerkSyncResponse;
              if (!isCancelled) {
                window.sessionStorage.removeItem("ow_pending_clerk_shop_id");
                setAuth({ shopId: data.shopId, email: data.email, plan: data.plan, authProvider: "clerk" });
                setIsLoading(false);
              }
              return;
            }
          }
        }

        const legacyRes = await fetch("/api/auth/me", { credentials: "include" });
        if (legacyRes.ok) {
          const data = await legacyRes.json() as MeResponse;
          if (!isCancelled) {
            setAuth({ shopId: data.shopId, email: data.email, plan: data.plan, authProvider: "legacy" });
          }
        } else if (!isCancelled) {
          setAuth(null);
        }
      } catch {
        if (!isCancelled) {
          setAuth(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isCancelled = true;
    };
  }, [clerk?.getToken, clerk?.isLoaded, clerk?.isSignedIn]);

  const login = (state: AuthState) => {
    setAuth(state);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
    }

    if (auth?.authProvider === "clerk") {
      await clerk?.signOut().catch(() => undefined);
    }

    setAuth(null);
    setLocation("/");
  };

  const credentials = auth ? { shopId: auth.shopId } : null;

  return (
    <AuthContext.Provider value={{ auth, login, logout, isAuthenticated: !!auth, isLoading, credentials, isClerkEnabled }}>
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
