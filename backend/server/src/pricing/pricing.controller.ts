import { Controller, Get } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PublicRoute } from '../auth/public-route.decorator';

@Controller('pricing')
@PublicRoute()
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  getPricingCatalog() {
    return this.pricingService.findAll();
  }
}
