import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CheckoutService } from './checkout.service';

export class StartCheckoutDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

export class MockCheckoutSuccessDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsString()
  checkoutSessionId?: string;
}

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('start')
  async startCheckout(@Body() dto: StartCheckoutDto) {
    return this.checkoutService.startCheckout(dto);
  }

  @Post('mock-success')
  async simulateCheckoutSuccess(@Body() dto: MockCheckoutSuccessDto) {
    return this.checkoutService.simulateCheckoutSuccess(dto);
  }
}
