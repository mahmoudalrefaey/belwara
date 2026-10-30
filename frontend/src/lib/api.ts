import axios from "axios";
import { clearAuth, getToken } from "@/lib/auth";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000",
  timeout: 0,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // A wrong password on the login form is a 401 too: let the form show it instead of reloading.
    const isLogin = String(err.config?.url ?? "").includes("/users/login");
    if (err.response?.status === 401 && !isLogin && typeof window !== "undefined") {
      clearAuth();
      // Keep the current language: /ar/... or /en/...
      const locale = window.location.pathname.split("/")[1] === "en" ? "en" : "ar";
      window.location.href = `/${locale}/login`;
    }
    return Promise.reject(err);
  },
);

/** Status code of an axios error, if any. */
export function errorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

/** Server message from `{detail: "..."}` or `{detail: {message}}`, if any. */
export function errorDetail(err: unknown): string | undefined {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return undefined;
}
