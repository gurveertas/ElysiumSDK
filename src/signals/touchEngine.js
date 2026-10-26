import { getVisitorId, setVisitorId } from './visitor.js';
import { extractMarketingParams } from './params.js';
import { parseReferrer } from './referrer.js';
import { shouldSendTouch, saveSuccessfulTouch, readTouchHistory } from './session.js';
import { request } from './transport.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';

let cachedCheckoutSession = null;

/**
 * Construct full touch payload with UTMs, click IDs, ad cookies, and visitor ID
 * Strictly matches the backend Touch schema in contract.prisma
 */
export function buildPayload(customData = {}) {
  const visitorId = getVisitorId();
  const { utm, clickIds, cookies } = extractMarketingParams();
  const referrerInfo = parseReferrer();

  // If UTM source/medium missing, infer from organic or social referrer
  const source = utm.source || referrerInfo.detectedSource || null;
  const medium = utm.medium || referrerInfo.detectedMedium || null;

  const currentHref = typeof window !== 'undefined' ? window.location.href : '';
  const currentTitle = typeof document !== 'undefined' ? document.title : '';

  return {
    visitorId,
    touchedAt: new Date().toISOString(),
    source,
    medium,
    campaign: utm.campaign || null,
    term: utm.term || null,
    content: utm.content || null,
    referrer: referrerInfo.referrer || null,
    landingPage: currentHref,
    pageTitle: currentTitle,
    gclid: clickIds.gclid || null,
    fbclid: clickIds.fbclid || null,
    ttclid: clickIds.ttclid || null,
    msclkid: clickIds.msclkid || null,
    fbc: cookies.fbc || null,
    fbp: cookies.fbp || null,
    ga: cookies.ga || null,
    ...customData,
  };
}

/**
 * Record a marketing touchpoint (Page View / Ad Landing)
 * Backend Endpoint: POST /v1/touches
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

  logger.info('Recording touchpoint:', payload);

  const res = await request('/v1/touches', {
    method: 'POST',
    body: payload,
  });

  if (!res.ok) {
    if (res.blocked) {
      logger.debug('Touch request blocked by adblocker/browser extension; continuing in offline mode.');
    } else {
      logger.error('Failed to record touch:', res.error);
      return res;
    }
  }

  const responseData = res.data || {
    id: `local_${Date.now()}`,
    touchId: `local_${Date.now()}`,
    visitorId: payload.visitorId,
    channel: 'direct',
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
 * Backward-compatible product touch tracker
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
 * Identify a visitor with their email and/or phone number.
 * Links anonymous visitor to customer identity.
 * Backend Endpoint: POST /v1/identify
 *
 * Can be called as:
 *   identify(email, phone)
 *   identify({ email, phone })
 */
export async function identify(emailOrData, optionalPhone = null) {
  const config = getConfig();

  if (!config.apiKey) {
    logger.warn('Visitor identification failed: apiKey is not configured.');
    return { ok: false, error: 'apiKey missing' };
  }

  let email = null;
  let phone = null;

  if (emailOrData && typeof emailOrData === 'object') {
    email = emailOrData.email || null;
    phone = emailOrData.phone || optionalPhone || null;
  } else if (typeof emailOrData === 'string') {
    email = emailOrData || null;
    phone = optionalPhone || null;
  }

  if (!email && !phone) {
    const errorMsg = 'identify requires at least an email or phone number.';
    logger.error(errorMsg);
    return { ok: false, error: errorMsg };
  }

  const visitorId = getVisitorId();
  const payload = {
    visitorId,
    ...(email ? { email: email.trim().toLowerCase() } : {}),
    ...(phone ? { phone: phone.trim() } : {}),
  };

  logger.info('Identifying visitor:', { ...payload, email: email ? '***' : null, phone: phone ? '***' : null });

  const res = await request('/v1/identify', {
    method: 'POST',
    body: payload,
  });

  if (!res.ok) {
    logger.error('Identify request failed:', res.error);
    return res;
  }

  logger.info('Visitor identified successfully:', res.data);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('elysium:visitor_identified', {
        detail: res.data,
      })
    );
  }

  return { ok: true, data: res.data };
}

// Alias for backwards compatibility
export const identifyVisitor = identify;

/**
 * Request checkout attribution session snapshot token
 * Backend Endpoint: POST /v1/checkout-sessions
 */
export async function createCheckoutSession(options = {}) {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error('Checkout session was not created: apiKey is not configured.');
  }

  const visitorId = getVisitorId();
  const expiresInMs = options.expiresInMs || 2 * 60 * 60 * 1000; // 2 hours default

  const res = await request('/v1/checkout-sessions', {
    method: 'POST',
    body: {
      visitorId,
      expiresInMs,
    },
  });

  if (!res.ok) {
    // Generate resilient offline session if network/adblocker blocks the API
    const fallback = {
      checkoutSessionId: `chk_local_${Date.now()}`,
      token: `tok_local_${Date.now()}`,
      visitorId,
      visitorRecordId: 'local_record',
      touchIds: [],
      touchCount: 1,
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    };
    cachedCheckoutSession = { ...fallback, cachedAt: Date.now() };
    return { ok: true, data: fallback };
  }

  const sessionData = {
    checkoutSessionId: res.data.checkoutSessionId,
    token: res.data.token,
    visitorId: res.data.visitorId || visitorId,
    visitorRecordId: res.data.visitorRecordId || '',
    touchIds: Array.isArray(res.data.touchIds) ? res.data.touchIds : [],
    touchCount: typeof res.data.touchCount === 'number' ? res.data.touchCount : 0,
    expiresAt: res.data.expiresAt || new Date(Date.now() + expiresInMs).toISOString(),
  };

  cachedCheckoutSession = { ...sessionData, cachedAt: Date.now() };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('elysium:checkout_session_created', {
        detail: sessionData,
      })
    );
  }

  return { ok: true, data: sessionData };
}

/**
 * Get or create a valid checkout token string for payment/booking integrations.
 * Can be passed directly to Stripe metadata, Razorpay notes, PayPal custom_id, etc.
 *
 * @returns {Promise<string>} The checkout token string (e.g., 'cs_sec_...')
 */
export async function getCheckoutToken(options = {}) {
  const now = Date.now();
  // Reuse existing valid token if created within the last 15 minutes and not expired
  if (
    cachedCheckoutSession &&
    cachedCheckoutSession.token &&
    now - cachedCheckoutSession.cachedAt < 15 * 60 * 1000 &&
    new Date(cachedCheckoutSession.expiresAt).getTime() > now
  ) {
    return cachedCheckoutSession.token;
  }

  const result = await createCheckoutSession(options);
  return result.data?.token || '';
}

/**
 * Ingest a paid order / conversion into the attribution platform.
 * Matches the order to marketing touches across all 6 attribution models.
 * Backend Endpoint: POST /v1/orders (alias /v1/conversions)
 */
export async function createOrder(orderData = {}) {
  const config = getConfig();

  if (!config.apiKey) {
    logger.warn('Order ingestion skipped: apiKey is not configured.');
    return { ok: false, error: 'apiKey missing' };
  }

  if (!orderData.externalId) {
    const errorMsg = 'createOrder requires an externalId (order ID).';
    logger.error(errorMsg);
    return { ok: false, error: errorMsg };
  }

  if (orderData.grossAmount === undefined || orderData.netAmount === undefined) {
    const errorMsg = 'createOrder requires grossAmount and netAmount in major units (e.g. 99.99).';
    logger.error(errorMsg);
    return { ok: false, error: errorMsg };
  }

  const visitorId = getVisitorId();
  const checkoutToken = orderData.checkoutToken || cachedCheckoutSession?.token || null;

  const payload = {
    externalId: String(orderData.externalId),
    orderedAt: orderData.orderedAt || new Date().toISOString(),
    currency: (orderData.currency || 'USD').toUpperCase(),
    grossAmount: Number(orderData.grossAmount),
    netAmount: Number(orderData.netAmount),
    discountAmount: Number(orderData.discountAmount || 0),
    taxAmount: Number(orderData.taxAmount || 0),
    checkoutToken: checkoutToken || undefined,
    visitorId,
    email: orderData.email || undefined,
    phone: orderData.phone || undefined,
    locationId: orderData.locationId || undefined,
    idempotencyKey: orderData.idempotencyKey || String(orderData.externalId),
    items: Array.isArray(orderData.items) ? orderData.items : [],
    connectorId: orderData.connectorId || undefined,
  };

  logger.info('Creating attributed order:', { externalId: payload.externalId, grossAmount: payload.grossAmount, currency: payload.currency });

  const res = await request('/v1/orders', {
    method: 'POST',
    body: payload,
  });

  if (!res.ok) {
    logger.error('Failed to create order:', res.error);
    return res;
  }

  logger.info('Order attributed successfully:', res.data);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('elysium:order_created', {
        detail: res.data,
      })
    );
  }

  return { ok: true, data: res.data };
}

// Aliases
export const recordOrder = createOrder;
export const recordConversion = createOrder;

/**
 * Ingest a service booking into the attribution platform.
 * Attributed at booking creation time across all 6 attribution models.
 * Backend Endpoint: POST /v1/bookings
 */
export async function createBooking(bookingData = {}) {
  const config = getConfig();

  if (!config.apiKey) {
    logger.warn('Booking ingestion skipped: apiKey is not configured.');
    return { ok: false, error: 'apiKey missing' };
  }

  if (!bookingData.externalId) {
    const errorMsg = 'createBooking requires an externalId (booking ID).';
    logger.error(errorMsg);
    return { ok: false, error: errorMsg };
  }

  if (!bookingData.appointmentStartAt) {
    const errorMsg = 'createBooking requires appointmentStartAt (ISO date string).';
    logger.error(errorMsg);
    return { ok: false, error: errorMsg };
  }

  const visitorId = getVisitorId();
  const checkoutToken = bookingData.checkoutToken || cachedCheckoutSession?.token || null;

  const payload = {
    externalId: String(bookingData.externalId),
    appointmentStartAt: bookingData.appointmentStartAt,
    currency: (bookingData.currency || 'USD').toUpperCase(),
    bookedValue: Number(bookingData.bookedValue || 0),
    checkoutToken: checkoutToken || undefined,
    visitorId,
    email: bookingData.email || undefined,
    phone: bookingData.phone || undefined,
    serviceName: bookingData.serviceName || undefined,
    appointmentEndAt: bookingData.appointmentEndAt || undefined,
    locationId: bookingData.locationId || undefined,
    idempotencyKey: bookingData.idempotencyKey || String(bookingData.externalId),
    connectorId: bookingData.connectorId || undefined,
  };

  logger.info('Creating attributed booking:', { externalId: payload.externalId, bookedValue: payload.bookedValue, currency: payload.currency });

  const res = await request('/v1/bookings', {
    method: 'POST',
    body: payload,
  });

  if (!res.ok) {
    logger.error('Failed to create booking:', res.error);
    return res;
  }

  logger.info('Booking attributed successfully:', res.data);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('elysium:booking_created', {
        detail: res.data,
      })
    );
  }

  return { ok: true, data: res.data };
}

export const recordBooking = createBooking;
