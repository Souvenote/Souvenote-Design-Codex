import { DeterministicHostedCheckoutAdapter } from './hosted-checkout.adapter';

describe('DeterministicHostedCheckoutAdapter', () => {
  it('returns a stable hosted redirect without accepting payment-card fields', async () => {
    const adapter = new DeterministicHostedCheckoutAdapter();
    const request = {
      sessionId: '45000000-0000-4000-8000-000000000001',
      purpose: 'physical_order' as const,
      collectionMode: 'manual' as const,
      amountMinor: 999,
      currency: 'CAD' as const,
    };

    const first = await adapter.create(request);
    const second = await adapter.create(request);

    expect(first).toEqual(second);
    expect(first).toEqual({
      provider: 'mock',
      providerSessionId: 'mock_checkout_45000000000040008000000000000001',
      checkoutUrl: '/checkout/test/45000000-0000-4000-8000-000000000001',
    });
    expect(Object.keys(request)).not.toEqual(
      expect.arrayContaining(['cardNumber', 'expiry', 'cvc', 'cvv', 'paymentMethodData']),
    );
  });
});
