import { ConflictException } from '@nestjs/common';
import { CreditsRepository } from './credits.repository';
import { CreditsService } from './credits.service';

describe('CreditsService hosted-checkout boundary', () => {
  it('rejects the retired immediate-capture endpoint without touching the repository', async () => {
    const repository = {
      purchaseMock: jest.fn(),
      findBalance: jest.fn(),
      findPurchase: jest.fn(),
    };
    const service = new CreditsService(repository as unknown as CreditsRepository);

    const error: unknown = await service
      .purchaseMock('35000000-0000-4000-8000-000000000001', 'credit_pack_10', 'credit-pack-test-idempotency-key')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictException);
    if (!(error instanceof ConflictException)) throw error;
    expect(error.getResponse()).toMatchObject({
      code: 'CREDIT_PACK_HOSTED_CHECKOUT_REQUIRED',
    });
    expect(repository.purchaseMock).not.toHaveBeenCalled();
  });
});
