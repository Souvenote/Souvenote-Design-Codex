import {
  Global,
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorReportingInterceptor } from './error-reporting.interceptor';
import { ErrorReportingService } from './error-reporting.service';
import { HttpLoggingMiddleware } from './http-logging.middleware';
import { OperationalAlertsService } from './operational-alerts.service';
import { OperationalAlertsWorker } from './operational-alerts.worker';
import { ProviderTelemetryService } from './provider-telemetry.service';
import { RequestIdMiddleware } from './request-id.middleware';
import { defaultSentryAdapter, SENTRY_ADAPTER } from './sentry.adapter';

@Global()
@Module({
  providers: [
    ErrorReportingService,
    ProviderTelemetryService,
    OperationalAlertsService,
    OperationalAlertsWorker,
    {
      provide: SENTRY_ADAPTER,
      useValue: defaultSentryAdapter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorReportingInterceptor,
    },
  ],
  exports: [ErrorReportingService, ProviderTelemetryService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, HttpLoggingMiddleware).forRoutes({
      path: '{*splat}',
      method: RequestMethod.ALL,
    });
  }
}
