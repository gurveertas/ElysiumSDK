# Elysium Attribution SDK

> Multi-touch marketing attribution and conversion tracking JavaScript SDK for web storefronts, SaaS applications, and e-commerce platforms.

Connects your frontend store directly to the **Elysium Attribution Engine**, tracking visitor journeys from advertising click to checkout and conversion across 6 multi-touch attribution models:
* First Touch
* Last Touch
* Last Non-Direct Touch
* Linear
* Time Decay
* Position Based (U-Shaped)

---

## 1. Quick Start

Install the package via npm, yarn, or pnpm:

```bash
npm install elysium-attribution
```

Initialize Elysium once on your website (e.g. `main.js`, `_app.js`, or `<script>` tag):

```javascript
import Elysium from 'elysium-attribution';

// Initialize with your publishable key
Elysium.init({
  apiKey: 'pk_live_xxxxxxxxxxxxxxxxxxxxxxxx',
  apiBaseUrl: 'http://localhost:5000', // Or your production API URL
  autoTrack: true,                     // Automatically tracks page views on load
});
```

*By default, `autoTrack: true` immediately records incoming UTM tags, advertising click IDs (`gclid`, `fbclid`, `ttclid`, `msclkid`), and referrers without any extra code!*

---

## 2. Core Integration Workflows

### 2.1 Identify Visitors (Sign-In, Forms, Newsletters)
Whenever a visitor enters their email or phone number, call `identify` to associate their anonymous browsing history with their customer profile:

```javascript
// By email & phone
await Elysium.identify('customer@example.com', '+14155552671');

// Or by object
await Elysium.identify({
  email: 'customer@example.com',
  phone: '+14155552671',
});
```

### 2.2 Get Checkout Session Token
When a user begins checkout, freeze their touchpoints into an immutable attribution snapshot token:

```javascript
// One-liner token retrieval
const token = await Elysium.getCheckoutToken();
console.log('Attribution token:', token); // e.g. "cs_sec_abc123..."
```

Pass this token into your payment gateway or booking notes:

| Payment Provider | Where to put the token |
|---|---|
| **Stripe** | `metadata.attribution_token` or `client_reference_id` |
| **Razorpay** | `notes.attribution_token` |
| **PayPal** | `custom_id` on purchase unit |
| **Shopify** | Cart attribute named `attribution_token` |
| **Zenoti** | Appointment notes containing `attribution_token:<token>` |
| **WooCommerce** | Auto-injected form field `attribution_token` |

### 2.3 Record Conversions & Orders Directly
If you are processing client-side orders without backend webhooks:

```javascript
await Elysium.createOrder({
  externalId: 'order_98765',                // Your internal order ID
  orderedAt: new Date().toISOString(),      // Time order was paid
  currency: 'USD',                          // 3-letter ISO code
  grossAmount: 140.00,                      // In major units
  netAmount: 140.00,
  discountAmount: 10.00,
  taxAmount: 0.00,
  email: 'customer@example.com',
  items: [
    {
      name: 'Running Shoes',
      quantity: 1,
      unitAmount: 140.00,
      currency: 'USD',
      externalId: 'prod_shoes_1'
    }
  ]
});
```

### 2.4 Record Service Bookings
For appointment and reservation-based businesses:

```javascript
await Elysium.createBooking({
  externalId: 'booking_456',
  appointmentStartAt: '2026-04-10T14:00:00Z',
  currency: 'USD',
  bookedValue: 75.00,
  serviceName: 'Hair Styling & Consultation',
  email: 'client@example.com',
  phone: '+14155552671'
});
```

---

## 3. Payment Gateway Integrations

The SDK includes specialized helpers for popular payment providers to ensure zero attribution data loss:

### Stripe Integration
```javascript
import { Elysium } from 'elysium-attribution';

const stripeGateway = Elysium.gateways.registry.get('stripe');

// Method 1: Helper to attach token to Stripe options
const paymentIntentData = stripeGateway.attachToken({
  amount: 5000,
  currency: 'usd',
}, await Elysium.getCheckoutToken());

// Method 2: Wrap stripe instance to automatically intercept confirmPayment
const stripe = stripeGateway.wrapStripe(Stripe('pk_test_...'));
await stripe.confirmPayment({ ... });
```

### Razorpay Integration
```javascript
import { Elysium } from 'elysium-attribution';

const rzpGateway = Elysium.gateways.registry.get('razorpay');

// Wrap options to automatically attach notes.attribution_token and intercept success/dismissal
const options = rzpGateway.wrapOptions({
  key: 'rzp_test_...',
  amount: 50000,
  currency: 'INR',
  handler: function(response) {
    console.log('Payment successful:', response);
  }
}, await Elysium.getCheckoutToken());

const rzp = new Razorpay(options);
rzp.open();
```

### PayPal Integration
```javascript
import { Elysium } from 'elysium-attribution';

const paypalGateway = Elysium.gateways.registry.get('paypal');

// Wrap PayPal button options
paypal.Buttons(paypalGateway.wrapButtons({
  createOrder: (data, actions) => {
    return actions.order.create({
      purchase_units: [
        paypalGateway.attachToken({
          amount: { value: '99.00' }
        }, token)
      ]
    });
  },
  onApprove: (data, actions) => {
    // Payment approved
  }
})).render('#paypal-button-container');
```

### Shopify Integration
When running in a Shopify theme, the SDK automatically attaches cart attributes upon clicking checkout buttons, or manually:
```javascript
await Elysium.gateways.registry.get('shopify').attachCartAttributes();
```

---

## 4. Automatic Button & Form Detection

Elysium includes an automated DOM button detector. Any button with the `.elysium-payment-button` class or `data-elysium-checkout` attribute will automatically:
1. Ensure a valid checkout token is generated.
2. Inject hidden `attribution_token` inputs into surrounding forms.
3. Emit `elysium:payment_attempt` events.

```html
<form action="/checkout" method="POST">
  <!-- Hidden attribution token input will be automatically injected here -->
  <button type="submit" class="elysium-payment-button">Proceed to Checkout</button>
</form>
```

---

## 5. Security & Key Permissions

* **Publishable Keys (`pk_live_...` / `pk_test_...`)**: Safe to use in browser JavaScript. Allowed strictly for tracking touches (`POST /v1/touches`), identifying visitors (`POST /v1/identify`), creating checkout sessions (`POST /v1/checkout-sessions`), and ingesting conversions (`POST /v1/orders`).
* **Secret Keys (`sk_live_...` / `sk_test_...`)**: **NEVER** expose in browser source code or public repos. Secret keys are strictly required for refunds (`POST /v1/refunds`), updates (`PATCH /v1/orders/:id`), and read APIs (`GET /v1/*`).

*The SDK automatically sanitizes configurations and strips secret keys if mistakenly passed in client-side code.*

---

## 6. Full API Reference

| Method | Description |
|---|---|
| `Elysium.init(config)` | Initialize the SDK with publishable key and options |
| `Elysium.recordTouch(options)` | Send pageview touchpoint with UTMs & Click IDs |
| `Elysium.identify(email, phone)` | Link current visitor to customer profile |
| `Elysium.getCheckoutToken()` | Get checkout snapshot token string |
| `Elysium.createCheckoutSession()` | Create full checkout session object |
| `Elysium.createOrder(orderData)` | Ingest paid order / conversion (`POST /v1/orders`) |
| `Elysium.createBooking(bookingData)` | Ingest service booking (`POST /v1/bookings`) |
| `Elysium.getVisitorId()` | Retrieve current persistent visitor UUID |
| `Elysium.setVisitorId(id)` | Override or update visitor UUID |
| `Elysium.configure(updates)` | Update runtime configuration |
| `Elysium.gateways.registry` | Access payment gateway handlers |

---

## 7. License

ISC © Elysium
