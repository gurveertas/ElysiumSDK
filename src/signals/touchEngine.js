import { getVisitorId, setVisitorId } from './visitor.js';
import { extractMarketingParams } from './params.js';
import { parseReferrer } from './referrer.js';
import { shouldSendTouch, saveSuccessfulTouch, readTouchHistory } from './session.js';
import { request } from './transport.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Construct full touch payload with parameters, referrer, and visitor ID
 */
export function buildPayload(customData = {}) {
  const config = getConfig();
  const visitorId = getVisitorId();
  const { utm, clickIds, cookies, custom } = extractMarketingParams();
  const referrerInfo = parseReferrer();

  // If UTM source/medium missing, infer from organic/social referrer
  const source = utm.source || referrerInfo.detectedSource || null;
  const medium = utm.medium || referrerInfo.detectedMedium || null;

  const currentHref = typeof window !== 'undefined' ? window.location.href : '';
  const currentTitle = typeof document !== 'undefined' ? document.title : '';

  return {
    visitorId,
    touchedAt: new Date().toISOString(),
    source,
    medium,
    campaign: utm.campaign,
    term: utm.term,
    content: utm.content,
    referrer: referrerInfo.referrer,
    landingPage: currentHref,
    pageTitle: currentTitle,
    channel: referrerInfo.channel,
    ...clickIds,
    ...cookies,
    custom: { ...custom, ...customData },
  };
}

/**
 * Record a marketing touchpoint
 */
export async function recordTouch(options = {}) {
  const config = getConfig();

  if (!config.apiKey) {
    logger.warn('Tracking disabled: apiKey is not configured.');
    return { ok: false, error: 'apiKey missing' };
  }

  // Path regex check if configured (e.g. for product pages only)
  if (config.productPathRegex && typeof window !== 'undefined') {
    const regex =
      config.productPathRegex instanceof RegExp
        ? config.productPathRegex
        : new RegExp(config.productPathRegex);
    if (!regex.test(window.location.pathname)) {
      logger.debug('Skipping touch: Path did not match productPathRegex.');
      return { ok: false, skipped: true, reason: 'path_mismatch' };
    }
  }

  const payload = buildPayload(options.customData);
  const history = readTouchHistory();

  if (!options.force && !shouldSendTouch(payload, history)) {
    logger.debug('Touch not sent: Duplicate or redundant in active session.');
    return { ok: false, skipped: true, reason: 'deduplicated' };
  }

  logger.info('Sending touch payload:', payload);

  const res = await request('/v1/touches', {
    method: 'POST',
    body: payload,
  });

  if (!res.ok) {
    // If request blocked by adblocker, we still save local event so UI/visitor state remains intact
    if (res.blocked) {
      logger.debug('Touch request blocked by client extension; continuing in local offline mode.');
    } else {
      logger.error('Failed to record touch:', res.error);
      return res;
    }
  }

  const responseData = res.data || {
    id: `local_${Date.now()}`,
    visitorId: payload.visitorId,
    channel: payload.channel || 'direct',
    touchedAt: payload.touchedAt,
    offlineMode: res.blocked ?? false,
  };

  saveSuccessfulTouch({
    payload,
    response: responseData,
    recordedAt: Date.now(),
  });

  logger.info('Touch recorded successfully:', responseData);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('elysium:touch_recorded', {
        detail: { payload, response: responseData },
      })
    );
  }

  return { ok: true, data: responseData };
}

/**
 * Backward-compatible product touch tracker from existing touch-tracking.ts
 */
export async function recordProductTouch() {
  const config = getConfig();
  const pathRegex = config.productPathRegex || /^\/product\/[^/]+\/?$/;
  if (typeof window !== 'undefined' && !pathRegex.test(window.location.pathname)) {
    return;
  }
  return recordTouch();
}

/**
 * Identify a visitor with their email and optional user traits
 */
export async function identifyVisitor(email, traits = {}) {
  const config = getConfig();

  if (!config.apiKey) {
    logger.warn('Visitor identification failed: apiKey is not configured.');
    return false;
  }

  if (!email || typeof email !== 'string') {
    logger.error('identifyVisitor requires a valid email string.');
    return false;
  }

  const visitorId = getVisitorId();
  const payload = {
    visitorId,
    email,
    traits,
    identifiedAt: new Date().toISOString(),
  };

  const res = await request('/v1/identify', {
    method: 'POST',
    body: payload,
  });

  if (!res.ok) {
    logger.debug('Identify request status:', res.error);
    return false;
  }

  if (res.data && res.data.canonicalVisitorId) {
    setVisitorId(res.data.canonicalVisitorId);
  }

  logger.info('Visitor identified successfully:', res.data);
  return true;
}

/**
 * Request checkout attribution session token
 */
export async function createCheckoutSession() {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error('Checkout session was not created: apiKey is not configured.');
  }

  const visitorId = getVisitorId();
  const res = await request('/v1/checkout-sessions', {
    method: 'POST',
    body: { visitorId },
  });

  if (!res.ok) {
    // Generate resilient offline session if network/adblocker blocks the API
    return {
      checkoutSessionId: `chk_local_${Date.now()}`,
      token: `tok_local_${Date.now()}`,
      visitorId,
      visitorRecordId: 'local_record',
      touchIds: [],
      touchCount: 1,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
  }

  const result = res.data;
  return {
    checkoutSessionId: result.checkoutSessionId,
    token: result.token,
    visitorId: result.visitorId || visitorId,
    visitorRecordId: result.visitorRecordId || '',
    touchIds: Array.isArray(result.touchIds) ? result.touchIds : [],
    touchCount: typeof result.touchCount === 'number' ? result.touchCount : 0,
    expiresAt: result.expiresAt || new Date(Date.now() + 3600000).toISOString(),
  };
}
