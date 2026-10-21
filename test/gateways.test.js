import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GatewayRegistry,
  PaymentGateway,
  StripeGateway,
  RazorpayGateway,
  PayPalGateway,
  GenericGateway,
} from '../src/gateways/index.js';

describe('Payment Gateways Architecture', () => {
  it('manages default and custom gateways in GatewayRegistry', () => {
    const registry = new GatewayRegistry();

    assert.ok(registry.get('stripe') instanceof StripeGateway);
    assert.ok(registry.get('razorpay') instanceof RazorpayGateway);
    assert.ok(registry.get('paypal') instanceof PayPalGateway);
    assert.ok(registry.get('shopify'));
    assert.ok(registry.get('woocommerce'));
    assert.ok(registry.get('square'));
    assert.ok(registry.get('zenoti'));
    assert.ok(registry.get('generic'));

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

  it('RazorpayGateway wraps options and intercepts success handler', async () => {
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

    const wrapped = rzpGateway.wrapOptions(originalOptions);
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
  });

  it('PayPalGateway wraps buttons and intercepts onApprove', async () => {
    const ppGateway = new PayPalGateway();
    let originalApproveCalled = false;
    let recordedSuccess = null;

    ppGateway.on('success', (data) => {
      recordedSuccess = data;
    });

    const originalButtonOpts = {
      createOrder: () => 'order_pp_1',
      onApprove: (data) => {
        originalApproveCalled = true;
      },
    };

    const wrapped = ppGateway.wrapButtons(originalButtonOpts);
    await wrapped.onApprove({
      orderID: 'PP_ORDER_999',
      payerID: 'PAYER_555',
    });

    assert.equal(originalApproveCalled, true);
    assert.ok(recordedSuccess);
    assert.equal(recordedSuccess.orderId, 'PP_ORDER_999');
    assert.equal(recordedSuccess.payerId, 'PAYER_555');
  });
});
