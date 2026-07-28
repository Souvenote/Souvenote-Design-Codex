import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, sign } from 'node:crypto';
import { NotificationDeliveryError } from './notification.provider';
import {
  type SendGridFetch,
  SendGridNotificationProvider,
} from './sendgrid-notification.provider';

describe('SendGridNotificationProvider', () => {
  const templateId = `d-${'a'.repeat(62)}`;
  const values: Record<string, string> = {
    SENDGRID_API_KEY: `SG.${'x'.repeat(40)}`,
    SENDGRID_FROM_EMAIL: 'hello@souvenote.example',
    SENDGRID_FROM_NAME: 'Souvenote',
    SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID: templateId,
    SENDGRID_ORDER_SHIPPED_TEMPLATE_ID: templateId,
    SENDGRID_ORDER_DELIVERED_TEMPLATE_ID: templateId,
    NOTIFICATION_ORDERS_URL: 'https://app.souvenote.example/my-cards',
  };
  const getConfig = jest.fn((key: string) => values[key]);
  const sendGridFetch = jest.fn<
    ReturnType<SendGridFetch>,
    Parameters<SendGridFetch>
  >();
  const provider = new SendGridNotificationProvider(
    { get: getConfig } as unknown as ConfigService,
    sendGridFetch,
  );

  beforeEach(() => {
    getConfig.mockClear();
    sendGridFetch.mockReset();
    values.SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID = templateId;
    values.SENDGRID_ORDER_SHIPPED_TEMPLATE_ID = templateId;
    values.SENDGRID_ORDER_DELIVERED_TEMPLATE_ID = templateId;
    delete values.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY;
  });

  const request = {
    notificationId: '11111111-1111-4111-8111-111111111111',
    recipientEmail: 'owner@example.com',
    eventType: 'order_confirmation' as const,
    templateData: {
      orderId: '22222222-2222-4222-8222-222222222222',
      orderStatus: 'paid',
      quantity: 1,
      amountCents: 999,
      currency: 'usd',
    },
  };

  it('sends a dynamic template with only the expected safe custom data', async () => {
    let capturedUrl: string | URL | Request | undefined;
    let capturedInit: RequestInit | undefined;
    sendGridFetch.mockImplementation(
      (input: string | URL | Request, init?: RequestInit) => {
        capturedUrl = input;
        capturedInit = init;
        return Promise.resolve(
          new Response(null, {
            status: 202,
            headers: { 'x-message-id': 'sendgrid-message-id' },
          }),
        );
      },
    );

    await expect(provider.send(request)).resolves.toEqual({
      providerMessageId: 'sendgrid-message-id',
    });

    expect(sendGridFetch).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(capturedInit?.headers).toMatchObject({
      Authorization: `Bearer ${values.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    });
    if (typeof capturedInit?.body !== 'string') {
      throw new Error('Expected a JSON string request body.');
    }
    const body = JSON.parse(capturedInit.body) as unknown;
    expect(body).toMatchObject({
      from: { email: 'hello@souvenote.example', name: 'Souvenote' },
      template_id: templateId,
      categories: ['souvenote_transactional', 'order_confirmation'],
      personalizations: [
        {
          to: [{ email: 'owner@example.com' }],
          custom_args: {
            souvenoteNotificationId: '11111111-1111-4111-8111-111111111111',
          },
          dynamic_template_data: {
            ...request.templateData,
            ordersUrl: 'https://app.souvenote.example/my-cards',
          },
        },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(
      /recipientAddress|cardContent|creativeBrief|storageKey|signedUrl/i,
    );
  });

  it('classifies explicit transient HTTP rejection as retryable', async () => {
    sendGridFetch.mockResolvedValue(new Response(null, { status: 503 }));

    await expect(provider.send(request)).rejects.toMatchObject({
      code: 'sendgrid_http_503',
      retryable: true,
      outcomeUnknown: false,
    } satisfies Partial<NotificationDeliveryError>);
  });

  it('holds ambiguous network outcomes instead of declaring them retryable', async () => {
    sendGridFetch.mockRejectedValue(new Error('private network detail'));

    await expect(provider.send(request)).rejects.toMatchObject({
      code: 'sendgrid_outcome_unknown',
      retryable: false,
      outcomeUnknown: true,
    } satisfies Partial<NotificationDeliveryError>);
  });

  it('verifies the signature over the raw timestamp plus payload bytes', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    values.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY = publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    const timestamp = '1784731200';
    const payload = Buffer.from('[{"event":"delivered"}]', 'utf8');
    const signature = sign(
      'sha256',
      Buffer.concat([Buffer.from(timestamp), payload]),
      privateKey,
    ).toString('base64');

    expect(provider.verifyWebhook(payload, signature, timestamp)).toBe(true);
    expect(
      provider.verifyWebhook(
        Buffer.from('[{"event":"dropped"}]'),
        signature,
        timestamp,
      ),
    ).toBe(false);
  });

  it('fails closed when a required dynamic template is missing', async () => {
    delete values.SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID;

    await expect(provider.send(request)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('validates all templates and the webhook public key before worker startup', () => {
    const { publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    values.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY = publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();

    expect(() => provider.assertConfigured()).not.toThrow();
  });
});
