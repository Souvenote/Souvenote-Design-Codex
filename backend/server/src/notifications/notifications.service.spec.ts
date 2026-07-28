import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { NotificationProviderRegistry } from './notification-provider.registry';
import {
  NotificationDeliveryError,
  type NotificationProvider,
} from './notification.provider';
import { NotificationsService } from './notifications.service';
import { SendGridNotificationProvider } from './sendgrid-notification.provider';

const notificationId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';

describe('NotificationsService', () => {
  const transactionQuery = jest.fn();
  const transaction = {
    query: transactionQuery,
  } as unknown as DatabaseTransaction;
  const query = jest.fn();
  const withTransaction = jest.fn(
    <T>(operation: (active: DatabaseTransaction) => Promise<T>) =>
      operation(transaction),
  );
  const databaseService = {
    query,
    withTransaction,
  } as unknown as DatabaseService;
  const send = jest.fn();
  const provider: NotificationProvider = { mode: 'mock', send };
  const verifyWebhook = jest.fn();
  const providerRegistry = {
    getActiveProvider: jest.fn(() => provider),
    getSendGridProvider: jest.fn(
      () => ({ verifyWebhook }) as unknown as SendGridNotificationProvider,
    ),
  } as unknown as NotificationProviderRegistry;
  const getConfig = jest.fn();
  const service = new NotificationsService(databaseService, providerRegistry, {
    get: getConfig,
  } as unknown as ConfigService);

  const outboxRow = {
    id: notificationId,
    user_id: 'user-a',
    order_id: orderId,
    event_type: 'order_confirmation',
    template_data: {
      orderId,
      orderStatus: 'paid',
      quantity: 1,
      amountCents: 999,
      currency: 'usd',
    },
    status: 'processing',
    delivery_status: 'pending',
    attempt_count: 1,
    recipient_email: 'owner@example.com',
  } as const;

  beforeEach(() => {
    transactionQuery.mockReset();
    query.mockReset().mockResolvedValue({ rows: [] });
    withTransaction.mockClear();
    send.mockReset();
    verifyWebhook.mockReset();
    getConfig.mockReset();
  });

  it('enqueues a bounded safe template once with a deterministic idempotency key', async () => {
    transactionQuery.mockResolvedValue({ rows: [] });

    await service.enqueueOrderNotification(transaction, {
      eventType: 'order_confirmation',
      userId: 'user-a',
      orderId,
      orderStatus: 'paid',
      quantity: 1,
      amountCents: 999,
      currency: 'usd',
    });

    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification_outbox'),
      [
        'user-a',
        orderId,
        'order_confirmation',
        JSON.stringify({
          orderId,
          orderStatus: 'paid',
          quantity: 1,
          amountCents: 999,
          currency: 'usd',
        }),
        `notification:${orderId}:order_confirmation:v1`,
      ],
    );
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (idempotency_key) DO NOTHING'),
      expect.any(Array),
    );
  });

  it('rejects a lifecycle/template mismatch before writing', async () => {
    await expect(
      service.enqueueOrderNotification(transaction, {
        eventType: 'order_shipped',
        userId: 'user-a',
        orderId,
        orderStatus: 'printing',
        quantity: 1,
        amountCents: 999,
        currency: 'usd',
      }),
    ).rejects.toThrow('cannot use order status');
    expect(transactionQuery).not.toHaveBeenCalled();
  });

  it('claims and marks an accepted provider dispatch', async () => {
    transactionQuery.mockResolvedValueOnce({ rows: [outboxRow] });
    send.mockResolvedValue({ providerMessageId: 'mock-message-id' });
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: notificationId }] });

    await expect(service.dispatchBatch(1)).resolves.toEqual({
      claimed: 1,
      accepted: 1,
      retried: 0,
      failed: 0,
      deliveryUnknown: 0,
    });

    expect(send).toHaveBeenCalledWith({
      notificationId,
      recipientEmail: 'owner@example.com',
      eventType: 'order_confirmation',
      templateData: outboxRow.template_data,
    });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'accepted'"),
      [notificationId, 'mock-message-id'],
    );
  });

  it('holds an ambiguous dispatch without automatic retry', async () => {
    transactionQuery.mockResolvedValueOnce({ rows: [outboxRow] });
    send.mockRejectedValue(
      new NotificationDeliveryError('sendgrid_outcome_unknown', false, true),
    );

    const result = await service.dispatchBatch(1);

    expect(result.deliveryUnknown).toBe(1);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'delivery_unknown'"),
      [notificationId, 'sendgrid_outcome_unknown'],
    );
  });

  it('holds provider acceptance when the local acceptance write cannot be proven', async () => {
    transactionQuery.mockResolvedValueOnce({ rows: [outboxRow] });
    send.mockResolvedValue({ providerMessageId: 'provider-message-id' });
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.dispatchBatch(1);

    expect(result.deliveryUnknown).toBe(1);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'delivery_unknown'"),
      [notificationId, 'provider_accepted_local_reconciliation_failed'],
    );
  });

  it('retries only an explicit transient provider rejection', async () => {
    transactionQuery.mockResolvedValueOnce({ rows: [outboxRow] });
    send.mockRejectedValue(
      new NotificationDeliveryError('sendgrid_http_503', true),
    );

    const result = await service.dispatchBatch(1);

    expect(result.retried).toBe(1);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('status = $2'),
      [notificationId, 'pending', 30, 'sendgrid_http_503'],
    );
  });

  it('processes only signed, correlated delivery events and deduplicates event IDs', async () => {
    const payload = Buffer.from(
      JSON.stringify([
        {
          sg_event_id: 'event_1',
          sg_message_id: 'message_1',
          event: 'delivered',
          timestamp: 1_784_731_200,
          souvenoteNotificationId: notificationId,
          email: 'must-not-be-persisted@example.com',
          reason: 'must-not-be-persisted',
        },
      ]),
    );
    verifyWebhook.mockReturnValue(true);
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ notification_id: notificationId }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.handleSendGridWebhook(payload, 'signature', '1784731200'),
    ).resolves.toEqual({
      received: true,
      processed: 1,
      duplicates: 0,
      ignored: 0,
    });

    const allSql = transactionQuery.mock.calls
      .map(([sql]) => String(sql))
      .join('\n');
    expect(allSql).not.toMatch(/email|reason|raw_payload|metadata JSON/i);
    expect(transactionQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO notification_delivery_events'),
      [
        'event_1',
        notificationId,
        'message_1',
        'delivered',
        new Date(1_784_731_200_000),
      ],
    );
  });

  it('treats a redelivered SendGrid event ID as an idempotent duplicate', async () => {
    const payload = Buffer.from(
      JSON.stringify([
        {
          sg_event_id: 'event_1',
          sg_message_id: 'message_1',
          event: 'processed',
          timestamp: 1_784_731_200,
          souvenoteNotificationId: notificationId,
        },
      ]),
    );
    verifyWebhook.mockReturnValue(true);
    transactionQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] });

    await expect(
      service.handleSendGridWebhook(payload, 'signature', '1784731200'),
    ).resolves.toEqual({
      received: true,
      processed: 0,
      duplicates: 1,
      ignored: 0,
    });
  });

  it('rejects an unsigned callback before parsing or writing', async () => {
    verifyWebhook.mockReturnValue(false);

    await expect(
      service.handleSendGridWebhook(
        Buffer.from('not-json'),
        'bad-signature',
        '1784731200',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
