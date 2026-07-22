import { Controller, Get } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { Public } from '../common/public.decorator';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PricingCatalogResponseDto } from '../common/api-response.dto';

@ApiTags('pricing')
@Public()
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  @ApiOperation({ operationId: 'getPricingCatalog' })
  @ApiOkResponse({ type: PricingCatalogResponseDto })
  getPricingCatalog() {
    return this.pricingService.findAll();
  }
}
