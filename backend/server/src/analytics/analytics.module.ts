import { Global, Module } from '@nestjs/common';
import { AnalyticsProviderRegistry } from './analytics-provider.registry';
import { AnalyticsService } from './analytics.service';
import { DisabledAnalyticsProvider } from './disabled-analytics.provider';
import { PostHogAnalyticsProvider } from './posthog-analytics.provider';

@Global()
@Module({
  providers: [
    AnalyticsService,
    AnalyticsProviderRegistry,
    DisabledAnalyticsProvider,
    PostHogAnalyticsProvider,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
