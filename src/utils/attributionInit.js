import { init, recordTouch, getVisitorId } from '../index.js';

/**
 * Lightweight attribution initializer helper
 *
 * @param {string} apiKey Publishable API Key
 * @param {string} [apiBaseUrl] Optional backend API base URL
 */
export function initAttribution(apiKey, apiBaseUrl) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('A valid publishable API key is required.');
  }

  return init({
    apiKey,
    ...(apiBaseUrl ? { apiBaseUrl } : {}),
    autoTrack: true,
  });
}

export default initAttribution;
