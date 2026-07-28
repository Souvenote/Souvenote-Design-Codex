import { Injectable } from '@nestjs/common';
import type {
  NotificationProvider,
  NotificationSendRequest,
} from './notification.provider';

@Injectable()
export class MockNotificationProvider implements NotificationProvider {
  readonly mode = 'mock' as const;

  async send(request: NotificationSendRequest) {
    await Promise.resolve();
    return {
      providerMessageId: `mock_notification_${request.notificationId}`,
    };
  }
}
