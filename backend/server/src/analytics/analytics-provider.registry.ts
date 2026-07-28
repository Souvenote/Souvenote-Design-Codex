import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DisabledAnalyticsProvider } from './disabled-analytics.provider';
import { PostHogAnalyticsProvider } from './posthog-analytics.provider';

@Injectable()
export class AnalyticsProviderRegistry {
  constructor(
    private readonly configService: ConfigService,
    private readonly disabledProvider: DisabledAnalyticsProvider,
    private readonly postHogProvider: PostHogAnalyticsProvider,
  ) {}

  getActiveProvider() {
    const environment = (
      this.configService.get<string>('NODE_ENV') ?? 'development'
    )
      .trim()
      .toLowerCase();
    const configured = this.configService
      .get<string>('ANALYTICS_PROVIDER_MODE')
      ?.trim()
      .toLowerCase();
    const productionPreview =
      this.configService
        .get<string>('PRODUCTION_PREVIEW_MODE')
        ?.trim()
        .toLowerCase() === 'true';
    const mode =
      configured || (environment === 'production' ? 'posthog' : 'disabled');

    if (
      environment === 'production' &&
      !productionPreview &&
      mode !== 'posthog'
    ) {
      throw new InternalServerErrorException(
        'Production analytics must use ANALYTICS_PROVIDER_MODE=posthog.',
      );
    }
    if (mode === 'disabled') return this.disabledProvider;
    if (mode === 'posthog') {
      this.postHogProvider.assertConfigured();
      return this.postHogProvider;
    }
    throw new InternalServerErrorException(
      'ANALYTICS_PROVIDER_MODE must be disabled or posthog.',
    );
  }
}
