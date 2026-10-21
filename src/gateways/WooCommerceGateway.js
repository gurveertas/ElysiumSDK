import { PaymentGateway } from './PaymentGateway.js';
import { getVisitorId } from '../signals/visitor.js';

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
   * Inject hidden inputs into WooCommerce checkout form for metadata propagation
   */
  injectHiddenCheckoutFields() {
    if (typeof document === 'undefined') return;

    const form = document.querySelector('form.checkout, form.woocommerce-checkout');
    if (!form) return;

    let input = form.querySelector('input[name="billing_elysium_visitor_id"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'billing_elysium_visitor_id';
      input.value = getVisitorId();
      form.appendChild(input);
    }
  }
}
