import { Injectable } from '@nestjs/common';
import type { AnalyticsCapture, AnalyticsProvider } from './analytics.provider';

@Injectable()
export class DisabledAnalyticsProvider implements AnalyticsProvider {
  readonly mode = 'disabled' as const;

  capture(event: AnalyticsCapture) {
    void event;
    // Deliberate no-op for local development and tests.
  }

  async shutdown() {
    // Nothing is buffered in disabled mode.
  }
}
