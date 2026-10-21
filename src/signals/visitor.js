import { safeLocalStorage, getCookie, setCookie } from '../utils/storage.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const VISITOR_ID_KEY = 'aid_vid';
let memoryVisitorId = null;

/**
 * Generate standard UUIDv4 with crypto fallback
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint8Array(16);
      crypto.getRandomValues(buffer);
      buffer[6] = (buffer[6] & 0x0f) | 0x40;
      buffer[8] = (buffer[8] & 0x3f) | 0x80;
      const hex = Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  const randomHex = () => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Number.parseInt(randomHex(), 16);
    return (character === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

/**
 * Retrieve or create persistent visitor ID.
 * Keeps cookie and localStorage synchronized to prevent identity loss across ITP/subdomains.
 */
export function getVisitorId() {
  if (memoryVisitorId) {
    return memoryVisitorId;
  }

  // 1. Try LocalStorage
  let visitorId = safeLocalStorage.getItem(VISITOR_ID_KEY);

  // 2. Try Cookie if not in LocalStorage
  if (!visitorId) {
    visitorId = getCookie(VISITOR_ID_KEY);
  }

  // 3. Generate new if missing
  if (!visitorId) {
    visitorId = generateUUID();
    logger.debug('Generated new visitor ID:', visitorId);
  }

  // 4. Synchronize back to both storages
  const config = getConfig();
  safeLocalStorage.setItem(VISITOR_ID_KEY, visitorId);
  setCookie(VISITOR_ID_KEY, visitorId, {
    maxAge: 63072000, // 2 years
    path: '/',
    domain: config.cookieDomain,
  });

  memoryVisitorId = visitorId;
  return visitorId;
}

/**
 * Set custom or backend-canonicalized visitor ID
 */
export function setVisitorId(newId) {
  if (!newId || typeof newId !== 'string') return;
  memoryVisitorId = newId;
  const config = getConfig();
  safeLocalStorage.setItem(VISITOR_ID_KEY, newId);
  setCookie(VISITOR_ID_KEY, newId, {
    maxAge: 63072000,
    path: '/',
    domain: config.cookieDomain,
  });
}
