import { ConflictException } from '@nestjs/common';
import type { ConfigurationReader } from '../config/runtime-config';
import { CheckoutService } from './checkout.service';
import type { CheckoutRepository } from './checkout.repository';

describe('CheckoutService provider gate', () => {
  it('fails closed outside local/test mock mode before creating monetary state', async () => {
    const repository = { createPhysical: jest.fn() };
    const adapter = { create: jest.fn() };
    const configuration: ConfigurationReader = {
      get: (key) => ({ NODE_ENV: 'production', PAYMENT_PROVIDER_MODE: 'mock' })[key],
    };
    const service = new CheckoutService(repository as unknown as CheckoutRepository, adapter, configuration);

    await expect(
      service.startPhysical(
        '45000000-0000-4000-8000-000000000001',
        '45000000-0000-4000-8000-000000000002',
        'checkout-test-idempotency-key',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createPhysical).not.toHaveBeenCalled();
    expect(adapter.create).not.toHaveBeenCalled();
  });
});
