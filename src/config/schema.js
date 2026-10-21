import { logger } from '../utils/logger.js';

export const DEFAULT_CONFIG = {
  apiKey: '',
  apiBaseUrl: 'https://asbTemp-production.up.railway.app',
  debug: false,
  sessionWindowMs: 30 * 60 * 1000, // 30 minutes
  buttonSelector: '.elysium-payment-button',
  autoTrack: true,
  productPathRegex: null,
  cookieDomain: undefined,
  customParams: [],
  gateways: {
    stripe: {
      enabled: true,
      publishableKey: '',
    },
    razorpay: {
      enabled: true,
      keyId: '',
    },
    paypal: {
      enabled: true,
      clientId: '',
    },
  },
};

const SECRET_KEY_PATTERNS = [
  /^sk_live_[0-9a-zA-Z]+/i,
  /^sk_test_[0-9a-zA-Z]+/i,
  /^sec_[0-9a-zA-Z]+/i,
  /secret/i,
];

/**
 * Audit configuration for secret key exposure and validate values.
 */
export function validateAndSanitizeConfig(userConfig = {}) {
  const sanitized = { ...DEFAULT_CONFIG, ...userConfig };

  // Check for exposed secret keys in common mistake fields
  const suspiciousKeys = ['apiSecret', 'secretKey', 'clientSecret', 'privateKey'];
  for (const key of suspiciousKeys) {
    if (sanitized[key]) {
      logger.error(
        `SECURITY WARNING: "${key}" was found in browser configuration! Secret keys must NEVER be exposed in client-side code. This key has been stripped for your security.`
      );
      delete sanitized[key];
    }
  }

  // Check gateway credentials
  if (sanitized.gateways && typeof sanitized.gateways === 'object') {
    sanitized.gateways = { ...DEFAULT_CONFIG.gateways, ...sanitized.gateways };

    for (const [gwName, gwConfig] of Object.entries(sanitized.gateways)) {
      if (!gwConfig || typeof gwConfig !== 'object') continue;

      for (const [k, v] of Object.entries(gwConfig)) {
        if (typeof v === 'string') {
          for (const pattern of SECRET_KEY_PATTERNS) {
            if (pattern.test(k) || pattern.test(v)) {
              logger.error(
                `SECURITY WARNING: Possible secret credential detected in gateway "${gwName}.${k}". Secret keys must remain on the backend!`
              );
            }
          }
        }
      }
    }
  }

  // Ensure base URL has no trailing slashes
  if (sanitized.apiBaseUrl && typeof sanitized.apiBaseUrl === 'string') {
    sanitized.apiBaseUrl = sanitized.apiBaseUrl.replace(/\/+$/, '');
  }

  // Ensure sessionWindowMs is valid positive integer
  if (typeof sanitized.sessionWindowMs !== 'number' || sanitized.sessionWindowMs <= 0) {
    sanitized.sessionWindowMs = DEFAULT_CONFIG.sessionWindowMs;
  }

  return sanitized;
}
