/**
 * Resilient cross-browser storage utilities with in-memory fallbacks
 * and Safari ITP-aware cookie handling.
 */

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const memoryFallback = new MemoryStorage();

export function isLocalStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__elysium_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export const safeLocalStorage = {
  getItem(key) {
    try {
      if (isLocalStorageAvailable()) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback below
    }
    return memoryFallback.getItem(key);
  },

  setItem(key, value) {
    try {
      if (isLocalStorageAvailable()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Storage quota exceeded or disabled
    }
    memoryFallback.setItem(key, value);
  },

  removeItem(key) {
    try {
      if (isLocalStorageAvailable()) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Fallback
    }
    memoryFallback.removeItem(key);
  }
};

/**
 * Safely parse cookie string regardless of spacing
 */
export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  try {
    const escapedName = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`(?:^|;)\\s*${escapedName}=([^;]*)`);
    const match = document.cookie.match(regex);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Set a cookie safely with max-age, path, sameSite, and optional domain
 */
export function setCookie(name, value, options = {}) {
  if (typeof document === 'undefined') return;
  try {
    const maxAge = options.maxAge ?? 63072000; // 2 years default
    const path = options.path ?? '/';
    const sameSite = options.sameSite ?? 'Lax';
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secure = options.secure ?? isHttps;

    let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=${maxAge}; path=${path}; SameSite=${sameSite}`;
    if (secure) cookieStr += '; Secure';
    if (options.domain) cookieStr += `; domain=${options.domain}`;

    document.cookie = cookieStr;
  } catch {
    // In restricted iframe or sandbox
  }
}
