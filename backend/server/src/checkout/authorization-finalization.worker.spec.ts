import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthorizationFinalizationWorker } from './authorization-finalization.worker';
import { CheckoutProviderRegistry } from './checkout-provider.registry';
import { CheckoutService } from './checkout.service';

describe('AuthorizationFinalizationWorker', () => {
  const finalizeDueAuthorizations = jest.fn();
  const getActiveProvider = jest.fn();
  const get = jest.fn();
  const worker = new AuthorizationFinalizationWorker(
    { finalizeDueAuthorizations } as unknown as CheckoutService,
    { getActiveProvider } as unknown as CheckoutProviderRegistry,
    { get } as unknown as ConfigService,
  );
  const runnable = worker as unknown as {
    tick: () => Promise<void>;
  };

  beforeEach(() => {
    finalizeDueAuthorizations.mockReset().mockResolvedValue({
      claimed: 0,
      finalized: 0,
      failed: 0,
    });
    getActiveProvider.mockReset().mockReturnValue({ mode: 'stripe' });
    get.mockReset();
  });

  afterEach(() => {
    worker.onApplicationShutdown();
  });

  it('runs a bounded authorization batch', async () => {
    get.mockImplementation((key: string) =>
      key === 'AUTHORIZATION_WORKER_BATCH_SIZE' ? '25' : undefined,
    );

    await runnable.tick();

    expect(finalizeDueAuthorizations).toHaveBeenCalledWith(25);
  });

  it('fails closed when enabled with a non-Stripe checkout provider', () => {
    get.mockImplementation((key: string) =>
      key === 'AUTHORIZATION_WORKER_ENABLED' ? 'true' : undefined,
    );
    getActiveProvider.mockReturnValue({ mode: 'mock' });

    expect(() => worker.onApplicationBootstrap()).toThrow(
      InternalServerErrorException,
    );
    expect(finalizeDueAuthorizations).not.toHaveBeenCalled();
  });
});
