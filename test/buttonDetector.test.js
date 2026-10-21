import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPaymentButton } from '../src/dom/buttonDetector.js';

describe('Payment Button Detector Module', () => {
  it('detects button matching configured selector via closest()', () => {
    const mockButton = {
      tagName: 'BUTTON',
      className: 'elysium-payment-button custom-style',
      closest: (sel) => {
        if (sel.includes('.elysium-payment-button')) return mockButton;
        return null;
      },
    };

    const mockChildSpan = {
      tagName: 'SPAN',
      innerText: 'Pay Now',
      closest: (sel) => mockButton.closest(sel),
    };

    assert.equal(isPaymentButton(mockButton, '.elysium-payment-button'), mockButton);
    assert.equal(isPaymentButton(mockChildSpan, '.elysium-payment-button'), mockButton);
    assert.equal(isPaymentButton(mockButton, '.non-existent-button'), null);
  });
});
