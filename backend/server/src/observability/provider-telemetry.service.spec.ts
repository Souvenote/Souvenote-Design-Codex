import { ErrorReportingService } from './error-reporting.service';
import { ProviderTelemetryService } from './provider-telemetry.service';

describe('ProviderTelemetryService', () => {
  const reportException = jest.fn();
  const service = new ProviderTelemetryService({
    reportException,
  } as unknown as ErrorReportingService);

  beforeEach(() => {
    reportException.mockReset();
  });

  it('preserves a successful provider result without external error reporting', async () => {
    await expect(
      service.measure('stripe', 'payment_capture', () =>
        Promise.resolve('accepted'),
      ),
    ).resolves.toBe('accepted');
    expect(reportException).not.toHaveBeenCalled();
  });

  it('classifies ambiguous provider errors without forwarding payload context', async () => {
    const error = Object.assign(new Error('recipient@example.com'), {
      outcomeUnknown: true,
    });

    await expect(
      service.measure('sendgrid', 'notification_send', () =>
        Promise.reject(error),
      ),
    ).rejects.toBe(error);
    expect(reportException).toHaveBeenCalledWith(
      'provider_call_failed',
      {
        provider: 'sendgrid',
        operation: 'notification_send',
        outcome: 'unknown',
      },
      error,
    );
  });

  it('records an explicit HTTP rejection while returning it to provider logic', async () => {
    const response = new Response(null, { status: 503 });

    await expect(
      service.measureHttp('scribeless', 'recipient_create', () =>
        Promise.resolve(response),
      ),
    ).resolves.toBe(response);
    expect(reportException).toHaveBeenCalledWith('provider_http_rejection', {
      provider: 'scribeless',
      operation: 'recipient_create',
      outcome: 'http_503',
    });
  });
});
