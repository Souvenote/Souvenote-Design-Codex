import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { QueryResultRow } from 'pg';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';
import { NotificationProviderRegistry } from './notification-provider.registry';
import {
  NotificationDeliveryError,
  type NotificationEventType,
  type NotificationProviderMode,
  type NotificationTemplateData,
} from './notification.provider';

type EnqueueOrderNotification = {
  eventType: NotificationEventType;
  userId: string;
  orderId: string;
  orderStatus: string;
  quantity: number;
  amountCents: number;
  currency: string;
};

type OutboxRow = QueryResultRow & {
  id: string;
  user_id: string;
  order_id: string;
  event_type: NotificationEventType;
  template_data: Record<string, unknown>;
  status: string;
  delivery_status: string;
  attempt_count: number;
  recipient_email: string;
};

type SendGridEvent = {
  sg_event_id?: unknown;
  sg_message_id?: unknown;
  event?: unknown;
  timestamp?: unknown;
  souvenoteNotificationId?: unknown;
};

type DeliveryStatus =
  | 'processed'
  | 'deferred'
  | 'delivered'
  | 'bounced'
  | 'dropped';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly providerRegistry: NotificationProviderRegistry,
    private readonly configService: ConfigService,
  ) {}

  async enqueueOrderNotification(
    transaction: DatabaseTransaction,
    notification: EnqueueOrderNotification,
  ) {
    const templateData = this.enqueueTemplateData(notification);
    await transaction.query(
      `
        INSERT INTO notification_outbox (
          user_id,
          order_id,
          event_type,
          template_data,
          idempotency_key
        )
        VALUES ($1, $2, $3, $4::jsonb, $5)
        ON CONFLICT (idempotency_key) DO NOTHING;
      `,
      [
        notification.userId,
        notification.orderId,
        notification.eventType,
        JSON.stringify(templateData),
        `notification:${notification.orderId}:${notification.eventType}:v1`,
      ],
    );
  }

  async dispatchBatch(limit = 20) {
    const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    const provider = this.providerRegistry.getActiveProvider();
    await this.markStaleClaimsUnknown();
    const result = {
      claimed: 0,
      accepted: 0,
      retried: 0,
      failed: 0,
      deliveryUnknown: 0,
    };

    for (let index = 0; index < boundedLimit; index += 1) {
      const notification = await this.claimNext(provider.mode);
      if (!notification) break;
      result.claimed += 1;
      let providerMessageId: string | null;
      try {
        const sent = await provider.send({
          notificationId: notification.id,
          recipientEmail: notification.recipient_email,
          eventType: notification.event_type,
          templateData: this.dispatchTemplateData(notification.template_data),
        });
        providerMessageId = sent.providerMessageId;
      } catch (error) {
        const outcome = await this.recordDispatchFailure(notification, error);
        result[outcome] += 1;
        continue;
      }
      try {
        await this.markAccepted(notification.id, providerMessageId);
        result.accepted += 1;
      } catch {
        const outcome = await this.recordDispatchFailure(
          notification,
          new NotificationDeliveryError(
            'provider_accepted_local_reconciliation_failed',
            false,
            true,
          ),
        );
        result[outcome] += 1;
      }
    }
    return result;
  }

  async handleSendGridWebhook(
    payload: Buffer,
    signature: string,
    timestamp: string,
  ) {
    const sendGrid = this.providerRegistry.getSendGridProvider();
    if (!sendGrid.verifyWebhook(payload, signature, timestamp)) {
      throw new BadRequestException(
        'SendGrid webhook signature could not be verified.',
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('SendGrid webhook payload is invalid.');
    }
    if (!Array.isArray(parsed) || parsed.length > 100) {
      throw new BadRequestException(
        'SendGrid webhook payload must contain at most 100 events.',
      );
    }

    return this.databaseService.withTransaction(async (transaction) => {
      const summary = {
        received: true,
        processed: 0,
        duplicates: 0,
        ignored: 0,
      };
      for (const value of parsed) {
        const event = this.parseWebhookEvent(value);
        if (!event) {
          summary.ignored += 1;
          continue;
        }
        const inserted = await transaction.query<{ notification_id: string }>(
          `
            INSERT INTO notification_delivery_events (
              event_id,
              notification_id,
              provider_message_id,
              event_type,
              occurred_at
            )
            SELECT $1, notification_outbox.id, $3, $4, $5
            FROM notification_outbox
            WHERE notification_outbox.id = $2
            ON CONFLICT (event_id) DO NOTHING
            RETURNING notification_id;
          `,
          [
            event.eventId,
            event.notificationId,
            event.providerMessageId,
            event.deliveryStatus,
            event.occurredAt,
          ],
        );
        if (!inserted.rows[0]) {
          const duplicate = await transaction.query<{ exists: boolean }>(
            `
              SELECT EXISTS (
                SELECT 1
                FROM notification_delivery_events
                WHERE event_id = $1
              ) AS exists;
            `,
            [event.eventId],
          );
          if (duplicate.rows[0]?.exists) summary.duplicates += 1;
          else summary.ignored += 1;
          continue;
        }
        await transaction.query(
          `
            UPDATE notification_outbox
            SET
              provider_message_id = COALESCE(provider_message_id, $2),
              delivery_status = CASE
                WHEN delivery_status = 'delivered' THEN delivery_status
                WHEN $3 = 'delivered' THEN 'delivered'
                WHEN delivery_status IN ('bounced', 'dropped')
                  THEN delivery_status
                ELSE $3
              END,
              last_error_code = CASE
                WHEN $3 IN ('bounced', 'dropped')
                  THEN 'sendgrid_delivery_' || $3
                ELSE last_error_code
              END,
              updated_at = NOW()
            WHERE id = $1;
          `,
          [event.notificationId, event.providerMessageId, event.deliveryStatus],
        );
        if (['bounced', 'dropped'].includes(event.deliveryStatus)) {
          await transaction.query(
            `
              INSERT INTO audit_logs (
                user_id,
                action,
                entity_type,
                entity_id,
                metadata
              )
              SELECT
                user_id,
                $2,
                'order',
                order_id,
                jsonb_build_object(
                  'notificationId', id,
                  'eventId', $3,
                  'eventType', $4
                )
              FROM notification_outbox
              WHERE id = $1;
            `,
            [
              event.notificationId,
              `notification_${event.deliveryStatus}`,
              event.eventId,
              event.deliveryStatus,
            ],
          );
        }
        summary.processed += 1;
      }
      return summary;
    });
  }

  private enqueueTemplateData(
    notification: EnqueueOrderNotification,
  ): NotificationTemplateData {
    const expectedStatus: Record<NotificationEventType, string[]> = {
      order_confirmation: ['paid', 'paid_mock'],
      order_shipped: ['shipped'],
      order_delivered: ['delivered'],
    };
    if (
      !expectedStatus[notification.eventType].includes(notification.orderStatus)
    ) {
      throw new Error(
        `Notification ${notification.eventType} cannot use order status ${notification.orderStatus}.`,
      );
    }
    if (
      !Number.isInteger(notification.quantity) ||
      notification.quantity < 1 ||
      notification.quantity > 30 ||
      !Number.isInteger(notification.amountCents) ||
      notification.amountCents < 1 ||
      !/^[a-z]{3}$/.test(notification.currency)
    ) {
      throw new Error('Notification order data is invalid.');
    }
    return {
      orderId: notification.orderId,
      orderStatus: notification.orderStatus,
      quantity: notification.quantity,
      amountCents: notification.amountCents,
      currency: notification.currency,
    };
  }

  private dispatchTemplateData(
    value: Record<string, unknown>,
  ): NotificationTemplateData {
    if (
      typeof value.orderId !== 'string' ||
      typeof value.orderStatus !== 'string' ||
      typeof value.quantity !== 'number' ||
      !Number.isInteger(value.quantity) ||
      typeof value.amountCents !== 'number' ||
      !Number.isInteger(value.amountCents) ||
      typeof value.currency !== 'string'
    ) {
      throw new NotificationDeliveryError(
        'invalid_notification_template_data',
        false,
      );
    }
    return {
      orderId: value.orderId,
      orderStatus: value.orderStatus,
      quantity: value.quantity,
      amountCents: value.amountCents,
      currency: value.currency,
    };
  }

  private async markStaleClaimsUnknown() {
    await this.databaseService.query(
      `
        UPDATE notification_outbox
        SET
          status = 'delivery_unknown',
          locked_at = NULL,
          last_error_code = 'stale_processing_claim',
          updated_at = NOW()
        WHERE status = 'processing'
          AND locked_at < NOW() - ($1 * INTERVAL '1 millisecond');
      `,
      [
        this.integer(
          'NOTIFICATION_PROCESSING_LEASE_MS',
          300_000,
          30_000,
          3_600_000,
        ),
      ],
    );
  }

  private async claimNext(providerMode: NotificationProviderMode) {
    const maximumAttempts = this.integer('NOTIFICATION_MAX_ATTEMPTS', 5, 1, 10);
    return this.databaseService.withTransaction(async (transaction) => {
      const claimed = await transaction.query<OutboxRow>(
        `
          WITH candidate AS (
            SELECT notification_outbox.id
            FROM notification_outbox
            WHERE notification_outbox.status = 'pending'
              AND notification_outbox.available_at <= NOW()
              AND notification_outbox.attempt_count < $1
            ORDER BY
              notification_outbox.available_at,
              notification_outbox.created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          UPDATE notification_outbox
          SET
            status = 'processing',
            provider_mode = $2,
            attempt_count = attempt_count + 1,
            locked_at = NOW(),
            last_error_code = NULL,
            updated_at = NOW()
          FROM candidate, users
          WHERE notification_outbox.id = candidate.id
            AND users.id = notification_outbox.user_id
          RETURNING
            notification_outbox.id,
            notification_outbox.user_id,
            notification_outbox.order_id,
            notification_outbox.event_type,
            notification_outbox.template_data,
            notification_outbox.status,
            notification_outbox.delivery_status,
            notification_outbox.attempt_count,
            users.email AS recipient_email;
        `,
        [maximumAttempts, providerMode],
      );
      return claimed.rows[0] ?? null;
    });
  }

  private async markAccepted(
    notificationId: string,
    providerMessageId: string | null,
  ) {
    const updated = await this.databaseService.query<{ id: string }>(
      `
        UPDATE notification_outbox
        SET
          status = 'accepted',
          provider_message_id = $2,
          accepted_at = NOW(),
          locked_at = NULL,
          last_error_code = NULL,
          updated_at = NOW()
        WHERE id = $1 AND status = 'processing'
        RETURNING id;
      `,
      [notificationId, providerMessageId],
    );
    if (!updated.rows[0]) {
      throw new Error('Notification claim changed before acceptance.');
    }
  }

  private async recordDispatchFailure(
    notification: OutboxRow,
    error: unknown,
  ): Promise<'retried' | 'failed' | 'deliveryUnknown'> {
    const deliveryError =
      error instanceof NotificationDeliveryError
        ? error
        : new NotificationDeliveryError('notification_provider_error', false);
    const maximumAttempts = this.integer('NOTIFICATION_MAX_ATTEMPTS', 5, 1, 10);
    if (deliveryError.outcomeUnknown) {
      await this.databaseService.query(
        `
          UPDATE notification_outbox
          SET
            status = 'delivery_unknown',
            locked_at = NULL,
            last_error_code = $2,
            updated_at = NOW()
          WHERE id = $1 AND status = 'processing';
        `,
        [notification.id, deliveryError.code],
      );
      return 'deliveryUnknown';
    }
    const retry =
      deliveryError.retryable && notification.attempt_count < maximumAttempts;
    const retryDelaySeconds = Math.min(
      3_600,
      30 * 2 ** Math.max(0, notification.attempt_count - 1),
    );
    await this.databaseService.query(
      `
        UPDATE notification_outbox
        SET
          status = $2,
          available_at = CASE
            WHEN $2 = 'pending'
              THEN NOW() + ($3 * INTERVAL '1 second')
            ELSE available_at
          END,
          locked_at = NULL,
          last_error_code = $4,
          updated_at = NOW()
        WHERE id = $1 AND status = 'processing';
      `,
      [
        notification.id,
        retry ? 'pending' : 'failed',
        retryDelaySeconds,
        deliveryError.code,
      ],
    );
    return retry ? 'retried' : 'failed';
  }

  private parseWebhookEvent(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return null;
    const event = value as SendGridEvent;
    const eventId =
      typeof event.sg_event_id === 'string' ? event.sg_event_id.trim() : '';
    const providerMessageId =
      typeof event.sg_message_id === 'string'
        ? event.sg_message_id.trim()
        : null;
    const notificationId =
      typeof event.souvenoteNotificationId === 'string'
        ? event.souvenoteNotificationId.trim()
        : '';
    const timestamp = Number(event.timestamp);
    const deliveryStatus = this.deliveryStatus(event.event);
    if (
      !/^[A-Za-z0-9_=-]{1,100}$/.test(eventId) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        notificationId,
      ) ||
      !Number.isSafeInteger(timestamp) ||
      timestamp < 0 ||
      !deliveryStatus ||
      (providerMessageId !== null &&
        (!providerMessageId || providerMessageId.length > 255))
    ) {
      return null;
    }
    return {
      eventId,
      notificationId,
      providerMessageId,
      deliveryStatus,
      occurredAt: new Date(timestamp * 1_000),
    };
  }

  private deliveryStatus(value: unknown): DeliveryStatus | null {
    if (value === 'processed') return 'processed';
    if (value === 'deferred') return 'deferred';
    if (value === 'delivered') return 'delivered';
    if (value === 'bounce') return 'bounced';
    if (value === 'dropped') return 'dropped';
    return null;
  }

  private integer(
    name: string,
    defaultValue: number,
    minimum: number,
    maximum: number,
  ) {
    const configured = this.configService.get<string>(name);
    if (!configured) return defaultValue;
    if (!/^\d+$/.test(configured.trim()))
      throw new Error(`${name} is invalid.`);
    const value = Number(configured);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${name} is invalid.`);
    }
    return value;
  }
}
