export interface ElysiumConfig {
  /** Publishable API key provided by Elysium (pk_live_... or pk_test_...) */
  apiKey: string;
  /** Attribution backend API URL (e.g. 'http://localhost:5000') */
  apiBaseUrl?: string;
  /** Enable debug logging in browser console */
  debug?: boolean;
  /** Session inactivity window in ms (default: 30 minutes) */
  sessionWindowMs?: number;
  /** CSS selector for detecting payment buttons */
  buttonSelector?: string;
  /** Automatically record touch on page load */
  autoTrack?: boolean;
  /** Restrict touch tracking to path matching regex */
  productPathRegex?: RegExp | string | null;
  /** Domain for cross-subdomain cookie tracking */
  cookieDomain?: string;
  /** Additional custom query parameters to track */
  customParams?: string[];
  /** Gateway configuration options */
  gateways?: Record<string, any>;
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
  gclid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  msclkid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  ga?: string | null;
  [key: string]: any;
}

export interface TouchResponse {
  id: string;
  touchId: string;
  visitorId: string;
  visitorRecordId?: string;
  siteId?: string | null;
  channel?: string;
  touchedAt: string;
  offlineMode?: boolean;
}

export interface IdentifyPayload {
  email?: string;
  phone?: string;
}

export interface IdentifyResponse {
  customerId: string;
  visitorId: string;
  visitorRecordId: string;
  touchIds: string[];
  touchCount: number;
  isNew: boolean;
}

export interface CheckoutSessionResponse {
  checkoutSessionId: string;
  token: string;
  visitorId: string;
  visitorRecordId?: string;
  touchIds: string[];
  touchCount: number;
  expiresAt: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  unitAmount: number;
  currency: string;
  externalId?: string;
}

export interface CreateOrderPayload {
  externalId: string;
  orderedAt?: string;
  currency: string;
  grossAmount: number;
  netAmount: number;
  discountAmount?: number;
  taxAmount?: number;
  checkoutToken?: string;
  visitorId?: string;
  email?: string;
  phone?: string;
  locationId?: string;
  items?: OrderItem[];
  idempotencyKey?: string;
  connectorId?: string;
}

export interface CreateBookingPayload {
  externalId: string;
  appointmentStartAt: string;
  currency: string;
  bookedValue?: number;
  checkoutToken?: string;
  visitorId?: string;
  email?: string;
  phone?: string;
  serviceName?: string;
  appointmentEndAt?: string;
  locationId?: string;
  idempotencyKey?: string;
  connectorId?: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
  blocked?: boolean;
  rateLimit?: {
    limit: string | null;
    remaining: string | null;
    reset: string | null;
    retryAfter: string | null;
  };
}

export declare function init(config: ElysiumConfig): typeof Elysium;
export declare function configure(updates: Partial<ElysiumConfig>): ElysiumConfig;
export declare function getConfig(): ElysiumConfig;
export declare function getVisitorId(): string;
export declare function setVisitorId(newId: string): void;
export declare function recordTouch(options?: { force?: boolean; customData?: Record<string, any> }): Promise<ApiResponse<TouchResponse>>;
export declare function recordProductTouch(): Promise<ApiResponse<TouchResponse> | void>;
export declare function identify(emailOrData: string | IdentifyPayload, phone?: string | null): Promise<ApiResponse<IdentifyResponse>>;
export declare function identifyVisitor(emailOrData: string | IdentifyPayload, phone?: string | null): Promise<ApiResponse<IdentifyResponse>>;
export declare function createCheckoutSession(options?: { expiresInMs?: number }): Promise<ApiResponse<CheckoutSessionResponse>>;
export declare function getCheckoutToken(options?: { expiresInMs?: number }): Promise<string>;
export declare function createOrder(orderData: CreateOrderPayload): Promise<ApiResponse<any>>;
export declare function recordOrder(orderData: CreateOrderPayload): Promise<ApiResponse<any>>;
export declare function recordConversion(orderData: CreateOrderPayload): Promise<ApiResponse<any>>;
export declare function createBooking(bookingData: CreateBookingPayload): Promise<ApiResponse<any>>;
export declare function recordBooking(bookingData: CreateBookingPayload): Promise<ApiResponse<any>>;
export declare function buildPayload(customData?: Record<string, any>): TouchPayload;
export declare function readTouchHistory(): any[];
export declare function getTouchSignature(payload: TouchPayload): string;
export declare function extractMarketingParams(search?: string): any;
export declare function parseReferrer(referrer?: string, hostname?: string): any;
export declare function initPaymentButtonDetection(selector?: string | null): () => void;
export declare function registerGateway(name: string, instance: any): any;
export declare function getGateway(name: string): any;
export declare function recordPaymentSuccess(details?: any): Promise<any>;
export declare function recordPaymentFailure(details?: any): Promise<any>;
export declare function recordPaymentAttempt(details?: any): Promise<any>;

export declare const Elysium: {
  init: typeof init;
  configure: typeof configure;
  getConfig: typeof getConfig;
  getVisitorId: typeof getVisitorId;
  setVisitorId: typeof setVisitorId;
  recordTouch: typeof recordTouch;
  recordProductTouch: typeof recordProductTouch;
  identify: typeof identify;
  identifyVisitor: typeof identifyVisitor;
  createCheckoutSession: typeof createCheckoutSession;
  getCheckoutToken: typeof getCheckoutToken;
  createOrder: typeof createOrder;
  recordOrder: typeof recordOrder;
  recordConversion: typeof recordConversion;
  createBooking: typeof createBooking;
  recordBooking: typeof recordBooking;
  buildPayload: typeof buildPayload;
  readTouchHistory: typeof readTouchHistory;
  getTouchSignature: typeof getTouchSignature;
  extractMarketingParams: typeof extractMarketingParams;
  parseReferrer: typeof parseReferrer;
  initPaymentButtonDetection: typeof initPaymentButtonDetection;
  registerGateway: typeof registerGateway;
  getGateway: typeof getGateway;
  recordPaymentAttempt: typeof recordPaymentAttempt;
  recordPaymentSuccess: typeof recordPaymentSuccess;
  recordPaymentFailure: typeof recordPaymentFailure;
  gateways: Record<string, any>;
};

export default Elysium;
