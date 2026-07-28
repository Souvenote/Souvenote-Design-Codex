import { Injectable } from '@nestjs/common';
import type {
  CheckoutProvider,
  CheckoutSessionRequest,
} from './checkout.provider';

@Injectable()
export class MockCheckoutProvider implements CheckoutProvider {
  readonly mode = 'mock' as const;

  async createSession(request: CheckoutSessionRequest) {
    await Promise.resolve();
    const sessionId = `mock_checkout_${request.localPaymentId}`;
    return {
      sessionId,
      paymentIntentId: `mock_payment_intent_${sessionId}`,
      checkoutUrl: `mock://souvenote/checkout/${sessionId}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      providerMetadata: {
        mock: true,
        successUrl: request.successUrl,
        cancelUrl: request.cancelUrl,
      },
    };
  }
}
