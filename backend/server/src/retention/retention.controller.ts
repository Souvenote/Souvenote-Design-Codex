import { Controller, Get } from '@nestjs/common';
import { PublicRoute } from '../auth/public-route.decorator';
import { RetentionService } from './retention.service';

@Controller('retention-policy')
@PublicRoute()
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get()
  getRetentionPolicy() {
    return this.retentionService.getPolicy();
  }
}
