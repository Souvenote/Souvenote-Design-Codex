import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutRepository } from './checkout.repository';
import { DeterministicHostedCheckoutAdapter } from './hosted-checkout.adapter';

@Module({
  controllers: [CheckoutController],
  providers: [CheckoutRepository, CheckoutService, DeterministicHostedCheckoutAdapter],
  exports: [CheckoutRepository],
})
export class CheckoutModule {}
