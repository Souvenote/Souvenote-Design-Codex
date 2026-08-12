import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Idempotent } from '../common/idempotent.decorator';
import { CheckoutSessionResponseDto } from '../common/api-response.dto';
import { CheckoutService } from './checkout.service';

const CREDIT_PACK_CODES = ['credit_pack_10', 'credit_pack_80', 'credit_pack_250'] as const;

export class StartCheckoutDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId!: string;
}

export class StartCreditPackCheckoutDto {
  @ApiProperty({ enum: CREDIT_PACK_CODES })
  @IsIn(CREDIT_PACK_CODES)
  offerCode!: (typeof CREDIT_PACK_CODES)[number];
}

export class CompleteMockCheckoutDto {
  @ApiProperty({ enum: ['succeeded', 'failed'] })
  @IsIn(['succeeded', 'failed'])
  outcome!: 'succeeded' | 'failed';
}

@ApiTags('checkout')
@ApiBearerAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ operationId: 'startCheckout' })
  @ApiCreatedResponse({ type: CheckoutSessionResponseDto })
  startPhysical(@Req() request: AuthenticatedRequest, @Body() dto: StartCheckoutDto) {
    return this.checkoutService.startPhysical(request.user.id, dto.orderId, request.header('idempotency-key')!);
  }

  @Post('credit-packs')
  @Idempotent()
  @ApiOperation({ operationId: 'startCreditPackCheckout' })
  @ApiCreatedResponse({ type: CheckoutSessionResponseDto })
  startCreditPack(@Req() request: AuthenticatedRequest, @Body() dto: StartCreditPackCheckoutDto) {
    return this.checkoutService.startCreditPack(request.user.id, dto.offerCode, request.header('idempotency-key')!);
  }

  @Get(':sessionId')
  @ApiOperation({ operationId: 'getCheckoutSession' })
  @ApiOkResponse({ type: CheckoutSessionResponseDto })
  get(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
  ) {
    return this.checkoutService.get(request.user.id, sessionId);
  }

  @Post(':sessionId/mock-complete')
  @Idempotent()
  @ApiOperation({
    operationId: 'completeMockCheckout',
    description: 'Local/test provider simulator. Accepts no payment-card fields.',
  })
  @ApiCreatedResponse({ type: CheckoutSessionResponseDto })
  completeMock(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() dto: CompleteMockCheckoutDto,
  ) {
    return this.checkoutService.completeMock(request.user.id, sessionId, dto.outcome);
  }
}
