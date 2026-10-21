import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

export async function request(path, options = {}) {
  const config = getConfig();
  const url = `${config.apiBaseUrl}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { 'X-Api-Key': config.apiKey, 'Authorization': `Bearer ${config.apiKey}` } : {}),
    ...options.headers,
  };

  const timeoutMs = options.timeout ?? 8000;
  let controller = null;
  let timeoutId = null;

  if (typeof AbortController !== 'undefined') {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const response = await fetch(url, {
      method: options.method || 'POST',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      keepalive: options.keepalive ?? true,
      signal: controller ? controller.signal : undefined,
    });

    if (timeoutId) clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const errorMsg =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        `Request to ${path} failed with HTTP status ${response.status}`;
      return { ok: false, status: response.status, error: errorMsg, data };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    const isAbort = error.name === 'AbortError';
    const isBlocked = error.message?.includes('Failed to fetch') || error.name === 'TypeError';

    const message = isAbort
      ? `Request to ${path} timed out after ${timeoutMs}ms`
      : isBlocked
      ? `Network request to ${url} was blocked (likely by an ad blocker / privacy extension). Touch gracefully skipped.`
      : `Network error connecting to ${url}: ${error.message}`;

    logger.debug(message);
    return { ok: false, status: 0, error: message, data: null, blocked: isBlocked };
  }
}
