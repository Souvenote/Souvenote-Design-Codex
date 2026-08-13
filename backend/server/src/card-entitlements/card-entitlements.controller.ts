import { Controller, Get, Param, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CardEntitlementsService } from './card-entitlements.service';

@Controller('card-entitlements')
export class CardEntitlementsController {
  constructor(
    private readonly cardEntitlementsService: CardEntitlementsService,
  ) {}

  @Get('balance')
  async getBalance(@Req() request: AuthenticatedRequest) {
    return this.cardEntitlementsService.findBalance(request.localUser.id);
  }

  @Get('purchases/:purchaseId')
  async getPurchase(
    @Req() request: AuthenticatedRequest,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.cardEntitlementsService.findPurchase(
      request.localUser.id,
      purchaseId,
    );
  }
}
