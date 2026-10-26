import { PaymentGateway } from './PaymentGateway.js';
import { getVisitorId } from '../signals/visitor.js';
import { getCheckoutToken } from '../signals/touchEngine.js';
import { logger } from '../utils/logger.js';

export class ShopifyGateway extends PaymentGateway {
  constructor(config = {}) {
    super('shopify', config);
  }

  canHandle(buttonOrContext) {
    if (super.canHandle(buttonOrContext)) return true;

    if (typeof HTMLElement !== 'undefined' && buttonOrContext instanceof HTMLElement) {
      const form = buttonOrContext.closest('form');
      const action = form?.action?.toLowerCase() || '';
      const text = buttonOrContext.innerText?.toLowerCase() || '';
      if (action.includes('/checkout') || action.includes('/cart') || text.includes('shopify')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Attaches Elysium attribution metadata to Shopify cart before checkout redirect.
   * Matches backend connector which looks for cart attributes named 'attribution_token' or 'checkout_token'.
   */
  async attachCartAttributes(token = null) {
    if (typeof window === 'undefined') return;

    try {
      const checkoutToken = token || (await getCheckoutToken());
      const visitorId = getVisitorId();

      await fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attributes: {
            attribution_token: checkoutToken,
            checkout_token: checkoutToken,
            elysium_visitor_id: visitorId,
          },
        }),
      });
      logger.info('[Shopify] Cart attributes attached successfully:', { attribution_token: checkoutToken, visitorId });
    } catch (err) {
      logger.warn('[Shopify] Could not update cart attributes:', err);
    }
  }

  async handleButtonClick(button, context = {}) {
    await this.attachCartAttributes(context.checkoutToken);
    return super.handleButtonClick(button, context);
  }
}
