import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { CreditsService } from './credits.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

export class MockCreditPurchaseDto {
  @IsInt()
  @Min(1)
  @Max(300)
  amount: number;

  @IsString()
  idempotencyKey: string;
}

@Controller('credits')
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('balance')
  async getBalance(@Req() request: AuthenticatedRequest) {
    return this.creditsService.findBalance(request.localUser.id);
  }

  @Get('purchases/:purchaseId')
  async getPurchase(
    @Req() request: AuthenticatedRequest,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.creditsService.findPurchase(request.localUser.id, purchaseId);
  }

  @Post('mock-purchase')
  async mockPurchase(
    @Req() request: AuthenticatedRequest,
    @Body() dto: MockCreditPurchaseDto,
  ) {
    const mockMode = this.configService.get<string>('AI_MOCK_MODE');
    if (mockMode?.toLowerCase() !== 'true') {
      throw new ForbiddenException(
        'Mock credit purchases are disabled outside local mock mode.',
      );
    }

    return this.creditsService.grantOnce(
      request.localUser.id,
      dto.amount,
      'mock_checkout_purchase',
      dto.idempotencyKey,
      'credit_purchase',
    );
  }
}
