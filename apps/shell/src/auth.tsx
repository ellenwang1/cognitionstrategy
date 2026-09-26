import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Principal, Session } from "@platform/tool-sdk";
import { AUTH_URL } from "./registry";

const STORAGE_KEY = "platform.session";

interface AuthContextValue {
  session: Session | null;
  users: SeededUser[];
  loading: boolean;
  error: string | null;
  login: (username: string, password?: string) => Promise<void>;
  logout: () => void;
}

export interface SeededUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Mocked OIDC session: password grant against `services/auth`, JWT kept in localStorage. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Session;
      const exp = decodeExp(parsed.token);
      return exp && exp * 1000 < Date.now() ? null : parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });
  const [users, setUsers] = useState<SeededUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${AUTH_URL}/users`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`auth service ${r.status}`))))
      .then((list: SeededUser[]) => setUsers(list))
      .catch((e: Error) => setError(`Cannot reach auth service at ${AUTH_URL}: ${e.message}`));
  }, []);

  const login = useCallback(async (username: string, password = "demo") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AUTH_URL}/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grant_type: "password", username, password }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `login failed (${res.status})`);
      const tok = (await res.json()) as { access_token: string };
      const me = await fetch(`${AUTH_URL}/userinfo`, { headers: { authorization: `Bearer ${tok.access_token}` } });
      if (!me.ok) throw new Error("userinfo failed");
      const principal = (await me.json()) as Principal;
      const next = { token: tok.access_token, principal };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, users, loading, error, login, logout }), [session, users, loading, error, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
