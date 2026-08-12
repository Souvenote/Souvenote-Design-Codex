import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readString, runtimeEnvironment, type ConfigurationReader } from '../config/runtime-config';
import { PricingRepository } from './pricing.repository';

@Injectable()
export class PricingService {
  constructor(
    private readonly repository: PricingRepository,
    @Inject(ConfigService) private readonly configuration: ConfigurationReader,
  ) {}

  async findAll() {
    const [offers, creditPacks] = await Promise.all([
      this.repository.findActiveCanadaOffers(),
      this.repository.findActiveCanadaCreditPacks(),
    ]);
    return {
      data: offers.map((row) => ({
        ...PricingRepository.toApi(row),
        checkoutEnabled: row.checkout_enabled && this.checkoutAvailable(),
      })),
      creditPacks: creditPacks.map((row) => ({
        ...PricingRepository.creditPackToApi(row),
        checkoutEnabled: row.checkout_enabled && this.checkoutAvailable(),
      })),
    };
  }

  private checkoutAvailable(): boolean {
    const environment = runtimeEnvironment(this.configuration);
    return (
      ['development', 'test'].includes(environment) &&
      readString(this.configuration, 'PAYMENT_PROVIDER_MODE')?.toLowerCase() === 'mock'
    );
  }
}
