import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CreditsService } from './credits.service';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  CreditBalanceResponseDto,
  CreditPackPurchaseResponseDto,
  CreditPackPurchaseStartResponseDto,
} from '../common/api-response.dto';
import { Idempotent } from '../common/idempotent.decorator';

const CREDIT_PACK_CODES = ['credit_pack_10', 'credit_pack_80', 'credit_pack_250'] as const;

export class PurchaseCreditPackDto {
  @ApiProperty({ enum: CREDIT_PACK_CODES })
  @IsIn(CREDIT_PACK_CODES)
  offerCode!: (typeof CREDIT_PACK_CODES)[number];
}

@ApiTags('credits')
@ApiBearerAuth()
@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get()
  @ApiOperation({ operationId: 'getCreditBalance' })
  @ApiOkResponse({ type: CreditBalanceResponseDto })
  async getBalance(@Req() request: AuthenticatedRequest) {
    return this.creditsService.findBalance(request.user.id);
  }

  @Post('purchases/mock')
  @Idempotent()
  @ApiOperation({ operationId: 'purchaseMockCreditPack' })
  @ApiCreatedResponse({ type: CreditPackPurchaseStartResponseDto })
  purchaseMock(@Req() request: AuthenticatedRequest, @Body() dto: PurchaseCreditPackDto) {
    return this.creditsService.purchaseMock(request.user.id, dto.offerCode, request.header('idempotency-key')!);
  }

  @Get('purchases/:purchaseId')
  @ApiOperation({ operationId: 'getCreditPackPurchase' })
  @ApiOkResponse({ type: CreditPackPurchaseResponseDto })
  getPurchase(
    @Req() request: AuthenticatedRequest,
    @Param('purchaseId', new ParseUUIDPipe({ version: '4' })) purchaseId: string,
  ) {
    return this.creditsService.findPurchase(request.user.id, purchaseId);
  }
}
