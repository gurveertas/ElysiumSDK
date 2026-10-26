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

  /**
   * Helper to format Zenoti booking appointment notes with attribution token.
   * Matches backend connector which parses `attribution_token:<token>`.
   */
  formatNote(token, existingNotes = '') {
    if (!token) return existingNotes;
    const tag = `attribution_token:${token}`;
    if (!existingNotes) return tag;
    if (existingNotes.includes('attribution_token:')) return existingNotes;
    return `${existingNotes.trim()} ${tag}`;
  }
}
