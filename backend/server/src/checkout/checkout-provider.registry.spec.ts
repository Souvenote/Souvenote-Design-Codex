import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutProviderRegistry } from './checkout-provider.registry';
import { MockCheckoutProvider } from './mock-checkout.provider';
import { StripeCheckoutProvider } from './stripe-checkout.provider';

describe('CheckoutProviderRegistry', () => {
  const getConfig = jest.fn();
  const mockProvider = { mode: 'mock' } as MockCheckoutProvider;
  const stripeProvider = { mode: 'stripe' } as StripeCheckoutProvider;
  const registry = new CheckoutProviderRegistry(
    { get: getConfig } as unknown as ConfigService,
    mockProvider,
    stripeProvider,
  );

  beforeEach(() => getConfig.mockReset());

  it('defaults to the no-network mock provider', () => {
    expect(registry.getActiveProvider()).toBe(mockProvider);
  });

  it('selects Stripe only when explicitly configured', () => {
    getConfig.mockReturnValue('stripe');
    expect(registry.getActiveProvider()).toBe(stripeProvider);
  });

  it('rejects an unknown checkout mode', () => {
    getConfig.mockReturnValue('other');
    expect(() => registry.getActiveProvider()).toThrow(
      InternalServerErrorException,
    );
  });
});
