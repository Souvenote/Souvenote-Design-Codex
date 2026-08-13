import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardEntitlementsModule } from '../card-entitlements/card-entitlements.module';
import { OrdersModule } from '../orders/orders.module';
import { UploadModule } from '../uploads/upload.module';
import { PublicCardLinksModule } from '../public-card-links/public-card-links.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentProviderRegistry } from './fulfillment-provider.registry';
import { FulfillmentService } from './fulfillment.service';
import { MockFulfillmentProvider } from './mock-fulfillment.provider';
import {
  defaultScribelessFetch,
  SCRIBELESS_FETCH,
  ScribelessFulfillmentProvider,
} from './scribeless-fulfillment.provider';

@Module({
  imports: [
    OrdersModule,
    UploadModule,
    PublicCardLinksModule,
    NotificationsModule,
    CardEntitlementsModule,
    ReferralsModule,
  ],
  controllers: [FulfillmentController],
  providers: [
    FulfillmentService,
    FulfillmentProviderRegistry,
    MockFulfillmentProvider,
    ScribelessFulfillmentProvider,
    {
      provide: SCRIBELESS_FETCH,
      inject: [ConfigService],
      useFactory: () => defaultScribelessFetch,
    },
  ],
})
export class FulfillmentModule {}
