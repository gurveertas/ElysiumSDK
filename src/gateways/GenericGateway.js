import { PaymentGateway } from './PaymentGateway.js';

export class GenericGateway extends PaymentGateway {
  constructor(name = 'generic', config = {}) {
    super(name, config);
  }

  canHandle(buttonOrContext) {
    if (super.canHandle(buttonOrContext)) return true;
    return true; // Generic acts as ultimate fallback
  }
}
