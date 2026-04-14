"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  getToken,
  getUserId,
  setAuth,
  clearAuth,
  isAuthenticated as checkAuth,
} from "@/lib/auth";
import type { TokenResponse, UserResponse } from "@/types/api";

interface AuthContextValue {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const userId = getUserId();
    if (!userId || !checkAuth()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await api.get<UserResponse>(`/users/${userId}`);
      setUser(data);
    } catch {
      clearAuth();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<TokenResponse>("/users/login", {
        email,
        password,
      });
      setAuth(data.access_token, data.user_id);
      await fetchUser();
      router.push("/dashboard");
    },
    [fetchUser, router],
  );

  const register = useCallback(
    async (email: string, password: string, fullName?: string) => {
      await api.post("/users/register", {
        email,
        password,
        full_name: fullName || undefined,
      });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
