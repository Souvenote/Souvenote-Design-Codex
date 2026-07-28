import * as Sentry from '@sentry/node';

export const SENTRY_ADAPTER = Symbol('SENTRY_ADAPTER');

export type SentryAdapter = {
  init(options: Sentry.NodeOptions): void;
  withScope(callback: (scope: Sentry.Scope) => void): void;
  close(timeout: number): Promise<boolean>;
};

export const defaultSentryAdapter: SentryAdapter = {
  init(options) {
    Sentry.initWithoutDefaultIntegrations(options);
  },
  withScope(callback) {
    Sentry.withScope(callback);
  },
  close(timeout) {
    return Sentry.close(timeout);
  },
};
