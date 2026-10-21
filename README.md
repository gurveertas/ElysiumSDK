# ElysiumSDK

Production-grade JavaScript/TypeScript SDK for global multi-touch marketing attribution, visitor session tracking, and payment gateway integration across any web application or e-commerce storefront.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Existing Touch Tracking Analysis & Fixes](#existing-touch-tracking-analysis--fixes)
3. [Installation](#installation)
4. [Configuration (`elysium.config.js`)](#configuration)
5. [Quick Start](#quick-start)
6. [Payment Gateway Integrations](#payment-gateway-integrations)
   - [Stripe](#stripe)
   - [Razorpay](#razorpay)
   - [PayPal](#paypal)
   - [Custom Gateways](#custom-gateways)
7. [Payment Button Detection](#payment-button-detection)
8. [Backend Integration & Limitations](#backend-integration--limitations)
9. [API Reference](#api-reference)

---

## 1. Architecture Overview

ElysiumSDK is structured with strict separation of concerns, framework independence, and zero external runtime dependencies:

```
elysiumSDK/
├── src/
│   ├── index.js               # Unified SDK interface (window.Elysium & ES module exports)
│   ├── config/
│   │   ├── index.js           # Configuration manager & dynamic updates
│   │   └── schema.js          # Defaults & client-side secret-key detection / audit
│   ├── tracking/
│   │   ├── visitor.js         # Visitor UUID generator with localStorage + Cookie 2-way sync
│   │   ├── params.js          # Multi-platform click IDs (gclid, fbclid, wbraid, ttclid, etc.)
│   │   ├── referrer.js        # Internal referrer filtering & organic search/social detection
│   │   ├── session.js         # 30-min session windowing, touch deduplication, FIFO bounding
│   │   ├── transport.js       # Resilient HTTP fetch (keepalive, timeouts, dual headers)
│   │   └── touchTracker.js    # Core orchestrator: recordTouch, identifyVisitor, createCheckoutSession
│   ├── gateways/
│   │   ├── PaymentGateway.js  # Abstract base class with lifecycle hooks and event emitter
│   │   ├── GatewayRegistry.js # Registry for resolving & registering gateways
│   │   ├── StripeGateway.js   # Stripe Elements, 3DS redirect return checks, PaymentIntent tracking
│   │   ├── RazorpayGateway.js # Razorpay options wrapping, handler interception, failure events
│   │   ├── PayPalGateway.js   # PayPal JS SDK Buttons interception (createOrder, onApprove, onError)
│   │   └── GenericGateway.js  # Fallback & custom provider support
│   ├── dom/
│   │   └── buttonDetector.js  # Delegated click listener & MutationObserver for .elysium-payment-button
│   └── utils/
│       ├── storage.js         # Resilient storage (in-memory fallback, ITP-aware cookie handling)
│       ├── logger.js          # Safe prefixed logging with debug toggle
│       └── cli.js             # CLI tool to initialize elysium.config.js
├── test/                      # Comprehensive unit tests (node:test)
├── index.d.ts                 # Complete TypeScript definitions
└── package.json
```

---

## 2. Existing Touch Tracking Analysis & Fixes

During the audit of `touch-tracking.ts` and `attributionInit.js`, the following critical flaws, security concerns, and edge cases were identified and resolved:

| Area | Issue in Original Code | Fixed in ElysiumSDK |
| :--- | :--- | :--- |
| **Bundler / Environment Lock-in** | Relied on `import.meta.env.VITE_ATTRIBUTION_*`, which crashed or failed in non-Vite environments, script tags, Webpack, Next.js, and vanilla HTML. | Framework-agnostic configuration via `elysium.config.js`, runtime options to `init()`, and safe global fallback. |
| **Storage Quota & Memory Leak** | `saveSuccessfulTouch` appended entries indefinitely to `localStorage['aid_touches']` without limits, eventually throwing `QuotaExceededError` on frequent visitors. | Capped history to a maximum of 50 records with automatic FIFO pruning. Added in-memory fallback for Private Browsing mode. |
| **Organic & Referral Traffic Loss** | `shouldSendTouch` checked only marketing parameters (`utm_` and `gclid/fbclid`). Visitors arriving via organic Google search, DuckDuckGo, Reddit, or Instagram were completely dropped from attribution. | Added `referrer.js` that detects organic search engines and social platforms, populating source/medium when UTMs are absent. |
| **Internal Navigation Misattribution** | `document.referrer` recorded internal site page-to-page navigation as external referrals, polluting attribution data. | Added domain-level internal referrer filtering that strips same-domain referrers. |
| **Modern Ad Click IDs Missing** | Only captured `gclid`, `fbclid`, `ttclid`, `msclkid`. Missed iOS privacy click IDs (`wbraid`, `gbraid`), Google Display (`dclid`), Twitter/X (`twclid`), LinkedIn (`li_fat_id`), and Reddit (`rdt_cid`). | Added comprehensive ad platform click ID capture and cookie sync (`_fbc`, `_fbp`, `_ttp`, `_ga`). |
| **Safari ITP / Cross-Domain Identity Loss** | Relied primarily on localStorage; cookies were only set as a fallback if localStorage failed, breaking cross-subdomain tracking (`shop.store.com` -> `checkout.store.com`). | Dual-writes to both `localStorage` and `SameSite=Lax` cookies with configurable `cookieDomain` to preserve visitor identity across subdomains and Safari ITP resets. |
| **Payment Button Assumption Flaw** | None existed in original code; clicks cannot be assumed as payment success. | Implemented separate `PaymentGateway` architecture treating clicks as payment *attempts*, and only recording *success* after provider verification or redirect resolution. |

---

## 3. Installation

Install via npm:

```bash
npm install elysium-sdk
```

Or via CDN script tag:

```html
<script src="https://cdn.jsdelivr.net/npm/elysium-sdk/dist/elysium.min.js"></script>
```

Initialize your configuration file:

```bash
npx elysium
```

---

## 4. Configuration (`elysium.config.js`)

Create or update `elysium.config.js` in your project root:

```javascript
/**
 * ElysiumSDK Configuration File
 *
 * IMPORTANT SECURITY NOTICE:
 * This file is bundled for the browser. NEVER include backend secret keys
 * (e.g. Stripe secret key "sk_live_...", Razorpay key secret).
 */
export default {
  // Public attribution API Key provided by Elysium
  apiKey: "pk_test_b-ej3xXtpwZUdV6BJdu0NTlILFnMsfszkeiJPfQ9CL0",

  // Attribution API Backend endpoint
  apiBaseUrl: "https://asbTemp-production.up.railway.app",

  // Enable verbose debugging logs in browser console
  debug: true,

  // Session inactivity timeout in milliseconds (default: 30 minutes)
  sessionWindowMs: 30 * 60 * 1000,

  // CSS selector or class for detecting checkout/payment buttons
  buttonSelector: ".elysium-payment-button",

  // Automatically record touch on page load
  autoTrack: true,

  // Optional: restrict touch tracking to specific path regex (e.g. product pages only)
  // productPathRegex: /^\/product\/[^/]+\/?$/,

  // Domain for cross-subdomain cookie tracking (e.g., ".yourstore.com")
  cookieDomain: undefined,

  // Additional custom query parameters to capture and attribute
  customParams: ["affiliate_id", "promo_code"],

  // Supported payment gateways configuration (PUBLIC keys only)
  gateways: {
    stripe: {
      enabled: true,
      publishableKey: "pk_test_...",
    },
    razorpay: {
      enabled: true,
      keyId: "rzp_test_...",
    },
    paypal: {
      enabled: true,
      clientId: "YOUR_PAYPAL_CLIENT_ID",
    },
  },
};
```

---

## 5. Quick Start

### In React / Next.js / Vue / Vanilla JS:

```javascript
import Elysium from 'elysium-sdk';
import elysiumConfig from './elysium.config.js';

// Initialize on application startup
Elysium.init(elysiumConfig);

// Get current visitor ID
const visitorId = Elysium.getVisitorId();

// When customer logs in or submits their email in checkout:
await Elysium.identifyVisitor('customer@example.com', {
  name: 'Jane Doe',
  loyaltyTier: 'VIP'
});
```

---

## 6. Payment Gateway Integrations

### Stripe

The Stripe gateway supports:
1. **Stripe Elements (`stripe.confirmPayment`)**: Automatic promise interception
2. **Redirect Returns**: Automatically detects `?payment_intent=pi_...&redirect_status=succeeded` when customers return from 3D Secure or Stripe Checkout.

```javascript
import Elysium from 'elysium-sdk';

const stripeGateway = Elysium.getGateway('stripe');

// Instrument Stripe instance
const stripe = stripeGateway.wrapStripe(window.Stripe('pk_test_...'));

// Call confirmPayment normally - Elysium automatically records attempt and verified success!
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: 'https://mystore.com/order-confirmation',
  },
});
```

### Razorpay

Wrap your Razorpay checkout options. Elysium automatically hooks into the `handler` callback and listens for `payment.failed` events:

```javascript
import Elysium from 'elysium-sdk';

const rzpGateway = Elysium.getGateway('razorpay');

const options = rzpGateway.wrapOptions({
  key: 'rzp_test_...',
  amount: 50000,
  currency: 'INR',
  name: 'Acme Store',
  order_id: 'order_123',
  handler: function (response) {
    // response.razorpay_payment_id
    // response.razorpay_order_id
    // response.razorpay_signature
    console.log('Payment completed!');
  },
});

const rzp = new window.Razorpay(options);
rzpGateway.wrapInstance(rzp); // Attaches failure telemetry
rzp.open();
```

### PayPal

Wrap your PayPal JavaScript SDK Button options:

```javascript
import Elysium from 'elysium-sdk';

const paypalGateway = Elysium.getGateway('paypal');

window.paypal.Buttons(paypalGateway.wrapButtons({
  createOrder: (data, actions) => {
    return actions.order.create({
      purchase_units: [{ amount: { value: '149.00' } }]
    });
  },
  onApprove: async (data, actions) => {
    const details = await actions.order.capture();
    console.log('PayPal transaction completed:', details);
  }
})).render('#paypal-button-container');
```

### Custom Gateways

You can implement custom payment gateways by extending `PaymentGateway`:

```javascript
import { PaymentGateway, registerGateway } from 'elysium-sdk';

class CryptoPaymentGateway extends PaymentGateway {
  constructor() {
    super('crypto');
  }

  canHandle(buttonOrContext) {
    return buttonOrContext.dataset?.gateway === 'crypto';
  }

  async handleButtonClick(button, context) {
    await this.recordPaymentAttempt({ cryptoCurrency: 'ETH', ...context });
  }
}

registerGateway('crypto', new CryptoPaymentGateway());
```

---

## 7. Payment Button Detection

Elysium automatically detects interactions with payment and checkout buttons using a lightweight, delegated event listener and `MutationObserver` (supporting React hydration, Vue, and dynamically rendered buttons).

Simply add the configured CSS class (default `elysium-payment-button`) and optional `data-gateway` attributes:

```html
<!-- Stripe Checkout Button -->
<button
  class="elysium-payment-button"
  data-gateway="stripe"
  data-amount="149.00"
  data-currency="USD"
>
  Pay with Card (Stripe)
</button>

<!-- Razorpay Button -->
<button
  class="elysium-payment-button"
  data-gateway="razorpay"
  data-amount="149.00"
  data-currency="USD"
>
  Pay with UPI / Cards (Razorpay)
</button>

<!-- PayPal Button -->
<button
  class="elysium-payment-button"
  data-gateway="paypal"
>
  PayPal Express Checkout
</button>
```

### Lifecycle Events Dispatched

| Event Name | Description | Detail Object |
| :--- | :--- | :--- |
| `elysium:touch_recorded` | Fired when a page touch is transmitted and accepted | `{ payload, response }` |
| `elysium:button_detected` | Fired when a payment button is observed in DOM | `{ button }` |
| `elysium:payment_attempt` | Fired when user clicks payment button (intent only) | `{ gateway, button, context }` |
| `elysium:payment_success` | Fired when payment is confirmed by gateway | `{ gateway, transactionId, amount, ... }` |
| `elysium:payment_failure` | Fired on checkout cancellation or card decline | `{ gateway, errorCode, errorMessage }` |

---

## 8. Backend Integration & Limitations

### Critical Security Rule: Secret Keys on Backend
Client-side code operates in an untrusted environment. Only publishable API keys may be used in `elysium.config.js`. Secret keys (e.g., Stripe `sk_live_...`, Razorpay `key_secret`) must **NEVER** be placed in frontend code.

### Backend Webhook Connectors (`asbtemp.vercel.app`)

Authoritative payment attribution is verified server-side through your connector webhook routes:

```javascript
app.use('/api/connectors', connectorRoutes);
```

Configure these exact webhook destination URLs in each provider's developer dashboard:

| Provider | Webhook Endpoint URL | Trigger Events | Metadata / Field Mapping |
| :--- | :--- | :--- | :--- |
| **Stripe** | `https://asbtemp.vercel.app/api/connectors/stripe/webhook` | `payment_intent.succeeded`, `checkout.session.completed` | `metadata: { elysium_session_id, elysium_visitor_id }` |
| **Shopify** | `https://asbtemp.vercel.app/api/connectors/shopify/webhook` | `orders/paid`, `orders/create` | `note_attributes: [{ name: "elysium_session_id", value: "..." }]` |
| **Zenoti** | `https://asbtemp.vercel.app/api/connectors/zenoti/webhook` | `invoice.closed`, `appointment.paid` | `notes: "elysium_session_id: ..."` |
| **Razorpay** | `https://asbtemp.vercel.app/api/connectors/razorpay/webhook` | `order.paid`, `payment.captured` | `notes: { elysium_session_id, elysium_visitor_id }` |
| **PayPal** | `https://asbtemp.vercel.app/api/connectors/paypal/webhook` | `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED` | `purchase_units[0].custom_id: elysium_session_id` |
| **WooCommerce** | `https://asbtemp.vercel.app/api/connectors/woocommerce/webhook` | `order.created`, `order.updated` | `meta_data: [{ key: "_elysium_session_id", value: "..." }]` |
| **Square** | `https://asbtemp.vercel.app/api/connectors/square/webhook` | `payment.updated` | `note: JSON.stringify({ elysium_session_id })` |
| **Generic** | `https://asbtemp.vercel.app/api/connectors/generic/webhook` | Any custom payment callback | `{ session_id, visitor_id, transaction_id, amount }` |

#### How Frontend Attaches Attribution Before Webhooks Fire:
1. **Create Checkout Session**: Call `const session = await Elysium.createCheckoutSession()` before launching payment.
2. **Pass Metadata**: Supply `session.checkoutSessionId` and `session.visitorId` to the provider checkout call.
3. **Webhook Verification**: When the provider confirms the charge, it pushes the webhook to `https://asbtemp.vercel.app/api/connectors/:provider/webhook`. The backend validates the signature, extracts the session ID, and seals attribution.

---

## 9. API Reference

- `Elysium.init(config)`: Initializes tracking, button observers, and gateways.
- `Elysium.configure(updates)`: Updates configuration dynamically at runtime.
- `Elysium.getVisitorId()`: Returns active visitor ID.
- `Elysium.setVisitorId(id)`: Overrides active visitor ID.
- `Elysium.recordTouch(options)`: Explicitly sends a touchpoint.
- `Elysium.recordProductTouch()`: Preserved backward-compatible product touch tracking.
- `Elysium.identifyVisitor(email, traits)`: Links visitor ID to a customer profile.
- `Elysium.createCheckoutSession()`: Obtains checkout attribution token.
- `Elysium.recordPaymentSuccess(details)`: Records verified payment.
- `Elysium.recordPaymentFailure(details)`: Records payment failure or cancellation.
- `Elysium.registerGateway(name, instance)`: Registers custom payment gateway.
- `Elysium.getGateway(name)`: Retrieves gateway by name.
