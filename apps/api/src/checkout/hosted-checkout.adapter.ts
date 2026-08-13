import { Injectable } from '@nestjs/common';
import type { CheckoutCollectionMode, CheckoutPurpose } from './checkout.repository';

export type HostedCheckoutRequest = Readonly<{
  sessionId: string;
  purpose: CheckoutPurpose;
  collectionMode: CheckoutCollectionMode;
  amountMinor: number;
  currency: 'CAD';
}>;

export type HostedCheckoutResult = Readonly<{
  provider: 'mock';
  providerSessionId: string;
  checkoutUrl: string;
}>;

export interface HostedCheckoutAdapter {
  create(request: HostedCheckoutRequest): Promise<HostedCheckoutResult>;
}

/**
 * Models a provider-hosted redirect without accepting card fields. Stripe test
 * activation can implement this interface later without changing domain state.
 */
@Injectable()
export class DeterministicHostedCheckoutAdapter implements HostedCheckoutAdapter {
  create(request: HostedCheckoutRequest): Promise<HostedCheckoutResult> {
    const compactId = request.sessionId.replaceAll('-', '');
    return Promise.resolve({
      provider: 'mock' as const,
      providerSessionId: `mock_checkout_${compactId}`,
      checkoutUrl: `/checkout/test/${request.sessionId}`,
    });
  }
}
