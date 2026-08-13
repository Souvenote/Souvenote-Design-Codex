import { ServiceUnavailableException } from '@nestjs/common';
import type { DatabaseHealthService } from '../database/database-health.service';
import type { WorkerRuntimeConfig } from '../runtime/runtime-config';
import { HealthController } from './health.controller';

const runtimeConfig: WorkerRuntimeConfig = {
  authMode: 'disabled',
  database: { connectionString: 'postgresql://souvenote:souvenote_local@127.0.0.1:55432/souvenote' },
  emailProviderMode: 'disabled',
  fulfillmentProviderMode: 'disabled',
  host: '127.0.0.1',
  imageProviderMode: 'mock',
  musicProviderMode: 'disabled',
  notificationProviderMode: 'disabled',
  paymentProviderMode: 'disabled',
  port: 4001,
  textProviderMode: 'mock',
  tryRiskFreeResolverEnabled: false,
  tryRiskFreeResolverIntervalMs: 60_000,
  workerMode: 'idle',
};

describe('HealthController', () => {
  it('reports liveness without querying PostgreSQL', () => {
    const ping = jest.fn<Promise<void>, []>();
    const controller = new HealthController({ ping } as unknown as DatabaseHealthService, runtimeConfig);

    expect(controller.getLive()).toEqual({
      mode: 'idle',
      service: 'souvenote-worker',
      status: 'ok',
    });
    expect(ping).not.toHaveBeenCalled();
  });

  it('reports readiness only after PostgreSQL responds', async () => {
    const ping = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const controller = new HealthController({ ping } as unknown as DatabaseHealthService, runtimeConfig);

    await expect(controller.getReady()).resolves.toEqual({
      database: 'connected',
      mode: 'idle',
      service: 'souvenote-worker',
      status: 'ok',
    });
  });

  it('returns a sanitized unavailable response when PostgreSQL fails', async () => {
    const ping = jest.fn<Promise<void>, []>().mockRejectedValue(new Error('secret'));
    const controller = new HealthController({ ping } as unknown as DatabaseHealthService, runtimeConfig);

    await expect(controller.getReady()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
