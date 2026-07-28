import type Stripe from 'stripe';

export type CheckoutProviderMode = 'mock' | 'stripe';
export type CheckoutCaptureMethod = 'automatic_async' | 'manual';

export type CheckoutSessionRequest = {
  localPaymentId: string;
  orderId: string | null;
  creditPackPurchaseId: string | null;
  userId: string;
  customerId: string | null;
  customerEmail: string;
  offerCode: string;
  productName: string;
  unitAmountCents: number;
  totalAmountCents: number;
  quantity: number;
  currency: string;
  captureMethod: CheckoutCaptureMethod;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
};

export type CheckoutSessionResult = {
  sessionId: string;
  paymentIntentId: string | null;
  checkoutUrl: string;
  expiresAt: Date | null;
  providerMetadata: Record<string, unknown>;
};

export type CheckoutFinalizationResult = {
  paymentIntentId: string;
  status: string;
  amountCapturedCents: number;
  providerMetadata: Record<string, unknown>;
};

export interface CheckoutProvider {
  readonly mode: CheckoutProviderMode;
  createSession(
    request: CheckoutSessionRequest,
  ): Promise<CheckoutSessionResult>;
  constructWebhookEvent?(payload: Buffer, signature: string): Stripe.Event;
  capturePayment?(
    paymentIntentId: string,
    amountCents: number,
    idempotencyKey: string,
  ): Promise<CheckoutFinalizationResult>;
  cancelPayment?(
    paymentIntentId: string,
    idempotencyKey: string,
  ): Promise<CheckoutFinalizationResult>;
}
