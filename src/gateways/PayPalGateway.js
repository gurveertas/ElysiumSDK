import { PaymentGateway } from './PaymentGateway.js';
import { logger } from '../utils/logger.js';

export class PayPalGateway extends PaymentGateway {
  constructor(config = {}) {
    super('paypal', config);
  }

  canHandle(buttonOrContext) {
    if (super.canHandle(buttonOrContext)) return true;

    if (typeof HTMLElement !== 'undefined' && buttonOrContext instanceof HTMLElement) {
      const text = buttonOrContext.innerText?.toLowerCase() || '';
      const id = buttonOrContext.id?.toLowerCase() || '';
      const cls = buttonOrContext.className?.toLowerCase() || '';
      if (text.includes('paypal') || id.includes('paypal') || cls.includes('paypal')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Wrap options passed to paypal.Buttons(...)
   */
  wrapButtons(options = {}) {
    const originalCreateOrder = options.createOrder;
    const originalOnApprove = options.onApprove;
    const originalOnCancel = options.onCancel;
    const originalOnError = options.onError;

    return {
      ...options,
      createOrder: async (data, actions) => {
        this.recordPaymentAttempt({ stage: 'createOrder', data });
        if (typeof originalCreateOrder === 'function') {
          return originalCreateOrder(data, actions);
        }
      },
      onApprove: async (data, actions) => {
        logger.info('[PayPal] Payment approved by buyer:', data);

        this.recordPaymentSuccess({
          transactionId: data.orderID,
          orderId: data.orderID,
          payerId: data.payerID,
          paymentId: data.paymentID,
          subscriptionId: data.subscriptionID,
          source: 'paypal_buttons',
        });

        if (typeof originalOnApprove === 'function') {
          return originalOnApprove(data, actions);
        }
      },
      onCancel: (data) => {
        logger.debug('[PayPal] Payment cancelled by buyer:', data);

        this.recordPaymentFailure({
          code: 'paypal_cancelled',
          message: 'Buyer cancelled the PayPal flow',
          orderId: data?.orderID,
        });

        if (typeof originalOnCancel === 'function') {
          return originalOnCancel(data);
        }
      },
      onError: (err) => {
        logger.error('[PayPal] Payment error encountered:', err);

        this.recordPaymentFailure({
          code: 'paypal_error',
          message: err?.message || String(err),
        });

        if (typeof originalOnError === 'function') {
          return originalOnError(err);
        }
      },
    };
  }
}
