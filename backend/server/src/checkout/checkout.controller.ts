import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  IsInt,
  MaxLength,
} from 'class-validator';
import type { Request } from 'express';
import { CheckoutService } from './checkout.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PublicRoute } from '../auth/public-route.decorator';

export class StartCheckoutDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;
}

export class MockCheckoutSuccessDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsString()
  checkoutSessionId?: string;
}

export class FinalizeAuthorizationDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsIn(['send', 'not_send'])
  action: 'send' | 'not_send';
}

export class StartCreditPackCheckoutDto {
  @IsString()
  @IsNotEmpty()
  offerCode: string;

  @IsString()
  @Length(8, 255)
  idempotencyKey: string;
}

export class MockCreditPackSuccessDto {
  @IsString()
  @IsNotEmpty()
  purchaseId: string;

  @IsOptional()
  @IsString()
  checkoutSessionId?: string;
}

export class StartCardPackCheckoutDto {
  @IsString()
  @IsNotEmpty()
  offerCode: string;

  @IsInt()
  @Min(1)
  @Max(30)
  quantity: number;

  @IsString()
  @Length(8, 255)
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  recipientContact?: string;

  @IsOptional()
  @IsIn(['email', 'text'])
  deliveryMethod?: 'email' | 'text';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  personalMessage?: string;
}

export class MockCardPackSuccessDto {
  @IsString()
  @IsNotEmpty()
  purchaseId: string;

  @IsOptional()
  @IsString()
  checkoutSessionId?: string;
}

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('start')
  async startCheckout(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StartCheckoutDto,
  ) {
    return this.checkoutService.startCheckout(request.localUser.id, dto);
  }

  @Post('credit-packs/start')
  async startCreditPackCheckout(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StartCreditPackCheckoutDto,
  ) {
    return this.checkoutService.startCreditPackCheckout(
      request.localUser.id,
      dto,
    );
  }

  @Post('credit-packs/mock-success')
  async simulateCreditPackCheckoutSuccess(
    @Req() request: AuthenticatedRequest,
    @Body() dto: MockCreditPackSuccessDto,
  ) {
    return this.checkoutService.simulateCreditPackCheckoutSuccess(
      request.localUser.id,
      dto,
    );
  }

  @Post('card-packs/start')
  async startCardPackCheckout(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StartCardPackCheckoutDto,
  ) {
    return this.checkoutService.startCardPackCheckout(
      request.localUser.id,
      dto,
    );
  }

  @Post('card-packs/mock-success')
  async simulateCardPackCheckoutSuccess(
    @Req() request: AuthenticatedRequest,
    @Body() dto: MockCardPackSuccessDto,
  ) {
    return this.checkoutService.simulateCardPackCheckoutSuccess(
      request.localUser.id,
      dto,
    );
  }

  @Post('mock-success')
  async simulateCheckoutSuccess(
    @Req() request: AuthenticatedRequest,
    @Body() dto: MockCheckoutSuccessDto,
  ) {
    return this.checkoutService.simulateCheckoutSuccess(
      request.localUser.id,
      dto,
    );
  }

  @Post('authorization/finalize')
  async finalizeAuthorization(
    @Req() request: AuthenticatedRequest,
    @Body() dto: FinalizeAuthorizationDto,
  ) {
    return this.checkoutService.finalizeAuthorization(
      request.localUser.id,
      dto,
    );
  }

  @PublicRoute()
  @Post('stripe/webhook')
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.checkoutService.handleStripeWebhook(
      request.rawBody ?? Buffer.alloc(0),
      signature ?? '',
    );
  }
}
