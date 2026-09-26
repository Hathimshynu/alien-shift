/**
 * Tiny async key/value storage. Today it wraps localStorage; in Phase 4 it will prefer
 * Capacitor Preferences on Android. The API is already async so callers won't change.
 * Every call swallows errors: storage can be missing or blocked (private mode, disabled cookies).
 */

export async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — progress just won't persist */
  }
}

export async function loadRaw(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function remove(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
