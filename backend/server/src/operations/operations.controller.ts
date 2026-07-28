import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { OperationsEvidenceService } from './operations-evidence.service';
import { OperationsGuard } from './operations.guard';

class OperationsOrderParams {
  @IsUUID('4')
  orderId: string;
}

@Controller('operations')
@UseGuards(OperationsGuard)
export class OperationsController {
  constructor(
    private readonly operationsEvidenceService: OperationsEvidenceService,
  ) {}

  @Get('orders/:orderId/evidence')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Robots-Tag', 'noindex, noarchive')
  getOrderEvidence(@Param() params: OperationsOrderParams) {
    return this.operationsEvidenceService.getOrderEvidence(params.orderId);
  }
}
