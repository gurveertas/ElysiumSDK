import { PaymentGateway } from './PaymentGateway.js';
import { getCheckoutToken } from '../signals/touchEngine.js';
import { logger } from '../utils/logger.js';

export class StripeGateway extends PaymentGateway {
  constructor(config = {}) {
    super('stripe', config);
    this.checkRedirectReturn();
  }

  canHandle(buttonOrContext) {
    if (super.canHandle(buttonOrContext)) return true;

    if (typeof HTMLElement !== 'undefined' && buttonOrContext instanceof HTMLElement) {
      const text = buttonOrContext.innerText?.toLowerCase() || '';
      const id = buttonOrContext.id?.toLowerCase() || '';
      const cls = buttonOrContext.className?.toLowerCase() || '';
      if (text.includes('stripe') || id.includes('stripe') || cls.includes('stripe')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper to attach attribution token into Stripe PaymentIntent or Checkout parameters.
   * Matches backend connector which looks for metadata.attribution_token or metadata.checkout_token.
   */
  attachToken(target = {}, token = null) {
    if (!target || typeof target !== 'object') return target;
    const attributionToken = token || target.checkoutToken;
    if (attributionToken) {
      target.metadata = {
        ...(target.metadata || {}),
        attribution_token: attributionToken,
        checkout_token: attributionToken,
      };
      // If Checkout Session options:
      if (target.payment_intent_data) {
        target.payment_intent_data.metadata = {
          ...(target.payment_intent_data.metadata || {}),
          attribution_token: attributionToken,
        };
      }
      if (!target.client_reference_id) {
        target.client_reference_id = attributionToken;
      }
    }
    return target;
  }

  /**
   * Automatically detect and attribute Stripe 3DS/redirect returns
   */
  checkRedirectReturn() {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      const paymentIntentId = params.get('payment_intent');
      const redirectStatus = params.get('redirect_status');

      if (paymentIntentId && redirectStatus) {
        logger.info(`Detected Stripe return redirect: status=${redirectStatus}, id=${paymentIntentId}`);

        if (redirectStatus === 'succeeded') {
          this.recordPaymentSuccess({
            transactionId: paymentIntentId,
            status: redirectStatus,
            source: 'stripe_redirect',
          });
        } else if (redirectStatus === 'failed') {
          this.recordPaymentFailure({
            code: 'stripe_redirect_failed',
            message: `Stripe redirect finished with status: ${redirectStatus}`,
            transactionId: paymentIntentId,
          });
        }
      }
    } catch (err) {
      logger.debug('Error checking Stripe redirect return:', err);
    }
  }

  /**
   * Instrument a Stripe instance to automatically attach checkout tokens and intercept confirmPayment
   */
  wrapStripe(stripeInstance) {
    if (!stripeInstance) return stripeInstance;

    const originalConfirmPayment = stripeInstance.confirmPayment?.bind(stripeInstance);
    if (originalConfirmPayment) {
      stripeInstance.confirmPayment = async (options = {}) => {
        let token = null;
        try {
          token = await getCheckoutToken();
        } catch {
          // Continue if token generation fails
        }

        if (token && options.confirmParams) {
          options.confirmParams.payment_method_data = options.confirmParams.payment_method_data || {};
          options.confirmParams.payment_method_data.metadata = {
            ...(options.confirmParams.payment_method_data.metadata || {}),
            attribution_token: token,
          };
        }

        this.recordPaymentAttempt({ method: 'confirmPayment', options, token });

        try {
          const result = await originalConfirmPayment(options);
          if (result.error) {
            this.recordPaymentFailure(result.error);
          } else if (result.paymentIntent?.status === 'succeeded') {
            this.recordPaymentSuccess({
              transactionId: result.paymentIntent.id,
              amount: result.paymentIntent.amount ? result.paymentIntent.amount / 100 : undefined,
              currency: result.paymentIntent.currency,
              paymentIntent: result.paymentIntent,
              checkoutToken: token,
            });
          }
          return result;
        } catch (err) {
          this.recordPaymentFailure(err);
          throw err;
        }
      };
    }

    return stripeInstance;
  }
}
