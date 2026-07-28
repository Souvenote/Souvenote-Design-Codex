import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockNotificationProvider } from './mock-notification.provider';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { SendGridNotificationProvider } from './sendgrid-notification.provider';

describe('NotificationProviderRegistry', () => {
  const getConfig = jest.fn();
  const mockProvider = { mode: 'mock' } as MockNotificationProvider;
  const assertConfigured = jest.fn();
  const sendGridProvider = {
    mode: 'sendgrid',
    assertConfigured,
  } as unknown as SendGridNotificationProvider;
  const registry = new NotificationProviderRegistry(
    { get: getConfig } as unknown as ConfigService,
    mockProvider,
    sendGridProvider,
  );

  beforeEach(() => {
    getConfig.mockReset();
    assertConfigured.mockClear();
  });

  it('defaults to the no-network mock outside production', () => {
    expect(registry.getActiveProvider()).toBe(mockProvider);
  });

  it('selects SendGrid explicitly', () => {
    getConfig.mockImplementation((key: string) =>
      key === 'NOTIFICATION_PROVIDER_MODE' ? 'sendgrid' : undefined,
    );

    expect(registry.getActiveProvider()).toBe(sendGridProvider);
    expect(assertConfigured).toHaveBeenCalledTimes(1);
  });

  it('rejects mock delivery in production', () => {
    getConfig.mockImplementation(
      (key: string) =>
        ({
          NODE_ENV: 'production',
          NOTIFICATION_PROVIDER_MODE: 'mock',
        })[key],
    );

    expect(() => registry.getActiveProvider()).toThrow(
      InternalServerErrorException,
    );
  });

  it('allows mock delivery for an explicit production preview', () => {
    getConfig.mockImplementation(
      (key: string) =>
        ({
          NODE_ENV: 'production',
          PRODUCTION_PREVIEW_MODE: 'true',
          NOTIFICATION_PROVIDER_MODE: 'mock',
        })[key],
    );

    expect(registry.getActiveProvider()).toBe(mockProvider);
  });
});
