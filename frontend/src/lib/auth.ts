import { KEYS, read } from "@/lib/storage";

export function getToken(): string | null {
  return read(KEYS.token);
}

export function getUserId(): number | null {
  const raw = read(KEYS.userId);
  return raw ? parseInt(raw, 10) : null;
}

export function setAuth(token: string, userId: number) {
  localStorage.setItem(KEYS.token, token);
  localStorage.setItem(KEYS.userId, String(userId));
}

export function clearAuth() {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.userId);
  localStorage.removeItem(KEYS.thread);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
