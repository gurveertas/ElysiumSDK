import { PaymentGateway } from './PaymentGateway.js';

export class ZenotiGateway extends PaymentGateway {
  constructor(config = {}) {
    super('zenoti', config);
  }

  canHandle(buttonOrContext) {
    if (super.canHandle(buttonOrContext)) return true;

    if (typeof HTMLElement !== 'undefined' && buttonOrContext instanceof HTMLElement) {
      const text = buttonOrContext.innerText?.toLowerCase() || '';
      const id = buttonOrContext.id?.toLowerCase() || '';
      if (text.includes('zenoti') || id.includes('zenoti')) {
        return true;
      }
    }
    return false;
  }
}
