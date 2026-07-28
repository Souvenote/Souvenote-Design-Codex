export type FunnelEventName =
  | 'account provisioned'
  | 'checkout started'
  | 'generation started'
  | 'generation approved'
  | 'order confirmed';

export type SafeAnalyticsValue = string | number | boolean;

export type AnalyticsCapture = {
  distinctId: string;
  eventId: string;
  event: FunnelEventName;
  properties: Record<string, SafeAnalyticsValue>;
};

export type AnalyticsProviderMode = 'disabled' | 'posthog';

export interface AnalyticsProvider {
  readonly mode: AnalyticsProviderMode;
  assertConfigured?(): void;
  capture(event: AnalyticsCapture): void;
  shutdown?(): Promise<void>;
}
