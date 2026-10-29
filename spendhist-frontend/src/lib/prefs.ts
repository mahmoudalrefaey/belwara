import type { UserPrefs } from "@/types/api";

const PREFS_KEY = "spendhist_prefs";

const DEFAULTS: UserPrefs = {
  defaultCurrency: "EGP",
  theme: "system",
};

export function getPrefs(): UserPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function setPrefs(patch: Partial<UserPrefs>) {
  const current = getPrefs();
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...patch }));
}
