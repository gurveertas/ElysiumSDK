import { PaymentGateway } from './PaymentGateway.js';
import { getVisitorId } from '../signals/visitor.js';
import { getCheckoutToken } from '../signals/touchEngine.js';

export class WooCommerceGateway extends PaymentGateway {
  constructor(config = {}) {
    super('woocommerce', config);
    this.injectHiddenCheckoutFields();
  }

  canHandle(buttonOrContext) {
    if (super.canHandle(buttonOrContext)) return true;

    if (typeof HTMLElement !== 'undefined' && buttonOrContext instanceof HTMLElement) {
      const text = buttonOrContext.innerText?.toLowerCase() || '';
      const id = buttonOrContext.id?.toLowerCase() || '';
      if (text.includes('place order') || id === 'place_order' || id.includes('woocommerce')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Inject hidden inputs into WooCommerce checkout form for attribution token and visitor propagation
   */
  async injectHiddenCheckoutFields() {
    if (typeof document === 'undefined') return;

    const form = document.querySelector('form.checkout, form.woocommerce-checkout');
    if (!form) return;

    this.injectHiddenInput(form, 'billing_elysium_visitor_id', getVisitorId());

    try {
      const token = await getCheckoutToken();
      if (token) {
        this.injectHiddenInput(form, 'attribution_token', token);
        this.injectHiddenInput(form, 'checkout_token', token);
      }
    } catch {
      // Defer token generation if needed
    }
  }

  async handleButtonClick(button, context = {}) {
    await this.injectHiddenCheckoutFields();
    return super.handleButtonClick(button, context);
  }
}
