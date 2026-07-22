import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Idempotent } from '../common/idempotent.decorator';
import { CheckoutService } from './checkout.service';

export class StartCheckoutDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId!: string;
}

@ApiTags('checkout')
@ApiBearerAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ operationId: 'startCheckout' })
  async start(@Req() request: AuthenticatedRequest, @Body() dto: StartCheckoutDto) {
    return this.checkoutService.start(request.user.id, dto.orderId, request.header('idempotency-key')!);
  }
}
