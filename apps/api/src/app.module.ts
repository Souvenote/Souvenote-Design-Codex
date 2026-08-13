import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { CardEntitlementsModule } from './card-entitlements/card-entitlements.module';
import { PublicCardsModule } from './public-cards/public-cards.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CognitoAuthGuard } from './auth/cognito-auth.guard';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { CsrfBoundaryGuard } from './common/csrf-boundary.guard';
import { IdempotencyGuard } from './common/idempotency.guard';
import { RateLimitGuard } from './common/rate-limit.guard';
import { RedactedRequestInterceptor } from './common/redacted-request.interceptor';
import { StorageModule } from './storage/storage.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    StorageModule,
    HealthModule,
    CapabilitiesModule,
    PricingModule,
    CreditsModule,
    CardEntitlementsModule,
    GenerationModule,
    CardDraftsModule,
    AssetModule,
    UploadModule,
    AuthModule,
    OrdersModule,
    CheckoutModule,
    FulfillmentModule,
    PublicCardsModule,
    WebhooksModule,
  ],
  providers: [
    { provide: APP_GUARD, useExisting: CognitoAuthGuard },
    { provide: APP_GUARD, useClass: CsrfBoundaryGuard },
    { provide: APP_GUARD, useClass: IdempotencyGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RedactedRequestInterceptor },
  ],
})
export class AppModule {}
