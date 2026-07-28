import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import { PostHogAnalyticsProvider } from './posthog-analytics.provider';

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    _shutdown: jest.fn(() => Promise.resolve()),
  })),
}));

describe('PostHogAnalyticsProvider', () => {
  const values: Record<string, string> = {
    POSTHOG_API_KEY: `phc_${'a'.repeat(32)}`,
    POSTHOG_HOST: 'https://us.i.posthog.com',
  };
  const getConfig = jest.fn((key: string) => values[key]);
  const provider = new PostHogAnalyticsProvider({
    get: getConfig,
  } as unknown as ConfigService);

  beforeEach(() => {
    values.POSTHOG_API_KEY = `phc_${'a'.repeat(32)}`;
    values.POSTHOG_HOST = 'https://us.i.posthog.com';
    getConfig.mockClear();
    (PostHog as unknown as jest.Mock).mockClear();
  });

  it('captures a no-profile, no-geoip server event', () => {
    provider.capture({
      distinctId: `user_${'b'.repeat(32)}`,
      eventId: '11111111-1111-5111-8111-111111111111',
      event: 'order confirmed',
      properties: {
        schemaVersion: 1,
        source: 'backend',
        quantity: 1,
      },
    });

    expect(PostHog).toHaveBeenCalledWith(
      values.POSTHOG_API_KEY,
      expect.objectContaining({
        host: 'https://us.i.posthog.com',
        privacyMode: true,
        enableExceptionAutocapture: false,
      }),
    );
    const client = (PostHog as unknown as jest.Mock).mock.results[0].value as {
      capture: jest.Mock;
    };
    expect(client.capture).toHaveBeenCalledWith({
      distinctId: `user_${'b'.repeat(32)}`,
      uuid: '11111111-1111-5111-8111-111111111111',
      event: 'order confirmed',
      properties: {
        schemaVersion: 1,
        source: 'backend',
        quantity: 1,
        $process_person_profile: false,
      },
      disableGeoip: true,
    });
  });

  it('rejects a non-official ingestion host', () => {
    values.POSTHOG_HOST = 'https://collector.example.com';
    const isolated = new PostHogAnalyticsProvider({
      get: getConfig,
    } as unknown as ConfigService);

    expect(() => isolated.assertConfigured()).toThrow(
      InternalServerErrorException,
    );
  });
});
