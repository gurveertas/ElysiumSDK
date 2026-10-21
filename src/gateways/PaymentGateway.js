import { getVisitorId } from '../signals/visitor.js';
import { request } from '../signals/transport.js';
import { logger } from '../utils/logger.js';

/**
 * Base PaymentGateway class defining standard lifecycle and interface
 */
export class PaymentGateway {
  constructor(name, config = {}) {
    if (!name) throw new Error('Gateway must have a unique name');
    this.name = name;
    this.config = config;
    this.listeners = new Map();
  }

  /**
   * Lifecycle initialize
   */
  init(gatewayConfig = {}) {
    this.config = { ...this.config, ...gatewayConfig };
    logger.debug(`[Gateway:${this.name}] Initialized with config:`, this.config);
  }

  /**
   * Determine if this gateway matches the clicked button or context
   */
  canHandle(buttonOrContext) {
    if (!buttonOrContext) return false;

    // Check DOM element data attributes
    if (typeof HTMLElement !== 'undefined' && buttonOrContext instanceof HTMLElement) {
      const dataGateway = buttonOrContext.dataset?.gateway;
      if (dataGateway && dataGateway.toLowerCase() === this.name.toLowerCase()) {
        return true;
      }
      // Check class name
      if (buttonOrContext.classList.contains(`elysium-gateway-${this.name}`)) {
        return true;
      }
    }

    // Check context object
    if (typeof buttonOrContext === 'object' && buttonOrContext.gateway) {
      return buttonOrContext.gateway.toLowerCase() === this.name.toLowerCase();
    }

    return false;
  }

  /**
   * Invoked when an elysium payment button associated with this gateway is clicked.
   * NOTE: A button click is only a payment INTENT/ATTEMPT, never proof of payment!
   */
  async handleButtonClick(button, context = {}) {
    logger.info(`[Gateway:${this.name}] Payment button interaction detected:`, {
      gateway: this.name,
      buttonText: button?.innerText?.trim(),
      context,
    });

    return this.recordPaymentAttempt({
      gateway: this.name,
      buttonId: button?.id || null,
      buttonClass: button?.className || null,
      ...context,
    });
  }

  /**
   * Record payment attempt / checkout start
   */
  async recordPaymentAttempt(details = {}) {
    const payload = {
      visitorId: getVisitorId(),
      gateway: this.name,
      status: 'attempted',
      timestamp: new Date().toISOString(),
      metadata: details,
    };

    this.emit('attempt', payload);

    return request('/v1/payment/attempt', {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Record verified payment success with transaction identifiers
   */
  async recordPaymentSuccess(paymentData = {}) {
    const payload = {
      visitorId: getVisitorId(),
      gateway: this.name,
      status: 'succeeded',
      transactionId: paymentData.transactionId || paymentData.id || null,
      orderId: paymentData.orderId || null,
      amount: paymentData.amount || null,
      currency: paymentData.currency || 'USD',
      timestamp: new Date().toISOString(),
      ...paymentData,
      metadata: paymentData,
    };

    logger.info(`[Gateway:${this.name}] Payment succeeded:`, payload);
    this.emit('success', payload);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elysium:payment_success', { detail: payload })
      );
    }

    return request('/v1/payment/success', {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Record payment failure or cancellation
   */
  async recordPaymentFailure(errorData = {}) {
    const payload = {
      visitorId: getVisitorId(),
      gateway: this.name,
      status: 'failed',
      errorCode: errorData.code || null,
      errorMessage: errorData.message || 'Payment failed',
      timestamp: new Date().toISOString(),
      metadata: errorData,
    };

    logger.warn(`[Gateway:${this.name}] Payment failed:`, payload);
    this.emit('failure', payload);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elysium:payment_failure', { detail: payload })
      );
    }

    return request('/v1/payment/failure', {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Event emitter helpers
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          logger.error(`Error in ${this.name} ${event} listener:`, err);
        }
      });
    }
  }
}
