import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { ConfigService } from '@nestjs/config';
import { CheckoutProviderRegistry } from './checkout-provider.registry';
import { MockCheckoutProvider } from './mock-checkout.provider';
import {
  createStripeClient,
  STRIPE_CLIENT,
  StripeCheckoutProvider,
} from './stripe-checkout.provider';
import { AuthorizationFinalizationWorker } from './authorization-finalization.worker';

@Module({
  imports: [OrdersModule, NotificationsModule, CreditsModule, PricingModule],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    CheckoutProviderRegistry,
    MockCheckoutProvider,
    StripeCheckoutProvider,
    AuthorizationFinalizationWorker,
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: createStripeClient,
    },
  ],
  exports: [CheckoutService],
})
export class CheckoutModule {}
