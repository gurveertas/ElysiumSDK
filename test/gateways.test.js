import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GatewayRegistry,
  PaymentGateway,
  StripeGateway,
  RazorpayGateway,
  PayPalGateway,
  ShopifyGateway,
  WooCommerceGateway,
  ZenotiGateway,
  GenericGateway,
} from '../src/gateways/index.js';

describe('Payment Gateways Architecture', () => {
  it('manages default and custom gateways in GatewayRegistry', () => {
    const registry = new GatewayRegistry();

    assert.ok(registry.get('stripe') instanceof StripeGateway);
    assert.ok(registry.get('razorpay') instanceof RazorpayGateway);
    assert.ok(registry.get('paypal') instanceof PayPalGateway);
    assert.ok(registry.get('shopify') instanceof ShopifyGateway);
    assert.ok(registry.get('woocommerce') instanceof WooCommerceGateway);
    assert.ok(registry.get('zenoti') instanceof ZenotiGateway);
    assert.ok(registry.get('generic') instanceof GenericGateway);

    // Register custom crypto gateway
    class CryptoGateway extends PaymentGateway {
      constructor() {
        super('crypto');
      }
    }
    registry.register('crypto', new CryptoGateway());
    assert.ok(registry.get('crypto') instanceof CryptoGateway);
  });

  it('PaymentGateway emits lifecycle events on attempt, success, and failure', async () => {
    const gateway = new GenericGateway('testgw');
    const events = [];

    gateway.on('attempt', (e) => events.push({ type: 'attempt', ...e }));
    gateway.on('success', (e) => events.push({ type: 'success', ...e }));
    gateway.on('failure', (e) => events.push({ type: 'failure', ...e }));

    await gateway.recordPaymentAttempt({ stage: 'init' });
    await gateway.recordPaymentSuccess({ transactionId: 'tx_999', amount: 150 });
    await gateway.recordPaymentFailure({ code: 'card_declined', message: 'Insufficient funds' });

    assert.equal(events.length, 3);
    assert.equal(events[0].type, 'attempt');
    assert.equal(events[1].type, 'success');
    assert.equal(events[1].transactionId, 'tx_999');
    assert.equal(events[2].type, 'failure');
    assert.equal(events[2].errorCode, 'card_declined');
  });

  it('StripeGateway attachToken sets metadata.attribution_token', () => {
    const stripeGateway = new StripeGateway();
    const target = {
      amount: 2000,
      currency: 'usd',
    };
    stripeGateway.attachToken(target, 'cs_stripe_token_123');

    assert.equal(target.metadata.attribution_token, 'cs_stripe_token_123');
    assert.equal(target.client_reference_id, 'cs_stripe_token_123');
  });

  it('RazorpayGateway wraps options and attaches notes.attribution_token', async () => {
    const rzpGateway = new RazorpayGateway();
    let originalHandlerCalled = false;
    let recordedSuccess = null;

    rzpGateway.on('success', (data) => {
      recordedSuccess = data;
    });

    const originalOptions = {
      key: 'rzp_test_123',
      amount: 50000,
      currency: 'INR',
      handler: (res) => {
        originalHandlerCalled = true;
      },
    };

    const token = 'cs_rzp_token_456';
    const wrapped = rzpGateway.wrapOptions(originalOptions, token);
    assert.equal(wrapped.notes.attribution_token, token);
    assert.notEqual(wrapped.handler, originalOptions.handler);

    // Simulate Razorpay calling the handler upon customer completing payment
    wrapped.handler({
      razorpay_payment_id: 'pay_ABC123',
      razorpay_order_id: 'order_XYZ456',
      razorpay_signature: 'sig_789',
    });

    assert.equal(originalHandlerCalled, true);
    assert.ok(recordedSuccess);
    assert.equal(recordedSuccess.transactionId, 'pay_ABC123');
    assert.equal(recordedSuccess.orderId, 'order_XYZ456');
    assert.equal(recordedSuccess.amount, 500); // 50000 paise -> 500 INR
    assert.equal(recordedSuccess.checkoutToken, token);
  });

  it('PayPalGateway attachToken sets custom_id', () => {
    const ppGateway = new PayPalGateway();
    const purchaseUnit = {
      amount: { value: '100.00', currency_code: 'USD' },
    };
    ppGateway.attachToken(purchaseUnit, 'cs_pp_token_789');
    assert.equal(purchaseUnit.custom_id, 'cs_pp_token_789');
  });

  it('ZenotiGateway formatNote formats notes with attribution_token', () => {
    const zenotiGateway = new ZenotiGateway();
    const note = zenotiGateway.formatNote('cs_zenoti_token_000', 'Haircut appointment');
    assert.equal(note, 'Haircut appointment attribution_token:cs_zenoti_token_000');
  });
});
