import { safeLocalStorage } from '../utils/storage.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const TOUCH_HISTORY_KEY = 'aid_touches';
const MAX_HISTORY_LENGTH = 50;

/**
 * Validate shape of a stored touch record
 */
export function isStoredTouch(value) {
  if (typeof value !== 'object' || value === null) return false;
  return (
    typeof value.recordedAt === 'number' &&
    typeof value.payload === 'object' &&
    value.payload !== null &&
    typeof value.response === 'object' &&
    value.response !== null
  );
}

/**
 * Read and validate touch history from storage
 */
export function readTouchHistory() {
  try {
    const raw = safeLocalStorage.getItem(TOUCH_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isStoredTouch);
  } catch (error) {
    logger.debug('Could not read touch history:', error);
    return [];
  }
}

/**
 * Save accepted touch with FIFO truncation to prevent storage exhaustion
 */
export function saveSuccessfulTouch(touch) {
  try {
    const history = readTouchHistory();
    history.push(touch);

    // Keep history bounded to avoid QuotaExceededError
    while (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }

    safeLocalStorage.setItem(TOUCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    logger.error('Failed to save touch to storage:', error);
  }
}

/**
 * Check if the payload contains an active marketing signal (paid or explicit campaign)
 */
export function hasMarketingSignal(payload) {
  if (!payload) return false;
  return Boolean(
    payload.source ||
    payload.medium ||
    payload.campaign ||
    payload.gclid ||
    payload.fbclid ||
    payload.ttclid ||
    payload.msclkid ||
    payload.dclid ||
    payload.wbraid ||
    payload.gbraid ||
    payload.twclid ||
    payload.li_fat_id ||
    payload.rdt_cid
  );
}

/**
 * Generate a signature for deduplication
 */
export function getTouchSignature(payload) {
  return [
    payload.visitorId || '',
    payload.source || '',
    payload.medium || '',
    payload.campaign || '',
    payload.gclid || '',
    payload.fbclid || '',
    payload.ttclid || '',
    payload.msclkid || '',
    payload.dclid || '',
    payload.wbraid || '',
    payload.gbraid || '',
    payload.landingPage || '',
  ].join('|');
}

/**
 * Determine whether a new touch should be transmitted to the backend.
 * Prevents duplicates while ensuring multi-touch and session restarts are respected.
 */
export function shouldSendTouch(payload, history = null) {
  const touchHistory = history || readTouchHistory();
  const config = getConfig();
  const sessionWindow = config.sessionWindowMs || 30 * 60 * 1000;

  const previous = touchHistory[touchHistory.length - 1];

  // If no previous touch recorded, always send
  if (!previous) return true;

  // If previous touch is older than the session window, this is a new session
  if (Date.now() - previous.recordedAt > sessionWindow) return true;

  const previousWasAttributed = hasMarketingSignal(previous.payload);
  const currentIsAttributed = hasMarketingSignal(payload);

  // Guard against overwriting an active paid ad attribution with an internal/direct navigation
  if (previousWasAttributed && !currentIsAttributed) {
    logger.debug('Skipping touch: Recent paid attribution protected from direct browse navigation.');
    return false;
  }

  // Exact duplicate signature within the same session window
  if (getTouchSignature(previous.payload) === getTouchSignature(payload)) {
    logger.debug('Skipping touch: Duplicate touch signature within active session window.');
    return false;
  }

  return true;
}
