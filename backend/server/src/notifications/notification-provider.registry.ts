import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationProvider } from './notification.provider';
import { MockNotificationProvider } from './mock-notification.provider';
import { SendGridNotificationProvider } from './sendgrid-notification.provider';

@Injectable()
export class NotificationProviderRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockNotificationProvider,
    private readonly sendGridProvider: SendGridNotificationProvider,
  ) {}

  getActiveProvider(): NotificationProvider {
    const mode =
      this.configService
        .get<string>('NOTIFICATION_PROVIDER_MODE')
        ?.trim()
        .toLowerCase() || 'mock';
    const environment = this.configService
      .get<string>('NODE_ENV')
      ?.trim()
      .toLowerCase();
    const productionPreview =
      this.configService
        .get<string>('PRODUCTION_PREVIEW_MODE')
        ?.trim()
        .toLowerCase() === 'true';
    if (
      mode === 'mock' &&
      (environment !== 'production' || productionPreview)
    ) {
      return this.mockProvider;
    }
    if (mode === 'sendgrid') {
      this.sendGridProvider.assertConfigured();
      return this.sendGridProvider;
    }
    if (mode === 'mock') {
      throw new InternalServerErrorException(
        'NOTIFICATION_PROVIDER_MODE=mock is not allowed in production.',
      );
    }
    throw new InternalServerErrorException(
      'NOTIFICATION_PROVIDER_MODE must be mock or sendgrid.',
    );
  }

  getSendGridProvider() {
    return this.sendGridProvider;
  }
}
