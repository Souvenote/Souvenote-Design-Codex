import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { AnalyticsProviderRegistry } from './analytics-provider.registry';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsCapture, AnalyticsProvider } from './analytics.provider';

describe('AnalyticsService', () => {
  const capture = jest.fn<void, [AnalyticsCapture]>();
  const provider: AnalyticsProvider = {
    mode: 'posthog',
    capture,
  };
  const getActiveProvider = jest.fn(() => provider);
  const registry = {
    getActiveProvider,
  } as unknown as AnalyticsProviderRegistry;
  const getConfig = jest.fn((key: string) =>
    key === 'ANALYTICS_ID_HASH_SECRET' ? 'ab'.repeat(32) : undefined,
  );
  const service = new AnalyticsService(
    { get: getConfig } as unknown as ConfigService,
    registry,
  );

  beforeEach(() => {
    capture.mockReset();
    getActiveProvider.mockClear();
    getConfig.mockClear();
  });

  it('pseudonymizes identities and deterministically deduplicates a funnel event', () => {
    service.checkoutStarted('user-sensitive-a', 'order-sensitive-a', {
      providerMode: 'stripe',
      offerType: 'try_risk_free_one_card',
      quantity: 1,
      currency: 'USD',
    });
    service.checkoutStarted('user-sensitive-a', 'order-sensitive-a', {
      providerMode: 'stripe',
      offerType: 'try_risk_free_one_card',
      quantity: 1,
      currency: 'USD',
    });

    expect(capture).toHaveBeenCalledTimes(2);
    const first = capture.mock.calls[0][0];
    const second = capture.mock.calls[1][0];
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      event: 'checkout started',
      properties: {
        schemaVersion: 1,
        source: 'backend',
        providerMode: 'stripe',
        offerType: 'try_risk_free_one_card',
        quantity: 1,
        currency: 'usd',
      },
    });
    expect(first.distinctId).toMatch(/^user_[a-f0-9]{32}$/);
    expect(first.eventId).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
    expect(JSON.stringify(first)).not.toMatch(
      /user-sensitive-a|order-sensitive-a|email|address|prompt|message|photo/i,
    );
  });

  it('does not require a hashing secret when analytics is disabled', () => {
    getActiveProvider.mockReturnValueOnce({
      mode: 'disabled',
      capture: jest.fn(),
    });

    expect(() => service.accountProvisioned('user-sensitive-a')).not.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });

  it('normalizes unexpected database-backed dimensions to bounded values', () => {
    service.orderConfirmed('user-a', 'order-a', {
      providerMode: 'stripe\nrecipient@example.com',
      offerType: 'offer with spaces',
      quantity: 100_001,
      currency: 'not-currency',
    });

    expect(capture.mock.calls[0][0].properties).toMatchObject({
      providerMode: 'unknown',
      offerType: 'unknown',
      quantity: 0,
      currency: 'unknown',
    });
  });

  it('fails startup when PostHog mode lacks the identity hashing secret', () => {
    const isolated = new AnalyticsService(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      registry,
    );

    expect(() => isolated.onModuleInit()).toThrow(InternalServerErrorException);
  });
});
