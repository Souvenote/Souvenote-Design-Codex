export type NotificationEventType =
  | 'order_confirmation'
  | 'order_shipped'
  | 'order_delivered';

export type NotificationProviderMode = 'mock' | 'sendgrid';

export type NotificationTemplateData = {
  orderId: string;
  orderStatus: string;
  quantity: number;
  amountCents: number;
  currency: string;
};

export type NotificationSendRequest = {
  notificationId: string;
  recipientEmail: string;
  eventType: NotificationEventType;
  templateData: NotificationTemplateData;
};

export type NotificationSendResult = {
  providerMessageId: string | null;
};

export class NotificationDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly outcomeUnknown = false,
  ) {
    super(code);
    this.name = 'NotificationDeliveryError';
  }
}

export interface NotificationProvider {
  readonly mode: NotificationProviderMode;
  send(request: NotificationSendRequest): Promise<NotificationSendResult>;
}
