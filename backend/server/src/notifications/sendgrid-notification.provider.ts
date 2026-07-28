import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify } from 'node:crypto';
import { ProviderTelemetryService } from '../observability/provider-telemetry.service';
import {
  NotificationDeliveryError,
  type NotificationEventType,
  type NotificationProvider,
  type NotificationSendRequest,
} from './notification.provider';

export const SENDGRID_FETCH = Symbol('SENDGRID_FETCH');
export type SendGridFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
export const defaultSendGridFetch: SendGridFetch = (input, init) =>
  fetch(input, init);

const TEMPLATE_SETTINGS: Record<NotificationEventType, string> = {
  order_confirmation: 'SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID',
  order_shipped: 'SENDGRID_ORDER_SHIPPED_TEMPLATE_ID',
  order_delivered: 'SENDGRID_ORDER_DELIVERED_TEMPLATE_ID',
};

@Injectable()
export class SendGridNotificationProvider implements NotificationProvider {
  readonly mode = 'sendgrid' as const;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SENDGRID_FETCH) private readonly sendGridFetch: SendGridFetch,
    @Optional()
    private readonly providerTelemetry?: ProviderTelemetryService,
  ) {}

  assertConfigured() {
    for (const eventType of Object.keys(
      TEMPLATE_SETTINGS,
    ) as NotificationEventType[]) {
      this.configuration(eventType);
    }
    try {
      createPublicKey(this.webhookPublicKey());
    } catch {
      throw new InternalServerErrorException(
        'SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY is invalid.',
      );
    }
  }

  async send(request: NotificationSendRequest) {
    const configuration = this.configuration(request.eventType);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      configuration.timeoutMs,
    );

    try {
      const action = () =>
        this.sendGridFetch(`${configuration.baseUrl}/v3/mail/send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${configuration.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: request.recipientEmail }],
                dynamic_template_data: {
                  ...request.templateData,
                  ordersUrl: configuration.ordersUrl,
                },
                custom_args: {
                  souvenoteNotificationId: request.notificationId,
                },
              },
            ],
            from: {
              email: configuration.fromEmail,
              name: configuration.fromName,
            },
            template_id: configuration.templateId,
            categories: ['souvenote_transactional', request.eventType],
          }),
          signal: controller.signal,
        });
      const response = await (this.providerTelemetry
        ? this.providerTelemetry.measureHttp(
            'sendgrid',
            'notification_send',
            action,
          )
        : action());
      if (response.status === 202) {
        await response.body?.cancel();
        return {
          providerMessageId: response.headers.get('x-message-id'),
        };
      }
      await response.body?.cancel();
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;
      throw new NotificationDeliveryError(
        `sendgrid_http_${response.status}`,
        retryable,
      );
    } catch (error) {
      if (error instanceof NotificationDeliveryError) throw error;
      throw new NotificationDeliveryError(
        'sendgrid_outcome_unknown',
        false,
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  verifyWebhook(payload: Buffer, signature: string, timestamp: string) {
    if (
      !payload.length ||
      !/^\d{1,20}$/.test(timestamp) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)
    ) {
      return false;
    }
    const signatureBytes = Buffer.from(signature, 'base64');
    if (!signatureBytes.length) return false;
    try {
      return verify(
        'sha256',
        Buffer.concat([Buffer.from(timestamp, 'utf8'), payload]),
        createPublicKey(this.webhookPublicKey()),
        signatureBytes,
      );
    } catch {
      return false;
    }
  }

  private configuration(eventType: NotificationEventType) {
    const apiKey = this.required('SENDGRID_API_KEY');
    if (!apiKey.startsWith('SG.') || apiKey.length < 20) {
      throw new InternalServerErrorException(
        'SENDGRID_API_KEY is not a valid SendGrid API key.',
      );
    }
    const fromEmail = this.required('SENDGRID_FROM_EMAIL').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      throw new InternalServerErrorException(
        'SENDGRID_FROM_EMAIL must be a valid email address.',
      );
    }
    const fromName =
      this.configService.get<string>('SENDGRID_FROM_NAME')?.trim() ||
      'Souvenote';
    if (fromName.length > 100) {
      throw new InternalServerErrorException(
        'SENDGRID_FROM_NAME must be at most 100 characters.',
      );
    }
    const templateId = this.required(TEMPLATE_SETTINGS[eventType]);
    if (!/^d-[A-Za-z0-9_-]{10,100}$/.test(templateId)) {
      throw new InternalServerErrorException(
        `${TEMPLATE_SETTINGS[eventType]} must be a SendGrid dynamic template ID.`,
      );
    }
    const ordersUrl = this.required('NOTIFICATION_ORDERS_URL');
    let parsedOrdersUrl: URL;
    try {
      parsedOrdersUrl = new URL(ordersUrl);
    } catch {
      throw new InternalServerErrorException(
        'NOTIFICATION_ORDERS_URL must be a valid HTTPS URL.',
      );
    }
    if (
      parsedOrdersUrl.protocol !== 'https:' ||
      parsedOrdersUrl.username ||
      parsedOrdersUrl.password
    ) {
      throw new InternalServerErrorException(
        'NOTIFICATION_ORDERS_URL must be a credential-free HTTPS URL.',
      );
    }
    const baseUrl =
      this.configService.get<string>('SENDGRID_API_BASE_URL')?.trim() ||
      'https://api.sendgrid.com';
    if (
      !['https://api.sendgrid.com', 'https://api.eu.sendgrid.com'].includes(
        baseUrl,
      )
    ) {
      throw new InternalServerErrorException(
        'SENDGRID_API_BASE_URL must be an official SendGrid API endpoint.',
      );
    }
    return {
      apiKey,
      fromEmail,
      fromName,
      templateId,
      ordersUrl: parsedOrdersUrl.toString(),
      baseUrl,
      timeoutMs: this.integer(
        'SENDGRID_REQUEST_TIMEOUT_MS',
        10_000,
        1_000,
        30_000,
      ),
    };
  }

  private webhookPublicKey() {
    const configured = this.required(
      'SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY',
    ).replace(/\\n/g, '\n');
    if (configured.includes('BEGIN PUBLIC KEY')) return configured;
    if (!/^[A-Za-z0-9+/=]+$/.test(configured)) {
      throw new InternalServerErrorException(
        'SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY is invalid.',
      );
    }
    const lines = configured.match(/.{1,64}/g)?.join('\n') ?? configured;
    return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
  }

  private required(name: string) {
    const value = this.configService.get<string>(name)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`${name} is required.`);
    }
    return value;
  }

  private integer(
    name: string,
    defaultValue: number,
    minimum: number,
    maximum: number,
  ) {
    const configured = this.configService.get<string>(name);
    if (!configured) return defaultValue;
    if (!/^\d+$/.test(configured.trim())) {
      throw new InternalServerErrorException(`${name} must be an integer.`);
    }
    const value = Number(configured);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new InternalServerErrorException(
        `${name} must be between ${minimum} and ${maximum}.`,
      );
    }
    return value;
  }
}
