import { Controller, Get } from '@nestjs/common';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  getPricingCatalog() {
    return this.pricingService.findAll();
  }
}