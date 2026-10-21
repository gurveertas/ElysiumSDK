#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const configPath = 'elysium.config.js';

if (fs.existsSync(configPath)) {
  console.log(`[ElysiumSDK] Configuration file already exists at ${path.resolve(configPath)}`);
  process.exit(0);
}

const template = `/**
 * ElysiumSDK Configuration File
 *
 * IMPORTANT SECURITY NOTICE:
 * This configuration is loaded on the client side (browser).
 * ONLY include PUBLISHABLE keys here. NEVER expose secret keys
 * (e.g., Stripe secret key "sk_live_...", Razorpay key secret, or private tokens).
 * Secret keys must remain strictly on your backend server.
 */
export default {
  // Public attribution API Key provided by Elysium
  apiKey: "YOUR_ELYSIUM_PUBLIC_API_KEY",

  // Attribution API Backend endpoint
  apiBaseUrl: "https://asbTemp-production.up.railway.app",

  // Enable verbose debugging logs in browser console
  debug: false,

  // Session inactivity timeout in milliseconds (default: 30 minutes)
  sessionWindowMs: 30 * 60 * 1000,

  // CSS selector or class for detecting checkout/payment buttons
  buttonSelector: ".elysium-payment-button",

  // Automatically record touch on page load
  autoTrack: true,

  // Optional: restrict touch tracking to specific path regex (e.g. product pages only)
  // productPathRegex: null,

  // Domain for cross-subdomain cookie tracking (e.g., ".yourstore.com")
  cookieDomain: undefined,

  // Additional custom query parameters to capture and attribute
  customParams: [],

  // Supported payment gateways configuration (PUBLIC keys only)
  gateways: {
    stripe: {
      enabled: true,
      publishableKey: "pk_test_...", // Stripe Publishable Key (NOT secret key)
    },
    razorpay: {
      enabled: true,
      keyId: "rzp_test_...",        // Razorpay Key ID (NOT key secret)
    },
    paypal: {
      enabled: true,
      clientId: "YOUR_PAYPAL_CLIENT_ID", // PayPal Client ID (NOT client secret)
    },
  },
};
`;

fs.writeFileSync(configPath, template, 'utf8');
console.log(`[ElysiumSDK] Created template configuration file at ${configPath}`);
