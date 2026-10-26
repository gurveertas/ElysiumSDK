import { getVisitorId } from '../signals/visitor.js';
import { getCheckoutToken, createOrder } from '../signals/touchEngine.js';
import { logger } from '../utils/logger.js';

/**
 * Base PaymentGateway class defining standard lifecycle and integration interfaces.
 * Emits lifecycle events for attempts, successes, and failures,
 * and automatically provisions checkout tokens for attribution.
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
   * Attach attribution checkout token to target data/form
   */
  attachToken(target, token) {
    if (!target) return target;
    if (typeof target === 'object') {
      target.attribution_token = token;
      target.checkout_token = token;
    }
    return target;
  }

  /**
   * Invoked when a payment or checkout button associated with this gateway is clicked.
   * Obtains a checkout token, ensures hidden form inputs, and records an attempt.
   */
  async handleButtonClick(button, context = {}) {
    logger.info(`[Gateway:${this.name}] Payment button interaction detected:`, {
      gateway: this.name,
      buttonText: button?.innerText?.trim(),
      context,
    });

    let checkoutToken = null;
    try {
      checkoutToken = await getCheckoutToken();
    } catch (err) {
      logger.debug(`[Gateway:${this.name}] Checkout token generation deferred:`, err);
    }

    // If button is inside a form, inject hidden input for attribution token
    if (checkoutToken && button && typeof button.closest === 'function') {
      const form = button.closest('form');
      if (form) {
        this.injectHiddenInput(form, 'attribution_token', checkoutToken);
        this.injectHiddenInput(form, 'checkout_token', checkoutToken);
        this.injectHiddenInput(form, 'elysium_visitor_id', getVisitorId());
      }
    }

    return this.recordPaymentAttempt({
      gateway: this.name,
      buttonId: button?.id || null,
      buttonClass: button?.className || null,
      checkoutToken,
      ...context,
    });
  }

  /**
   * Injects or updates a hidden input field in a form
   */
  injectHiddenInput(form, name, value) {
    if (!form || !name) return;
    try {
      let input = form.querySelector(`input[name="${name}"]`);
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.appendChild(input);
      }
      input.value = value;
    } catch {
      // In SSR or sandboxed environment
    }
  }

  /**
   * Record payment attempt / checkout start (local event & notification)
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elysium:payment_attempt', { detail: payload })
      );
    }

    return { ok: true, data: payload };
  }

  /**
   * Record verified payment success.
   * Emits lifecycle events and can optionally ingest order directly to backend.
   */
  async recordPaymentSuccess(paymentData = {}) {
    const transactionId = paymentData.transactionId || paymentData.id || paymentData.orderId || null;
    const amount = paymentData.amount ?? paymentData.grossAmount ?? null;
    const currency = (paymentData.currency || 'USD').toUpperCase();

    const payload = {
      visitorId: getVisitorId(),
      gateway: this.name,
      status: 'succeeded',
      transactionId,
      orderId: paymentData.orderId || transactionId,
      amount,
      currency,
      timestamp: new Date().toISOString(),
      ...paymentData,
    };

    logger.info(`[Gateway:${this.name}] Payment succeeded:`, payload);
    this.emit('success', payload);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('elysium:payment_success', { detail: payload })
      );
    }

    // If externalId/transactionId and amount are provided, client can optionally ingest order
    if (paymentData.autoCreateOrder && transactionId && amount !== null) {
      try {
        await createOrder({
          externalId: transactionId,
          orderedAt: payload.timestamp,
          currency,
          grossAmount: Number(amount),
          netAmount: Number(paymentData.netAmount ?? amount),
          checkoutToken: paymentData.checkoutToken,
          email: paymentData.email,
          phone: paymentData.phone,
        });
      } catch (err) {
        logger.debug(`[Gateway:${this.name}] Auto createOrder failed:`, err);
      }
    }

    return { ok: true, data: payload };
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

    return { ok: true, data: payload };
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
