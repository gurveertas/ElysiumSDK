import { PaymentGateway } from './PaymentGateway.js';

export class SquareGateway extends PaymentGateway {
  constructor(config = {}) {
    super('square', config);
  }

  canHandle(buttonOrContext) {
    if (super.canHandle(buttonOrContext)) return true;

    if (typeof HTMLElement !== 'undefined' && buttonOrContext instanceof HTMLElement) {
      const text = buttonOrContext.innerText?.toLowerCase() || '';
      const id = buttonOrContext.id?.toLowerCase() || '';
      if (text.includes('square') || id.includes('square') || id.includes('sq-card')) {
        return true;
      }
    }
    return false;
  }
}
