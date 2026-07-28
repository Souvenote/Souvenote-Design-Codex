import { Injectable, NotFoundException } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';

const EVIDENCE_LIMITS = {
  payments: 100,
  stripeWebhookEvents: 200,
  fulfillmentAttempts: 100,
  generationJobs: 100,
  creditEvents: 200,
  moderationJobs: 200,
  notificationOutbox: 200,
  notificationDeliveryEvents: 200,
  auditEvents: 200,
} as const;

type Timestamp = Date | string;
type NullableTimestamp = Timestamp | null;

type OrderRow = QueryResultRow & {
  id: string;
  status: string;
  offer_code: string | null;
  quantity: number;
  amount_cents: number;
  currency: string;
  payment_id: string | null;
  fulfillment_job_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  fulfillment_status_updated_at: NullableTimestamp;
};

type PaymentRow = QueryResultRow & {
  id: string;
  order_id: string;
  provider_mode: string;
  status: string;
  capture_method: string;
  attempt_number: number;
  idempotency_key: string;
  checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_cents: number;
  amount_captured_cents: number;
  currency: string;
  finalization_action: string | null;
  expires_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type StripeWebhookEventRow = QueryResultRow & {
  event_id: string;
  event_type: string;
  object_id: string | null;
  livemode: boolean;
  status: string;
  attempt_count: number;
  has_error: boolean;
  processed_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type FulfillmentAttemptRow = QueryResultRow & {
  id: string;
  order_id: string;
  provider_mode: string;
  provider_fulfillment_id: string | null;
  provider_campaign_id: string | null;
  provider_status: string | null;
  status: string;
  attempt_number: number;
  idempotency_key: string;
  recipient_id_count: number;
  has_status_reason: boolean;
  submitted_at: NullableTimestamp;
  last_synced_at: NullableTimestamp;
  completed_at: NullableTimestamp;
  failed_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type GenerationJobRow = QueryResultRow & {
  id: string;
  provider_mode: string;
  overall_status: string;
  image_status: string;
  song_status: string;
  message_status: string;
  credits_charged: number;
  has_error: boolean;
  started_at: NullableTimestamp;
  completed_at: NullableTimestamp;
  failed_at: NullableTimestamp;
  refunded_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type CreditEventRow = QueryResultRow & {
  id: string;
  event_type: string;
  amount: number;
  source: string;
  idempotency_key: string | null;
  created_at: Timestamp;
};

type ModerationJobRow = QueryResultRow & {
  id: string;
  asset_id: string;
  asset_type: string;
  moderation_state: string;
  provider_mode: string;
  status: string;
  attempt_number: number;
  reviewed_by: string | null;
  started_at: NullableTimestamp;
  completed_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type PublicLinkRow = QueryResultRow & {
  id: string;
  order_id: string;
  status: string;
  access_count: string | number;
  last_accessed_at: NullableTimestamp;
  activated_at: Timestamp;
  revoked_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type NotificationOutboxRow = QueryResultRow & {
  id: string;
  order_id: string;
  event_type: string;
  status: string;
  delivery_status: string;
  attempt_count: number;
  available_at: Timestamp;
  locked_at: NullableTimestamp;
  provider_mode: string | null;
  provider_message_id: string | null;
  last_error_code: string | null;
  accepted_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
};

type NotificationDeliveryEventRow = QueryResultRow & {
  event_id: string;
  notification_id: string;
  provider_message_id: string | null;
  event_type: string;
  occurred_at: Timestamp;
  created_at: Timestamp;
};

type AuditEventRow = QueryResultRow & {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: Timestamp;
};

type BoundedCollection<T> = {
  items: T[];
  truncated: boolean;
};

@Injectable()
export class OperationsEvidenceService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getOrderEvidence(orderId: string) {
    return this.databaseService.withReadOnlyTransaction(async (transaction) => {
      const orderResult = await transaction.query<OrderRow>(
        `
          SELECT
            orders.id,
            orders.status,
            orders.offer_code,
            orders.quantity,
            orders.amount_cents,
            orders.currency,
            orders.payment_id,
            orders.fulfillment_job_id,
            orders.created_at,
            orders.updated_at,
            orders.fulfillment_status_updated_at
          FROM orders
          WHERE orders.id = $1;
        `,
        [orderId],
      );
      const order = orderResult.rows[0];
      if (!order) {
        throw new NotFoundException('Order evidence was not found.');
      }

      const payments = await this.payments(transaction, orderId);
      const stripeWebhookEvents = await this.stripeWebhookEvents(
        transaction,
        orderId,
      );
      const fulfillmentAttempts = await this.fulfillmentAttempts(
        transaction,
        orderId,
      );
      const generationJobs = await this.generationJobs(transaction, orderId);
      const creditEvents = await this.creditEvents(transaction, orderId);
      const moderationJobs = await this.moderationJobs(transaction, orderId);
      const notificationOutbox = await this.notificationOutbox(
        transaction,
        orderId,
      );
      const notificationDeliveryEvents = await this.notificationDeliveryEvents(
        transaction,
        orderId,
      );
      const publicLink = await this.publicLink(transaction, orderId);
      const auditEvents = await this.auditEvents(transaction, orderId);

      return {
        schemaVersion: 1 as const,
        generatedAt: new Date().toISOString(),
        order: {
          id: order.id,
          status: order.status,
          offerCode: order.offer_code,
          quantity: order.quantity,
          amountCents: order.amount_cents,
          currency: order.currency,
          paymentId: order.payment_id,
          fulfillmentJobId: order.fulfillment_job_id,
          createdAt: this.iso(order.created_at),
          updatedAt: this.iso(order.updated_at),
          fulfillmentStatusUpdatedAt: this.iso(
            order.fulfillment_status_updated_at,
          ),
        },
        payments,
        stripeWebhookEvents,
        fulfillmentAttempts,
        generationJobs,
        creditEvents,
        moderationJobs,
        notificationOutbox,
        notificationDeliveryEvents,
        publicLink,
        auditEvents,
      };
    });
  }

  private async payments(transaction: DatabaseTransaction, orderId: string) {
    const result = await transaction.query<PaymentRow>(
      `
        SELECT
          payments.id,
          payments.order_id,
          payments.provider_mode,
          payments.status,
          payments.capture_method,
          payments.attempt_number,
          payments.idempotency_key,
          payments.checkout_session_id,
          payments.stripe_payment_intent_id,
          payments.amount_cents,
          payments.amount_captured_cents,
          payments.currency,
          payments.finalization_action,
          payments.expires_at,
          payments.created_at,
          payments.updated_at
        FROM payments
        WHERE payments.order_id = $1
        ORDER BY payments.attempt_number
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.payments + 1],
    );
    return this.bounded(result.rows, EVIDENCE_LIMITS.payments, (payment) => ({
      id: payment.id,
      orderId: payment.order_id,
      providerMode: payment.provider_mode,
      status: payment.status,
      captureMethod: payment.capture_method,
      attemptNumber: payment.attempt_number,
      idempotencyKey: payment.idempotency_key,
      checkoutSessionId: payment.checkout_session_id,
      paymentIntentId: payment.stripe_payment_intent_id,
      amountCents: payment.amount_cents,
      amountCapturedCents: payment.amount_captured_cents,
      currency: payment.currency,
      finalizationAction: payment.finalization_action,
      expiresAt: this.iso(payment.expires_at),
      createdAt: this.iso(payment.created_at),
      updatedAt: this.iso(payment.updated_at),
    }));
  }

  private async stripeWebhookEvents(
    transaction: DatabaseTransaction,
    orderId: string,
  ) {
    const result = await transaction.query<StripeWebhookEventRow>(
      `
        WITH provider_objects AS (
          SELECT checkout_session_id AS object_id
          FROM payments
          WHERE order_id = $1 AND checkout_session_id IS NOT NULL
          UNION
          SELECT stripe_payment_intent_id
          FROM payments
          WHERE order_id = $1 AND stripe_payment_intent_id IS NOT NULL
        )
        SELECT
          stripe_webhook_events.event_id,
          stripe_webhook_events.event_type,
          stripe_webhook_events.object_id,
          stripe_webhook_events.livemode,
          stripe_webhook_events.status,
          stripe_webhook_events.attempt_count,
          stripe_webhook_events.error_message IS NOT NULL AS has_error,
          stripe_webhook_events.processed_at,
          stripe_webhook_events.created_at,
          stripe_webhook_events.updated_at
        FROM stripe_webhook_events
        INNER JOIN provider_objects USING (object_id)
        ORDER BY stripe_webhook_events.created_at
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.stripeWebhookEvents + 1],
    );
    return this.bounded(
      result.rows,
      EVIDENCE_LIMITS.stripeWebhookEvents,
      (event) => ({
        eventId: event.event_id,
        eventType: event.event_type,
        objectId: event.object_id,
        livemode: event.livemode,
        status: event.status,
        attemptCount: event.attempt_count,
        hasError: event.has_error,
        processedAt: this.iso(event.processed_at),
        createdAt: this.iso(event.created_at),
        updatedAt: this.iso(event.updated_at),
      }),
    );
  }

  private async fulfillmentAttempts(
    transaction: DatabaseTransaction,
    orderId: string,
  ) {
    const result = await transaction.query<FulfillmentAttemptRow>(
      `
        SELECT
          fulfillment_jobs.id,
          fulfillment_jobs.order_id,
          fulfillment_jobs.provider_mode,
          fulfillment_jobs.provider_fulfillment_id,
          fulfillment_jobs.provider_campaign_id,
          fulfillment_jobs.provider_status,
          fulfillment_jobs.status,
          fulfillment_jobs.attempt_number,
          fulfillment_jobs.idempotency_key,
          jsonb_array_length(fulfillment_jobs.provider_recipient_ids)
            AS recipient_id_count,
          fulfillment_jobs.status_reason IS NOT NULL AS has_status_reason,
          fulfillment_jobs.submitted_at,
          fulfillment_jobs.last_synced_at,
          fulfillment_jobs.completed_at,
          fulfillment_jobs.failed_at,
          fulfillment_jobs.created_at,
          fulfillment_jobs.updated_at
        FROM fulfillment_jobs
        WHERE fulfillment_jobs.order_id = $1
        ORDER BY fulfillment_jobs.attempt_number
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.fulfillmentAttempts + 1],
    );
    return this.bounded(
      result.rows,
      EVIDENCE_LIMITS.fulfillmentAttempts,
      (attempt) => ({
        id: attempt.id,
        orderId: attempt.order_id,
        providerMode: attempt.provider_mode,
        providerFulfillmentId: attempt.provider_fulfillment_id,
        providerCampaignId: attempt.provider_campaign_id,
        providerStatus: attempt.provider_status,
        status: attempt.status,
        attemptNumber: attempt.attempt_number,
        idempotencyKey: attempt.idempotency_key,
        recipientIdCount: attempt.recipient_id_count,
        hasStatusReason: attempt.has_status_reason,
        submittedAt: this.iso(attempt.submitted_at),
        lastSyncedAt: this.iso(attempt.last_synced_at),
        completedAt: this.iso(attempt.completed_at),
        failedAt: this.iso(attempt.failed_at),
        createdAt: this.iso(attempt.created_at),
        updatedAt: this.iso(attempt.updated_at),
      }),
    );
  }

  private async generationJobs(
    transaction: DatabaseTransaction,
    orderId: string,
  ) {
    const result = await transaction.query<GenerationJobRow>(
      `
        SELECT
          generation_jobs.id,
          generation_jobs.provider_mode,
          generation_jobs.overall_status,
          generation_jobs.image_status,
          generation_jobs.song_status,
          generation_jobs.message_status,
          generation_jobs.credits_charged,
          generation_jobs.error_message IS NOT NULL AS has_error,
          generation_jobs.started_at,
          generation_jobs.completed_at,
          generation_jobs.failed_at,
          generation_jobs.refunded_at,
          generation_jobs.created_at,
          generation_jobs.updated_at
        FROM generation_jobs
        INNER JOIN orders
          ON orders.card_draft_id = generation_jobs.card_draft_id
        WHERE orders.id = $1
        ORDER BY generation_jobs.created_at
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.generationJobs + 1],
    );
    return this.bounded(result.rows, EVIDENCE_LIMITS.generationJobs, (job) => ({
      id: job.id,
      providerMode: job.provider_mode,
      overallStatus: job.overall_status,
      imageStatus: job.image_status,
      songStatus: job.song_status,
      messageStatus: job.message_status,
      creditsCharged: job.credits_charged,
      hasError: job.has_error,
      startedAt: this.iso(job.started_at),
      completedAt: this.iso(job.completed_at),
      failedAt: this.iso(job.failed_at),
      refundedAt: this.iso(job.refunded_at),
      createdAt: this.iso(job.created_at),
      updatedAt: this.iso(job.updated_at),
    }));
  }

  private async creditEvents(
    transaction: DatabaseTransaction,
    orderId: string,
  ) {
    const result = await transaction.query<CreditEventRow>(
      `
        SELECT
          credit_ledger.id,
          credit_ledger.event_type,
          credit_ledger.amount,
          credit_ledger.source,
          credit_ledger.idempotency_key,
          credit_ledger.created_at
        FROM credit_ledger
        INNER JOIN generation_jobs
          ON credit_ledger.idempotency_key IN (
            'generation:' || generation_jobs.user_id::text || ':' ||
              generation_jobs.idempotency_key || ':deduct',
            'generation:' || generation_jobs.user_id::text || ':' ||
              generation_jobs.idempotency_key || ':refund'
          )
        INNER JOIN orders
          ON orders.card_draft_id = generation_jobs.card_draft_id
        WHERE orders.id = $1
        ORDER BY credit_ledger.created_at
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.creditEvents + 1],
    );
    return this.bounded(result.rows, EVIDENCE_LIMITS.creditEvents, (event) => ({
      id: event.id,
      eventType: event.event_type,
      amount: event.amount,
      source: event.source,
      idempotencyKey: event.idempotency_key,
      createdAt: this.iso(event.created_at),
    }));
  }

  private async moderationJobs(
    transaction: DatabaseTransaction,
    orderId: string,
  ) {
    const result = await transaction.query<ModerationJobRow>(
      `
        SELECT
          asset_moderation_jobs.id,
          asset_moderation_jobs.asset_id,
          assets.asset_type,
          assets.moderation_state,
          asset_moderation_jobs.provider_mode,
          asset_moderation_jobs.status,
          asset_moderation_jobs.attempt_number,
          asset_moderation_jobs.reviewed_by,
          asset_moderation_jobs.started_at,
          asset_moderation_jobs.completed_at,
          asset_moderation_jobs.created_at,
          asset_moderation_jobs.updated_at
        FROM asset_moderation_jobs
        INNER JOIN assets ON assets.id = asset_moderation_jobs.asset_id
        INNER JOIN orders ON orders.card_draft_id = assets.card_draft_id
        WHERE orders.id = $1
        ORDER BY asset_moderation_jobs.created_at
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.moderationJobs + 1],
    );
    return this.bounded(result.rows, EVIDENCE_LIMITS.moderationJobs, (job) => ({
      id: job.id,
      assetId: job.asset_id,
      assetType: job.asset_type,
      moderationState: job.moderation_state,
      providerMode: job.provider_mode,
      status: job.status,
      attemptNumber: job.attempt_number,
      reviewedBy: job.reviewed_by,
      startedAt: this.iso(job.started_at),
      completedAt: this.iso(job.completed_at),
      createdAt: this.iso(job.created_at),
      updatedAt: this.iso(job.updated_at),
    }));
  }

  private async notificationOutbox(
    transaction: DatabaseTransaction,
    orderId: string,
  ) {
    const result = await transaction.query<NotificationOutboxRow>(
      `
        SELECT
          notification_outbox.id,
          notification_outbox.order_id,
          notification_outbox.event_type,
          notification_outbox.status,
          notification_outbox.delivery_status,
          notification_outbox.attempt_count,
          notification_outbox.available_at,
          notification_outbox.locked_at,
          notification_outbox.provider_mode,
          notification_outbox.provider_message_id,
          notification_outbox.last_error_code,
          notification_outbox.accepted_at,
          notification_outbox.created_at,
          notification_outbox.updated_at
        FROM notification_outbox
        WHERE notification_outbox.order_id = $1
        ORDER BY notification_outbox.created_at
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.notificationOutbox + 1],
    );
    return this.bounded(
      result.rows,
      EVIDENCE_LIMITS.notificationOutbox,
      (notification) => ({
        id: notification.id,
        orderId: notification.order_id,
        eventType: notification.event_type,
        status: notification.status,
        deliveryStatus: notification.delivery_status,
        attemptCount: notification.attempt_count,
        availableAt: this.iso(notification.available_at),
        lockedAt: this.iso(notification.locked_at),
        providerMode: notification.provider_mode,
        providerMessageId: notification.provider_message_id,
        lastErrorCode: notification.last_error_code,
        acceptedAt: this.iso(notification.accepted_at),
        createdAt: this.iso(notification.created_at),
        updatedAt: this.iso(notification.updated_at),
      }),
    );
  }

  private async notificationDeliveryEvents(
    transaction: DatabaseTransaction,
    orderId: string,
  ) {
    const result = await transaction.query<NotificationDeliveryEventRow>(
      `
        SELECT
          notification_delivery_events.event_id,
          notification_delivery_events.notification_id,
          notification_delivery_events.provider_message_id,
          notification_delivery_events.event_type,
          notification_delivery_events.occurred_at,
          notification_delivery_events.created_at
        FROM notification_delivery_events
        INNER JOIN notification_outbox
          ON notification_outbox.id =
            notification_delivery_events.notification_id
        WHERE notification_outbox.order_id = $1
        ORDER BY notification_delivery_events.occurred_at
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.notificationDeliveryEvents + 1],
    );
    return this.bounded(
      result.rows,
      EVIDENCE_LIMITS.notificationDeliveryEvents,
      (event) => ({
        eventId: event.event_id,
        notificationId: event.notification_id,
        providerMessageId: event.provider_message_id,
        eventType: event.event_type,
        occurredAt: this.iso(event.occurred_at),
        createdAt: this.iso(event.created_at),
      }),
    );
  }

  private async publicLink(transaction: DatabaseTransaction, orderId: string) {
    const result = await transaction.query<PublicLinkRow>(
      `
        SELECT
          public_card_links.id,
          public_card_links.order_id,
          public_card_links.status,
          public_card_links.access_count,
          public_card_links.last_accessed_at,
          public_card_links.activated_at,
          public_card_links.revoked_at,
          public_card_links.created_at,
          public_card_links.updated_at
        FROM public_card_links
        WHERE public_card_links.order_id = $1
        LIMIT 1;
      `,
      [orderId],
    );
    const link = result.rows[0];
    return link
      ? {
          id: link.id,
          orderId: link.order_id,
          status: link.status,
          accessCount: Number(link.access_count),
          lastAccessedAt: this.iso(link.last_accessed_at),
          activatedAt: this.iso(link.activated_at),
          revokedAt: this.iso(link.revoked_at),
          createdAt: this.iso(link.created_at),
          updatedAt: this.iso(link.updated_at),
        }
      : null;
  }

  private async auditEvents(transaction: DatabaseTransaction, orderId: string) {
    const result = await transaction.query<AuditEventRow>(
      `
        SELECT
          audit_logs.id,
          audit_logs.action,
          audit_logs.entity_type,
          audit_logs.entity_id,
          audit_logs.created_at
        FROM audit_logs
        WHERE audit_logs.entity_id = $1
        ORDER BY audit_logs.created_at
        LIMIT $2;
      `,
      [orderId, EVIDENCE_LIMITS.auditEvents + 1],
    );
    return this.bounded(result.rows, EVIDENCE_LIMITS.auditEvents, (event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entity_type,
      entityId: event.entity_id,
      createdAt: this.iso(event.created_at),
    }));
  }

  private bounded<T extends QueryResultRow, U>(
    rows: T[],
    limit: number,
    map: (row: T) => U,
  ): BoundedCollection<U> {
    return {
      items: rows.slice(0, limit).map(map),
      truncated: rows.length > limit,
    };
  }

  private iso(value: NullableTimestamp): string | null {
    if (value === null) return null;
    return new Date(value).toISOString();
  }
}
