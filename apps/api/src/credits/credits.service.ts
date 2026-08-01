import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readString, runtimeEnvironment, type ConfigurationReader } from '../config/runtime-config';
import { CreditsRepository } from './credits.repository';

@Injectable()
export class CreditsService {
  constructor(
    private readonly repository: CreditsRepository,
    @Inject(ConfigService) private readonly configuration: ConfigurationReader,
  ) {}

  async findBalance(userId: string) {
    return { balance: await this.repository.findBalance(userId) };
  }

  async purchaseMock(userId: string, offerCode: string, idempotencyKey: string) {
    this.requireMockPaymentMode();
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ offerCode, provider: 'mock' }))
      .digest('hex');
    const result = await this.repository.purchaseMock(userId, offerCode, idempotencyKey, requestHash);
    return {
      purchase: CreditsRepository.purchaseToApi(result.purchase),
      balance: result.balance,
    };
  }

  async findPurchase(userId: string, purchaseId: string) {
    return {
      purchase: CreditsRepository.purchaseToApi(await this.repository.findPurchase(userId, purchaseId)),
    };
  }

  private requireMockPaymentMode(): void {
    const environment = runtimeEnvironment(this.configuration);
    const paymentMode = readString(this.configuration, 'PAYMENT_PROVIDER_MODE')?.toLowerCase();
    if (!['development', 'test'].includes(environment) || paymentMode !== 'mock') {
      throw new ConflictException({
        code: 'MOCK_PAYMENT_MODE_REQUIRED',
        message: 'Standalone credit-pack purchase is disabled until secure checkout is active.',
      });
    }
  }
}
