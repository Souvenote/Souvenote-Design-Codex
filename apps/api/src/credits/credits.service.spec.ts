import { ConflictException } from '@nestjs/common';
import type { ConfigurationReader } from '../config/runtime-config';
import { CreditsRepository } from './credits.repository';
import { CreditsService } from './credits.service';

function configuration(values: Record<string, unknown>): ConfigurationReader {
  return {
    get(key: string) {
      return values[key];
    },
  };
}

function repository() {
  return {
    purchaseMock: jest.fn().mockResolvedValue({
      purchase: {
        id: '34000000-0000-4000-8000-000000000001',
        offer_code: 'credit_pack_10',
        provider: 'mock',
        status: 'captured',
        currency: 'CAD',
        amount_minor: 200,
        credit_quantity: 10,
        request_hash: 'a'.repeat(64),
        captured_at: new Date('2026-07-23T00:00:00.000Z'),
        created_at: new Date('2026-07-23T00:00:00.000Z'),
        updated_at: new Date('2026-07-23T00:00:00.000Z'),
      },
      balance: 12,
    }),
    findBalance: jest.fn(),
    findPurchase: jest.fn(),
  };
}

describe('CreditsService standalone pack boundary', () => {
  it('permits deterministic mock purchase only in development/test mock mode', async () => {
    const stub = repository();
    const service = new CreditsService(
      stub as unknown as CreditsRepository,
      configuration({ NODE_ENV: 'development', PAYMENT_PROVIDER_MODE: 'mock' }),
    );

    await expect(
      service.purchaseMock(
        '35000000-0000-4000-8000-000000000001',
        'credit_pack_10',
        'credit-pack-test-idempotency-key',
      ),
    ).resolves.toMatchObject({
      purchase: {
        offerCode: 'credit_pack_10',
        creditsGranted: 10,
        amountMinor: 200,
        mockMode: true,
        productionEnabled: false,
      },
      balance: 12,
    });
    expect(stub.purchaseMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: 'production', values: { NODE_ENV: 'production', PAYMENT_PROVIDER_MODE: 'mock' } },
    {
      label: 'disabled provider',
      values: { NODE_ENV: 'development', PAYMENT_PROVIDER_MODE: 'disabled' },
    },
  ])('fails closed for $label configuration', async ({ values }) => {
    const stub = repository();
    const service = new CreditsService(stub as unknown as CreditsRepository, configuration(values));

    await expect(
      service.purchaseMock(
        '35000000-0000-4000-8000-000000000001',
        'credit_pack_10',
        'credit-pack-test-idempotency-key',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(stub.purchaseMock).not.toHaveBeenCalled();
  });
});
