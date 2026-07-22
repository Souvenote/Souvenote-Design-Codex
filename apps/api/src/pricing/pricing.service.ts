import { Injectable } from '@nestjs/common';
import { PricingRepository } from './pricing.repository';

@Injectable()
export class PricingService {
  constructor(private readonly repository: PricingRepository) {}

  async findAll() {
    return { data: (await this.repository.findActiveCanadaOffers()).map((row) => PricingRepository.toApi(row)) };
  }
}
