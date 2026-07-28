import { Injectable, Logger } from '@nestjs/common';
import { ErrorReportingService } from './error-reporting.service';

export type ProviderName =
  | 'fal'
  | 'posthog'
  | 's3'
  | 'scribeless'
  | 'sendgrid'
  | 'stripe';

export type ProviderOperation =
  | 'asset_download'
  | 'campaign_get'
  | 'checkout_session_create'
  | 'generation_cancel'
  | 'generation_result'
  | 'generation_status'
  | 'generation_submit'
  | 'notification_send'
  | 'payment_cancel'
  | 'payment_capture'
  | 'recipient_create'
  | 'recipient_get'
  | 's3_head'
  | 's3_put';

@Injectable()
export class ProviderTelemetryService {
  private readonly logger = new Logger(ProviderTelemetryService.name);

  constructor(private readonly errorReporting: ErrorReportingService) {}

  async measure<T>(
    provider: ProviderName,
    operation: ProviderOperation,
    action: () => Promise<T>,
  ): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await action();
      this.write(provider, operation, 'success', startedAt);
      return result;
    } catch (error) {
      const outcome = this.outcomeUnknown(error) ? 'unknown' : 'error';
      this.write(provider, operation, outcome, startedAt);
      this.errorReporting.reportException(
        'provider_call_failed',
        { provider, operation, outcome },
        error,
      );
      throw error;
    }
  }

  async measureHttp(
    provider: ProviderName,
    operation: ProviderOperation,
    action: () => Promise<Response>,
  ) {
    const startedAt = performance.now();
    try {
      const response = await action();
      if (response.ok) {
        this.write(provider, operation, 'success', startedAt);
      } else {
        this.write(provider, operation, 'error', startedAt);
        this.errorReporting.reportException('provider_http_rejection', {
          provider,
          operation,
          outcome: `http_${response.status}`,
        });
      }
      return response;
    } catch (error) {
      this.write(provider, operation, 'unknown', startedAt);
      this.errorReporting.reportException(
        'provider_call_failed',
        { provider, operation, outcome: 'unknown' },
        error,
      );
      throw error;
    }
  }

  private write(
    provider: ProviderName,
    operation: ProviderOperation,
    outcome: 'success' | 'error' | 'unknown',
    startedAt: number,
  ) {
    const event = {
      event: 'provider_call_metric',
      provider,
      operation,
      outcome,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
    if (outcome === 'success') this.logger.log(event);
    else this.logger.error(event);
  }

  private outcomeUnknown(error: unknown) {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'outcomeUnknown' in error &&
      (error as { outcomeUnknown?: unknown }).outcomeUnknown === true,
    );
  }
}
