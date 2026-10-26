import { PaymentGateway } from './PaymentGateway.js';
import { getCheckoutToken } from '../signals/touchEngine.js';
import { logger } from '../utils/logger.js';

export class RazorpayGateway extends PaymentGateway {
  constructor(config = {}) {
    super('razorpay', config);
  }

  canHandle(buttonOrContext) {
    if (super.canHandle(buttonOrContext)) return true;

    if (typeof HTMLElement !== 'undefined' && buttonOrContext instanceof HTMLElement) {
      const text = buttonOrContext.innerText?.toLowerCase() || '';
      const id = buttonOrContext.id?.toLowerCase() || '';
      const cls = buttonOrContext.className?.toLowerCase() || '';
      if (text.includes('razorpay') || id.includes('razorpay') || cls.includes('razorpay')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper to attach attribution token into Razorpay checkout options notes.
   * Matches backend connector which looks for payment.notes.attribution_token.
   */
  attachToken(options = {}, token = null) {
    if (!options || typeof options !== 'object') return options;
    const attributionToken = token || options.checkoutToken;
    if (attributionToken) {
      options.notes = {
        ...(options.notes || {}),
        attribution_token: attributionToken,
        checkout_token: attributionToken,
      };
    }
    return options;
  }

  /**
   * Wrap Razorpay checkout options to automatically attach attribution token
   * and intercept payment success and modal dismissal.
   */
  wrapOptions(options = {}, token = null) {
    const originalHandler = options.handler;

    const wrappedOptions = {
      ...options,
      notes: {
        ...(options.notes || {}),
        ...(token ? { attribution_token: token, checkout_token: token } : {}),
      },
      handler: (response) => {
        logger.info('[Razorpay] Payment successful response received:', response);

        this.recordPaymentSuccess({
          transactionId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
          amount: options.amount ? options.amount / 100 : undefined,
          currency: options.currency || 'INR',
          checkoutToken: token || options.notes?.attribution_token,
        });

        if (typeof originalHandler === 'function') {
          return originalHandler(response);
        }
      },
    };

    // Modal dismiss handler
    const originalModal = options.modal || {};
    const originalOnDismiss = originalModal.ondismiss;
    wrappedOptions.modal = {
      ...originalModal,
      ondismiss: () => {
        logger.debug('[Razorpay] Checkout modal dismissed by user');
        this.recordPaymentFailure({
          code: 'modal_dismissed',
          message: 'User closed the Razorpay checkout modal before completing payment',
        });
        if (typeof originalOnDismiss === 'function') {
          return originalOnDismiss();
        }
      },
    };

    return wrappedOptions;
  }

  /**
   * Instrument a Razorpay instance to listen for payment.failed events
   */
  wrapInstance(rzpInstance) {
    if (!rzpInstance || typeof rzpInstance.on !== 'function') return rzpInstance;

    rzpInstance.on('payment.failed', (response) => {
      logger.warn('[Razorpay] Payment failed event caught:', response);
      this.recordPaymentFailure({
        code: response.error?.code || 'payment_failed',
        message: response.error?.description || 'Razorpay payment failed',
        reason: response.error?.reason,
        step: response.error?.step,
        orderId: response.error?.metadata?.order_id,
        transactionId: response.error?.metadata?.payment_id,
      });
    });

    return rzpInstance;
  }
}
