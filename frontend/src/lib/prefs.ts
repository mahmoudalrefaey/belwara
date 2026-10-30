import type { UserPrefs } from "@/types/api";
import { KEYS, read } from "@/lib/storage";

const DEFAULTS: UserPrefs = {
  defaultCurrency: "EGP",
  theme: "system",
};

export function getPrefs(): UserPrefs {
  try {
    const raw = read(KEYS.prefs);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function setPrefs(patch: Partial<UserPrefs>) {
  localStorage.setItem(KEYS.prefs, JSON.stringify({ ...getPrefs(), ...patch }));
}
