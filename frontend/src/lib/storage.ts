/**
 * localStorage keys. The product used to be called SpendHiST; values stored under the
 * old `spendhist_*` keys are moved once so existing sessions survive the rename.
 */
export const KEYS = {
  token: "belwara_token",
  userId: "belwara_user_id",
  thread: "belwara_thread_id",
  prefs: "belwara_prefs",
  milestone: (userId: number | string) => `belwara_milestone_${userId}`,
} as const;

const LEGACY: Record<string, string> = {
  spendhist_token: KEYS.token,
  spendhist_user_id: KEYS.userId,
  spendhist_thread_id: KEYS.thread,
  spendhist_prefs: KEYS.prefs,
};

let migrated = false;

export function migrateLegacyKeys() {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  for (const [oldKey, newKey] of Object.entries(LEGACY)) {
    const value = localStorage.getItem(oldKey);
    if (value != null) {
      if (localStorage.getItem(newKey) == null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  }
}

export function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacyKeys();
  return localStorage.getItem(key);
}
