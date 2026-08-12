import { ConflictException, Injectable } from '@nestjs/common';
import { CreditsRepository } from './credits.repository';

@Injectable()
export class CreditsService {
  constructor(private readonly repository: CreditsRepository) {}

  async findBalance(userId: string) {
    return { balance: await this.repository.findBalance(userId) };
  }

  purchaseMock(userId: string, offerCode: string, idempotencyKey: string): Promise<never> {
    void userId;
    void offerCode;
    void idempotencyKey;
    return Promise.reject(
      new ConflictException({
        code: 'CREDIT_PACK_HOSTED_CHECKOUT_REQUIRED',
        message: 'Start credit-pack collection through /checkout/credit-packs.',
      }),
    );
  }

  async findPurchase(userId: string, purchaseId: string) {
    return {
      purchase: CreditsRepository.purchaseToApi(await this.repository.findPurchase(userId, purchaseId)),
    };
  }
}
