const TOKEN_KEY = "spendhist_token";
const USER_ID_KEY = "spendhist_user_id";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_ID_KEY);
  return raw ? parseInt(raw, 10) : null;
}

export function setAuth(token: string, userId: number) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, String(userId));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem("spendhist_thread_id");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
