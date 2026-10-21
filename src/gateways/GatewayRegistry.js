import { StripeGateway } from './StripeGateway.js';
import { RazorpayGateway } from './RazorpayGateway.js';
import { PayPalGateway } from './PayPalGateway.js';
import { ShopifyGateway } from './ShopifyGateway.js';
import { WooCommerceGateway } from './WooCommerceGateway.js';
import { SquareGateway } from './SquareGateway.js';
import { ZenotiGateway } from './ZenotiGateway.js';
import { GenericGateway } from './GenericGateway.js';
import { logger } from '../utils/logger.js';

export class GatewayRegistry {
  constructor() {
    this.gateways = new Map();
    this.initDefaultGateways();
  }

  initDefaultGateways() {
    this.register('stripe', new StripeGateway());
    this.register('razorpay', new RazorpayGateway());
    this.register('paypal', new PayPalGateway());
    this.register('shopify', new ShopifyGateway());
    this.register('woocommerce', new WooCommerceGateway());
    this.register('square', new SquareGateway());
    this.register('zenoti', new ZenotiGateway());
    this.generic = new GenericGateway('generic');
    this.register('generic', this.generic);
  }

  register(name, gatewayInstance) {
    if (!name || typeof name !== 'string') {
      throw new Error('Gateway registration requires a string name');
    }
    const key = name.toLowerCase();
    this.gateways.set(key, gatewayInstance);
    logger.debug(`Registered payment gateway: ${key}`);
    return gatewayInstance;
  }

  get(name) {
    if (!name) return null;
    return this.gateways.get(name.toLowerCase()) || null;
  }

  getAll() {
    return Array.from(this.gateways.values());
  }

  /**
   * Find the matching gateway for a button element or context
   */
  resolveForButton(buttonElement) {
    if (!buttonElement) return this.generic;

    // 1. Direct data-gateway attribute check
    const explicitGatewayName = buttonElement.dataset?.gateway;
    if (explicitGatewayName && this.gateways.has(explicitGatewayName.toLowerCase())) {
      return this.gateways.get(explicitGatewayName.toLowerCase());
    }

    // 2. Iterate registered gateways and ask canHandle()
    for (const gateway of this.gateways.values()) {
      if (gateway.canHandle(buttonElement)) {
        return gateway;
      }
    }

    // 3. Fallback to generic gateway
    return this.generic;
  }

  /**
   * Reconfigure all registered gateways with latest config settings
   */
  configureAll(gatewaysConfig = {}) {
    for (const [name, config] of Object.entries(gatewaysConfig)) {
      const gw = this.get(name);
      if (gw) {
        gw.init(config);
      }
    }
  }
}

export const gatewayRegistry = new GatewayRegistry();
