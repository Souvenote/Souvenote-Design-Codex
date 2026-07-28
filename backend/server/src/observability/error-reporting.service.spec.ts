import type { ErrorEvent, NodeOptions, Scope } from '@sentry/node';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorReportingService,
  scrubSentryEvent,
} from './error-reporting.service';
import type { SentryAdapter } from './sentry.adapter';

describe('ErrorReportingService', () => {
  const values: Record<string, string> = {
    ERROR_REPORTING_MODE: 'sentry',
    SENTRY_DSN: 'https://publickey@o123.ingest.sentry.io/456',
    NODE_ENV: 'test',
  };
  const getConfig = jest.fn((key: string) => values[key]);
  const setTags = jest.fn();
  const setFingerprint = jest.fn();
  const setLevel = jest.fn();
  const captureException = jest.fn<void, [unknown]>();
  const captureMessage = jest.fn();
  const scope = {
    setTags,
    setFingerprint,
    setLevel,
    captureException,
    captureMessage,
  } as unknown as Scope;
  let initializedOptions: NodeOptions | undefined;
  const init = jest.fn((options: NodeOptions) => {
    initializedOptions = options;
  });
  const withScope = jest.fn((callback: (active: Scope) => void) =>
    callback(scope),
  );
  const close = jest.fn(() => Promise.resolve(true));
  const adapter: SentryAdapter = {
    init,
    withScope,
    close,
  };

  beforeEach(() => {
    values.ERROR_REPORTING_MODE = 'sentry';
    values.SENTRY_DSN = 'https://publickey@o123.ingest.sentry.io/456';
    values.NODE_ENV = 'test';
    delete values.PRODUCTION_PREVIEW_MODE;
    initializedOptions = undefined;
    for (const mock of [
      getConfig,
      setTags,
      setFingerprint,
      setLevel,
      captureException,
      captureMessage,
      init,
      withScope,
      close,
    ]) {
      mock.mockClear();
    }
  });

  it('initializes manual Sentry reporting with default PII disabled', () => {
    const service = new ErrorReportingService(
      { get: getConfig } as unknown as ConfigService,
      adapter,
    );

    service.onModuleInit();

    expect(initializedOptions).toMatchObject({
      dsn: values.SENTRY_DSN,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    const event = {
      request: { url: '/orders/private?email=person@example.com' },
      user: { email: 'person@example.com' },
      contexts: { private: { cardText: 'secret' } },
      extra: { address: 'private' },
      breadcrumbs: [{ message: 'private' }],
      modules: { private: '1' },
      transaction: '/orders/private-id',
      tags: { safe: 'yes' },
    } as unknown as ErrorEvent;
    expect(scrubSentryEvent(event)).toEqual({ tags: { safe: 'yes' } });
  });

  it('reports a synthetic error without forwarding the raw message', () => {
    const service = new ErrorReportingService(
      { get: getConfig } as unknown as ConfigService,
      adapter,
    );
    const original = new Error(
      'recipient@example.com lives at 123 Private Street',
    );
    original.stack =
      'Error: recipient@example.com\n    at C:\\Users\\private-name\\app\\file.ts:1:1';

    service.reportException(
      'provider_call_failed',
      {
        provider: 'stripe',
        operation: 'payment_capture',
        outcome: 'unknown',
      },
      original,
    );

    const captured = captureException.mock.calls[0][0] as Error;
    expect(captured.message).toBe('provider_call_failed');
    expect(captured.stack).not.toMatch(
      /recipient@example.com|Private Street|private-name/,
    );
    expect(setTags).toHaveBeenCalledWith({
      provider: 'stripe',
      operation: 'payment_capture',
      outcome: 'unknown',
    });
  });

  it('fails production startup when the Sentry DSN is missing', () => {
    delete values.ERROR_REPORTING_MODE;
    delete values.SENTRY_DSN;
    values.NODE_ENV = 'production';
    const service = new ErrorReportingService(
      { get: getConfig } as unknown as ConfigService,
      adapter,
    );

    expect(() => service.onModuleInit()).toThrow(InternalServerErrorException);
  });

  it('allows disabled error reporting for an explicit production preview', () => {
    values.ERROR_REPORTING_MODE = 'disabled';
    delete values.SENTRY_DSN;
    values.NODE_ENV = 'production';
    values.PRODUCTION_PREVIEW_MODE = 'true';
    const service = new ErrorReportingService(
      { get: getConfig } as unknown as ConfigService,
      adapter,
    );

    expect(() => service.onModuleInit()).not.toThrow();
    expect(init).not.toHaveBeenCalled();
  });
});
