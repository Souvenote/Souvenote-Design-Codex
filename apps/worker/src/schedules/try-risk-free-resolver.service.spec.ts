import type { WorkerRuntimeConfig } from '../runtime/runtime-config';
import { TryRiskFreeResolverService } from './try-risk-free-resolver.service';
import type { TryRiskFreeResolverRepository } from './try-risk-free-resolver.repository';

const config: WorkerRuntimeConfig = {
  authMode: 'disabled',
  databaseUrl: 'postgresql://test:test@127.0.0.1:5432/test',
  emailProviderMode: 'disabled',
  fulfillmentProviderMode: 'disabled',
  host: '127.0.0.1',
  imageProviderMode: 'disabled',
  musicProviderMode: 'disabled',
  notificationProviderMode: 'disabled',
  paymentProviderMode: 'mock',
  port: 4001,
  textProviderMode: 'disabled',
  tryRiskFreeResolverEnabled: true,
  tryRiskFreeResolverIntervalMs: 60_000,
  workerMode: 'schedules',
};

describe('TryRiskFreeResolverService', () => {
  it('runs the database-owned exactly-once resolver and sanitizes failures', async () => {
    const resolveDue = jest.fn<Promise<number>, []>().mockResolvedValueOnce(2);
    const service = new TryRiskFreeResolverService({ resolveDue } as unknown as TryRiskFreeResolverRepository, config);
    await expect(service.runOnce()).resolves.toBe(2);
    resolveDue.mockRejectedValueOnce(new Error('credential secret'));
    await expect(service.runOnce()).resolves.toBe(0);
  });
});
