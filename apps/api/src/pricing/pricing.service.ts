import { Injectable } from '@nestjs/common';
import { PricingRepository } from './pricing.repository';

@Injectable()
export class PricingService {
  constructor(private readonly repository: PricingRepository) {}

  async findAll() {
    const [offers, creditPacks] = await Promise.all([
      this.repository.findActiveCanadaOffers(),
      this.repository.findActiveCanadaCreditPacks(),
    ]);
    return {
      data: offers.map((row) => PricingRepository.toApi(row)),
      creditPacks: creditPacks.map((row) => PricingRepository.creditPackToApi(row)),
    };
  }
}
