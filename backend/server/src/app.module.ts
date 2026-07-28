import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { AuthModule } from './auth/auth.module';
import { CognitoAuthGuard } from './auth/cognito-auth.guard';
import { ModerationModule } from './moderation/moderation.module';
import { PublicCardLinksModule } from './public-card-links/public-card-links.module';
import { ObservabilityModule } from './observability/observability.module';
import { OperationsModule } from './operations/operations.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RetentionModule } from './retention/retention.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AnalyticsModule,
    ObservabilityModule,
    DatabaseModule,
    HealthModule,
    PricingModule,
    CreditsModule,
    GenerationModule,
    CardDraftsModule,
    AssetModule,
    UploadModule,
    AuthModule,
    OrdersModule,
    CheckoutModule,
    FulfillmentModule,
    ModerationModule,
    PublicCardLinksModule,
    RetentionModule,
    OperationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: CognitoAuthGuard,
    },
  ],
})
export class AppModule {}
