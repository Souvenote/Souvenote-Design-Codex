import { MockCheckoutProvider } from './mock-checkout.provider';

describe('MockCheckoutProvider', () => {
  const provider = new MockCheckoutProvider();

  it('returns the same local session for retries of one payment attempt', async () => {
    const request = {
      localPaymentId: 'payment-a',
      orderId: 'order-a',
      creditPackPurchaseId: null,
      cardPackPurchaseId: null,
      userId: 'user-a',
      customerId: null,
      customerEmail: 'user@example.com',
      offerCode: 'try_risk_free_one_card',
      productName: 'Try Risk-Free',
      unitAmountCents: 999,
      totalAmountCents: 999,
      quantity: 1,
      currency: 'usd',
      captureMethod: 'automatic_async' as const,
      successUrl:
        'http://localhost:3000/delivery?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'http://localhost:3000/delivery?checkout=cancel',
      idempotencyKey: 'checkout:order-a:mock:attempt:1',
    };

    const first = await provider.createSession(request);
    const replay = await provider.createSession(request);

    expect(replay.sessionId).toBe(first.sessionId);
    expect(replay.checkoutUrl).toBe(first.checkoutUrl);
  });
});
