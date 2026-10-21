import { PaymentGateway } from './PaymentGateway.js';
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
   * Wrap Razorpay checkout options to automatically intercept payment success/dismissal
   */
  wrapOptions(options = {}) {
    const originalHandler = options.handler;

    const wrappedOptions = {
      ...options,
      handler: (response) => {
        logger.info('[Razorpay] Payment successful response received:', response);

        this.recordPaymentSuccess({
          transactionId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
          amount: options.amount ? options.amount / 100 : undefined,
          currency: options.currency || 'INR',
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
