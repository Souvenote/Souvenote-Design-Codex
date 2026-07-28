import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CheckoutProvider } from './checkout.provider';
import { MockCheckoutProvider } from './mock-checkout.provider';
import { StripeCheckoutProvider } from './stripe-checkout.provider';

@Injectable()
export class CheckoutProviderRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockCheckoutProvider,
    private readonly stripeProvider: StripeCheckoutProvider,
  ) {}

  getActiveProvider(): CheckoutProvider {
    const mode =
      this.configService
        .get<string>('CHECKOUT_PROVIDER_MODE')
        ?.trim()
        .toLowerCase() || 'mock';

    if (mode === 'mock') return this.mockProvider;
    if (mode === 'stripe') return this.stripeProvider;
    throw new InternalServerErrorException(
      'CHECKOUT_PROVIDER_MODE must be mock or stripe.',
    );
  }

  getStripeProvider() {
    return this.stripeProvider;
  }
}
