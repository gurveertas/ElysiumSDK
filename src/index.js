import { configManager, getConfig, setConfig } from './config/index.js';
import { getVisitorId, setVisitorId } from './signals/visitor.js';
import {
  recordTouch,
  recordProductTouch,
  identifyVisitor,
  createCheckoutSession,
  buildPayload,
} from './signals/touchEngine.js';
import { readTouchHistory, getTouchSignature } from './signals/session.js';
import { extractMarketingParams } from './signals/params.js';
import { parseReferrer } from './signals/referrer.js';
import {
  gatewayRegistry,
  PaymentGateway,
  StripeGateway,
  RazorpayGateway,
  PayPalGateway,
  ShopifyGateway,
  WooCommerceGateway,
  SquareGateway,
  ZenotiGateway,
  GenericGateway,
} from './gateways/index.js';
import { initPaymentButtonDetection } from './dom/buttonDetector.js';
import { logger } from './utils/logger.js';

let buttonDetectorCleanup = null;

/**
 * Main SDK initialization method.
 * Configures API keys, starts tracking, registers gateways, and activates button detector.
 */
export function init(userConfig = {}) {
  const config = configManager.init(userConfig);

  // Configure gateways with user settings
  if (config.gateways) {
    gatewayRegistry.configureAll(config.gateways);
  }

  // Initialize payment button listener
  if (buttonDetectorCleanup) {
    buttonDetectorCleanup();
  }
  buttonDetectorCleanup = initPaymentButtonDetection(config.buttonSelector);

  // Auto-record touchpoint if autoTrack enabled (default true)
  if (config.autoTrack && typeof window !== 'undefined') {
    // Run after current event loop turn to allow page title & DOM to settle
    setTimeout(() => {
      recordTouch().catch((err) => {
        logger.error('Auto touch tracking encountered an error:', err);
      });
    }, 0);
  }

  logger.info('ElysiumSDK initialized successfully');
  return Elysium;
}

/**
 * Update active configuration at runtime
 */
export function configure(updates = {}) {
  const config = setConfig(updates);
  if (updates.gateways) {
    gatewayRegistry.configureAll(updates.gateways);
  }
  if (updates.buttonSelector && buttonDetectorCleanup) {
    buttonDetectorCleanup();
    buttonDetectorCleanup = initPaymentButtonDetection(config.buttonSelector);
  }
  return config;
}

/**
 * Explicit helper to record payment success
 */
export async function recordPaymentSuccess(details = {}) {
  const gatewayName = details.gateway || 'generic';
  const gateway = gatewayRegistry.get(gatewayName) || gatewayRegistry.generic;
  return gateway.recordPaymentSuccess(details);
}

/**
 * Explicit helper to record payment failure
 */
export async function recordPaymentFailure(details = {}) {
  const gatewayName = details.gateway || 'generic';
  const gateway = gatewayRegistry.get(gatewayName) || gatewayRegistry.generic;
  return gateway.recordPaymentFailure(details);
}

/**
 * Explicit helper to record payment attempt
 */
export async function recordPaymentAttempt(details = {}) {
  const gatewayName = details.gateway || 'generic';
  const gateway = gatewayRegistry.get(gatewayName) || gatewayRegistry.generic;
  return gateway.recordPaymentAttempt(details);
}

/**
 * Register a custom payment gateway
 */
export function registerGateway(name, gatewayInstance) {
  return gatewayRegistry.register(name, gatewayInstance);
}

/**
 * Retrieve a registered payment gateway by name
 */
export function getGateway(name) {
  return gatewayRegistry.get(name);
}

// Unified SDK namespace object
export const Elysium = {
  init,
  configure,
  getConfig,
  getVisitorId,
  setVisitorId,
  recordTouch,
  recordProductTouch,
  identifyVisitor,
  createCheckoutSession,
  buildPayload,
  readTouchHistory,
  getTouchSignature,
  extractMarketingParams,
  parseReferrer,
  initPaymentButtonDetection,
  registerGateway,
  getGateway,
  recordPaymentAttempt,
  recordPaymentSuccess,
  recordPaymentFailure,
  gateways: {
    PaymentGateway,
    StripeGateway,
    RazorpayGateway,
    PayPalGateway,
    ShopifyGateway,
    WooCommerceGateway,
    SquareGateway,
    ZenotiGateway,
    GenericGateway,
    registry: gatewayRegistry,
  },
};

// Expose on global window object if running in browser
if (typeof window !== 'undefined') {
  window.Elysium = Elysium;
}

export default Elysium;
