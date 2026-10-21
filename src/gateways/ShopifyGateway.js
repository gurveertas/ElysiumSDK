import { PaymentGateway } from './PaymentGateway.js';
import { getVisitorId } from '../signals/visitor.js';
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
   * Attaches Elysium attribution metadata to Shopify cart before checkout redirect
   */
  async attachCartAttributes(checkoutSessionId) {
    if (typeof window === 'undefined') return;

    try {
      const visitorId = getVisitorId();
      await fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attributes: {
            elysium_session_id: checkoutSessionId,
            elysium_visitor_id: visitorId,
          },
        }),
      });
      logger.info('[Shopify] Cart attributes attached successfully:', { checkoutSessionId, visitorId });
    } catch (err) {
      logger.warn('[Shopify] Could not update cart attributes:', err);
    }
  }

  async handleButtonClick(button, context = {}) {
    if (context.checkoutSessionId) {
      await this.attachCartAttributes(context.checkoutSessionId);
    }
    return super.handleButtonClick(button, context);
  }
}
