import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsProviderRegistry } from './analytics-provider.registry';
import { DisabledAnalyticsProvider } from './disabled-analytics.provider';
import { PostHogAnalyticsProvider } from './posthog-analytics.provider';

describe('AnalyticsProviderRegistry', () => {
  const values: Record<string, string> = {};
  const getConfig = jest.fn((key: string) => values[key]);
  const assertConfigured = jest.fn();
  const disabled = { mode: 'disabled' } as DisabledAnalyticsProvider;
  const posthog = {
    mode: 'posthog',
    assertConfigured,
  } as unknown as PostHogAnalyticsProvider;
  const registry = new AnalyticsProviderRegistry(
    { get: getConfig } as unknown as ConfigService,
    disabled,
    posthog,
  );

  beforeEach(() => {
    for (const key of Object.keys(values)) delete values[key];
    getConfig.mockClear();
    assertConfigured.mockReset();
  });

  it('defaults to disabled outside production', () => {
    expect(registry.getActiveProvider()).toBe(disabled);
  });

  it('defaults to validated PostHog in production', () => {
    values.NODE_ENV = 'production';

    expect(registry.getActiveProvider()).toBe(posthog);
    expect(assertConfigured).toHaveBeenCalledTimes(1);
  });

  it('rejects disabling analytics in production', () => {
    values.NODE_ENV = 'production';
    values.ANALYTICS_PROVIDER_MODE = 'disabled';

    expect(() => registry.getActiveProvider()).toThrow(
      InternalServerErrorException,
    );
  });

  it('allows disabled analytics for an explicit production preview', () => {
    values.NODE_ENV = 'production';
    values.PRODUCTION_PREVIEW_MODE = 'true';
    values.ANALYTICS_PROVIDER_MODE = 'disabled';

    expect(registry.getActiveProvider()).toBe(disabled);
  });
});
