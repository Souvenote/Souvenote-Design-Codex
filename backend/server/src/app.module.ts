import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PricingModule } from './pricing/pricing.module';
import { DatabaseModule } from './database/database.module';
import { CreditsModule } from './credits/credits.module';
import { GenerationModule } from './generation/generation.module';
import { CardDraftsModule } from './card-drafts/card-drafts.module';
import { AssetModule } from './assets/assets.module';
import { CheckoutModule } from './checkout/checkout.module';
import { FulfillmentModule } from './fulfillment/fulfillment.module';
import { OrdersModule } from './orders/orders.module';
import { UploadModule } from './uploads/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    HealthModule,
    PricingModule,
    CreditsModule,
    GenerationModule,
    CardDraftsModule,
    AssetModule,
    UploadModule,
    OrdersModule,
    CheckoutModule,
    FulfillmentModule,
  ],
})
export class AppModule {}
