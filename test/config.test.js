import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndSanitizeConfig } from '../src/config/schema.js';

describe('Configuration & Security Sanitization Module', () => {
  it('loads default configuration with fallback values', () => {
    const config = validateAndSanitizeConfig({});
    assert.ok(config.apiBaseUrl);
    assert.equal(config.buttonSelector, '.elysium-payment-button');
    assert.equal(config.sessionWindowMs, 1800000);
  });

  it('removes trailing slashes from apiBaseUrl', () => {
    const config = validateAndSanitizeConfig({
      apiBaseUrl: 'http://localhost:5000///',
    });
    assert.equal(config.apiBaseUrl, 'http://localhost:5000');
  });

  it('strips client-exposed secret keys to prevent security leaks', () => {
    const unsafeConfig = {
      apiKey: 'pk_live_safe_123',
      secretKey: 'sk_live_DANGEROUS_SECRET_NEVER_EXPOSE',
      apiSecret: 'SUPER_SECRET',
      clientSecret: 'ANOTHER_SECRET',
    };

    const sanitized = validateAndSanitizeConfig(unsafeConfig);
    assert.equal(sanitized.apiKey, 'pk_live_safe_123');
    assert.equal(sanitized.secretKey, undefined);
    assert.equal(sanitized.apiSecret, undefined);
    assert.equal(sanitized.clientSecret, undefined);
  });
});
