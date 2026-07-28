import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockNotificationProvider } from './mock-notification.provider';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsWorker } from './notifications.worker';
import {
  defaultSendGridFetch,
  SENDGRID_FETCH,
  SendGridNotificationProvider,
} from './sendgrid-notification.provider';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsWorker,
    NotificationProviderRegistry,
    MockNotificationProvider,
    SendGridNotificationProvider,
    {
      provide: SENDGRID_FETCH,
      inject: [ConfigService],
      useFactory: () => defaultSendGridFetch,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
