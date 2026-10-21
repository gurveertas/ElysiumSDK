/**
 * ElysiumSDK TypeScript Definitions
 */

export interface ElysiumGatewayConfig {
  enabled?: boolean;
  publishableKey?: string;
  keyId?: string;
  clientId?: string;
  [key: string]: unknown;
}

export interface ElysiumConfig {
  /** Elysium Public API Key */
  apiKey: string;
  /** Elysium Backend API URL (default: https://asbTemp-production.up.railway.app) */
  apiBaseUrl?: string;
  /** Enable verbose console debug logs */
  debug?: boolean;
  /** Session timeout window in milliseconds (default: 30 minutes) */
  sessionWindowMs?: number;
  /** CSS selector for payment buttons (default: .elysium-payment-button) */
  buttonSelector?: string;
  /** Automatically track touch on initialization (default: true) */
  autoTrack?: boolean;
  /** Optional RegExp to filter paths for touch tracking (e.g. product pages only) */
  productPathRegex?: RegExp | string | null;
  /** Cookie domain for cross-subdomain tracking (e.g. .example.com) */
  cookieDomain?: string;
  /** Additional custom query parameters to track */
  customParams?: string[];
  /** Supported payment gateway options */
  gateways?: {
    stripe?: ElysiumGatewayConfig;
    razorpay?: ElysiumGatewayConfig;
    paypal?: ElysiumGatewayConfig;
    [key: string]: ElysiumGatewayConfig | undefined;
  };
}

export interface TouchPayload {
  visitorId: string;
  touchedAt: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrer: string | null;
  landingPage: string;
  pageTitle: string;
  channel?: string;
  gclid?: string | null;
  dclid?: string | null;
  wbraid?: string | null;
  gbraid?: string | null;
  srsltid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  msclkid?: string | null;
  twclid?: string | null;
  li_fat_id?: string | null;
  rdt_cid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  ttp?: string | null;
  ga?: string | null;
  custom?: Record<string, unknown>;
}

export interface TouchResponse {
  id: string;
  visitorId: string;
  channel: string;
  touchedAt: string;
  [key: string]: unknown;
}

export interface StoredTouch {
  payload: TouchPayload;
  response: TouchResponse;
  recordedAt: number;
}

export interface CheckoutSession {
  checkoutSessionId: string;
  token: string;
  visitorId: string;
  visitorRecordId: string;
  touchIds: string[];
  touchCount: number;
  expiresAt: string;
}

export interface PaymentAttemptDetails {
  gateway?: string;
  buttonId?: string | null;
  buttonClass?: string | null;
  buttonText?: string | null;
  amount?: number | null;
  currency?: string | null;
  productId?: string | null;
  [key: string]: unknown;
}

export interface PaymentSuccessDetails {
  gateway?: string;
  transactionId?: string | null;
  orderId?: string | null;
  amount?: number | null;
  currency?: string | null;
  signature?: string | null;
  [key: string]: unknown;
}

export interface PaymentFailureDetails {
  gateway?: string;
  code?: string | null;
  message?: string | null;
  [key: string]: unknown;
}

export abstract class PaymentGateway {
  name: string;
  config: ElysiumGatewayConfig;
  constructor(name: string, config?: ElysiumGatewayConfig);
  init(config?: ElysiumGatewayConfig): void;
  canHandle(buttonOrContext: HTMLElement | Record<string, unknown>): boolean;
  handleButtonClick(button: HTMLElement | null, context?: Record<string, unknown>): Promise<unknown>;
  recordPaymentAttempt(details?: PaymentAttemptDetails): Promise<unknown>;
  recordPaymentSuccess(paymentData?: PaymentSuccessDetails): Promise<unknown>;
  recordPaymentFailure(errorData?: PaymentFailureDetails): Promise<unknown>;
  on(event: 'attempt' | 'success' | 'failure', callback: (data: unknown) => void): () => void;
}

export class StripeGateway extends PaymentGateway {
  constructor(config?: ElysiumGatewayConfig);
  checkRedirectReturn(): void;
  wrapStripe<T>(stripeInstance: T): T;
}

export class RazorpayGateway extends PaymentGateway {
  constructor(config?: ElysiumGatewayConfig);
  wrapOptions<T extends Record<string, unknown>>(options: T): T;
  wrapInstance<T>(rzpInstance: T): T;
}

export class PayPalGateway extends PaymentGateway {
  constructor(config?: ElysiumGatewayConfig);
  wrapButtons<T extends Record<string, unknown>>(options: T): T;
}

export class ShopifyGateway extends PaymentGateway {
  constructor(config?: ElysiumGatewayConfig);
  attachCartAttributes(checkoutSessionId: string): Promise<void>;
}

export class WooCommerceGateway extends PaymentGateway {
  constructor(config?: ElysiumGatewayConfig);
  injectHiddenCheckoutFields(): void;
}

export class SquareGateway extends PaymentGateway {
  constructor(config?: ElysiumGatewayConfig);
}

export class ZenotiGateway extends PaymentGateway {
  constructor(config?: ElysiumGatewayConfig);
}

export class GenericGateway extends PaymentGateway {
  constructor(name?: string, config?: ElysiumGatewayConfig);
}

export class GatewayRegistry {
  register(name: string, gatewayInstance: PaymentGateway): PaymentGateway;
  get(name: string): PaymentGateway | null;
  getAll(): PaymentGateway[];
  resolveForButton(buttonElement: HTMLElement | null): PaymentGateway;
  configureAll(gatewaysConfig?: Record<string, ElysiumGatewayConfig>): void;
}

export function init(config?: Partial<ElysiumConfig>): typeof Elysium;
export function configure(updates?: Partial<ElysiumConfig>): ElysiumConfig;
export function getConfig(): ElysiumConfig;
export function getVisitorId(): string;
export function setVisitorId(newId: string): void;
export function recordTouch(options?: { force?: boolean; customData?: Record<string, unknown> }): Promise<{ ok: boolean; data?: TouchResponse; error?: string; skipped?: boolean }>;
export function recordProductTouch(): Promise<unknown>;
export function identifyVisitor(email: string, traits?: Record<string, unknown>): Promise<boolean>;
export function createCheckoutSession(): Promise<CheckoutSession>;
export function buildPayload(customData?: Record<string, unknown>): TouchPayload;
export function readTouchHistory(): StoredTouch[];
export function getTouchSignature(payload: TouchPayload): string;
export function initPaymentButtonDetection(customSelector?: string | null): () => void;
export function registerGateway(name: string, gatewayInstance: PaymentGateway): PaymentGateway;
export function getGateway(name: string): PaymentGateway | null;
export function recordPaymentAttempt(details?: PaymentAttemptDetails): Promise<unknown>;
export function recordPaymentSuccess(details?: PaymentSuccessDetails): Promise<unknown>;
export function recordPaymentFailure(details?: PaymentFailureDetails): Promise<unknown>;

export const Elysium: {
  init: typeof init;
  configure: typeof configure;
  getConfig: typeof getConfig;
  getVisitorId: typeof getVisitorId;
  setVisitorId: typeof setVisitorId;
  recordTouch: typeof recordTouch;
  recordProductTouch: typeof recordProductTouch;
  identifyVisitor: typeof identifyVisitor;
  createCheckoutSession: typeof createCheckoutSession;
  buildPayload: typeof buildPayload;
  readTouchHistory: typeof readTouchHistory;
  getTouchSignature: typeof getTouchSignature;
  initPaymentButtonDetection: typeof initPaymentButtonDetection;
  registerGateway: typeof registerGateway;
  getGateway: typeof getGateway;
  recordPaymentAttempt: typeof recordPaymentAttempt;
  recordPaymentSuccess: typeof recordPaymentSuccess;
  recordPaymentFailure: typeof recordPaymentFailure;
  gateways: {
    PaymentGateway: typeof PaymentGateway;
    StripeGateway: typeof StripeGateway;
    RazorpayGateway: typeof RazorpayGateway;
    PayPalGateway: typeof PayPalGateway;
    GenericGateway: typeof GenericGateway;
    registry: GatewayRegistry;
  };
};

export default Elysium;
