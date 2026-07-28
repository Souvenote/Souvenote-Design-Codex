import { NotFoundException } from '@nestjs/common';
import type { DatabaseTransaction } from '../database/database.service';
import { DatabaseService } from '../database/database.service';
import { OperationsEvidenceService } from './operations-evidence.service';

const orderId = '11111111-1111-4111-8111-111111111111';
const now = '2026-07-22T12:00:00.000Z';

const orderRow = {
  id: orderId,
  status: 'fulfillment_on_hold',
  offer_code: 'try_risk_free_one_card',
  quantity: 1,
  amount_cents: 999,
  currency: 'usd',
  payment_id: 'payment-1',
  fulfillment_job_id: 'fulfillment-1',
  created_at: now,
  updated_at: now,
  fulfillment_status_updated_at: now,
  recipient_address: 'never-return-address',
};

const paymentRow = {
  id: 'payment-1',
  order_id: orderId,
  provider_mode: 'stripe',
  status: 'authorized',
  capture_method: 'manual',
  attempt_number: 1,
  idempotency_key: 'payment-idempotency',
  checkout_session_id: 'cs_test_safe-provider-id',
  stripe_payment_intent_id: 'pi_test_safe-provider-id',
  amount_cents: 999,
  amount_captured_cents: 0,
  currency: 'usd',
  finalization_action: null,
  expires_at: now,
  created_at: now,
  updated_at: now,
  metadata: 'never-return-payment-metadata',
};

const webhookRow = {
  event_id: 'evt_1',
  event_type: 'checkout.session.completed',
  object_id: 'cs_test_safe-provider-id',
  livemode: false,
  status: 'processed',
  attempt_count: 1,
  has_error: true,
  processed_at: now,
  created_at: now,
  updated_at: now,
  error_message: 'never-return-webhook-error',
  event_metadata: 'never-return-webhook-metadata',
};

const fulfillmentRow = {
  id: 'fulfillment-1',
  order_id: orderId,
  provider_mode: 'scribeless',
  provider_fulfillment_id: 'fulfillment-provider-id',
  provider_campaign_id: 'campaign-provider-id',
  provider_status: 'awaiting_reconciliation',
  status: 'submission_unknown',
  attempt_number: 1,
  idempotency_key: 'fulfillment-idempotency',
  recipient_id_count: 1,
  has_status_reason: true,
  submitted_at: now,
  last_synced_at: now,
  completed_at: null,
  failed_at: null,
  created_at: now,
  updated_at: now,
  provider_recipient_ids: ['never-return-recipient-provider-id'],
  status_reason: 'never-return-status-reason',
  request_payload: 'never-return-request-payload',
  response_payload: 'never-return-response-payload',
};

const generationRow = {
  id: 'generation-1',
  provider_mode: 'fal',
  overall_status: 'failed',
  image_status: 'failed',
  song_status: 'ready',
  message_status: 'ready',
  credits_charged: 2,
  has_error: true,
  started_at: now,
  completed_at: null,
  failed_at: now,
  refunded_at: now,
  created_at: now,
  updated_at: now,
  error_message: 'never-return-generation-error',
  provider_job_refs: 'never-return-provider-job-refs',
  result_metadata: 'never-return-generation-metadata',
};

const creditRow = {
  id: 'credit-1',
  event_type: 'generation_refund',
  amount: 2,
  source: 'generation',
  idempotency_key: 'credit-idempotency',
  created_at: now,
  metadata: 'never-return-credit-metadata',
};

const moderationRow = {
  id: 'moderation-1',
  asset_id: 'asset-1',
  asset_type: 'image',
  moderation_state: 'approved',
  provider_mode: 'manual',
  status: 'approved',
  attempt_number: 1,
  reviewed_by: 'reviewer-id',
  started_at: now,
  completed_at: now,
  created_at: now,
  updated_at: now,
  s3_key: 'never-return-storage-key',
  provider_job_ref: 'never-return-moderation-provider-ref',
  result_metadata: 'never-return-moderation-metadata',
  error_message: 'never-return-moderation-error',
};

const notificationRow = {
  id: 'notification-1',
  order_id: orderId,
  event_type: 'order_shipped',
  status: 'accepted',
  delivery_status: 'delivered',
  attempt_count: 1,
  available_at: now,
  locked_at: null,
  provider_mode: 'sendgrid',
  provider_message_id: 'sendgrid-message-1',
  last_error_code: null,
  accepted_at: now,
  created_at: now,
  updated_at: now,
  template_data: 'never-return-notification-template-data',
  recipient_email: 'never-return-notification-email',
};

const notificationDeliveryEventRow = {
  event_id: 'notification-event-1',
  notification_id: 'notification-1',
  provider_message_id: 'sendgrid-message-1',
  event_type: 'delivered',
  occurred_at: now,
  created_at: now,
  email: 'never-return-callback-email',
  reason: 'never-return-callback-reason',
  raw_payload: 'never-return-callback-payload',
};

const publicLinkRow = {
  id: 'public-link-1',
  order_id: orderId,
  status: 'active',
  access_count: '2',
  last_accessed_at: now,
  activated_at: now,
  revoked_at: null,
  created_at: now,
  updated_at: now,
  token_hash: 'never-return-token-hash',
};

const auditRow = {
  id: 'audit-1',
  action: 'fulfillment_submission_unknown',
  entity_type: 'order',
  entity_id: orderId,
  created_at: now,
  metadata: 'never-return-audit-metadata',
};

describe('OperationsEvidenceService', () => {
  const query = jest.fn<
    Promise<{ rows: Record<string, unknown>[] }>,
    [sql: string, params?: unknown[]]
  >();
  const directQuery = jest.fn();
  const withReadOnlyTransaction = jest.fn(
    async (operation: (transaction: DatabaseTransaction) => Promise<unknown>) =>
      operation({
        query: query as unknown as DatabaseTransaction['query'],
      }),
  );
  const databaseService = {
    query: directQuery,
    withReadOnlyTransaction,
  } as unknown as DatabaseService;
  const service = new OperationsEvidenceService(databaseService);

  beforeEach(() => {
    query.mockReset();
    directQuery.mockReset();
    withReadOnlyTransaction.mockClear();
  });

  function queueCompleteEvidence(payments = [paymentRow]) {
    query
      .mockResolvedValueOnce({ rows: [orderRow] })
      .mockResolvedValueOnce({ rows: payments })
      .mockResolvedValueOnce({ rows: [webhookRow] })
      .mockResolvedValueOnce({ rows: [fulfillmentRow] })
      .mockResolvedValueOnce({ rows: [generationRow] })
      .mockResolvedValueOnce({ rows: [creditRow] })
      .mockResolvedValueOnce({ rows: [moderationRow] })
      .mockResolvedValueOnce({ rows: [notificationRow] })
      .mockResolvedValueOnce({ rows: [notificationDeliveryEventRow] })
      .mockResolvedValueOnce({ rows: [publicLinkRow] })
      .mockResolvedValueOnce({ rows: [auditRow] });
  }

  it('returns explicitly mapped, PII-minimized evidence from one read-only transaction', async () => {
    queueCompleteEvidence();

    const evidence = await service.getOrderEvidence(orderId);
    const serialized = JSON.stringify(evidence);

    expect(withReadOnlyTransaction).toHaveBeenCalledTimes(1);
    expect(directQuery).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(11);
    expect(evidence).toMatchObject({
      schemaVersion: 1,
      order: {
        id: orderId,
        status: 'fulfillment_on_hold',
        amountCents: 999,
        currency: 'usd',
      },
      payments: {
        truncated: false,
        items: [
          { id: 'payment-1', paymentIntentId: 'pi_test_safe-provider-id' },
        ],
      },
      stripeWebhookEvents: {
        truncated: false,
        items: [{ eventId: 'evt_1', hasError: true }],
      },
      fulfillmentAttempts: {
        truncated: false,
        items: [{ id: 'fulfillment-1', recipientIdCount: 1 }],
      },
      generationJobs: {
        truncated: false,
        items: [{ id: 'generation-1', hasError: true }],
      },
      notificationOutbox: {
        truncated: false,
        items: [
          {
            id: 'notification-1',
            eventType: 'order_shipped',
            deliveryStatus: 'delivered',
          },
        ],
      },
      notificationDeliveryEvents: {
        truncated: false,
        items: [
          {
            eventId: 'notification-event-1',
            notificationId: 'notification-1',
          },
        ],
      },
      publicLink: { id: 'public-link-1', accessCount: 2 },
    });
    for (const forbiddenValue of [
      'never-return-address',
      'never-return-payment-metadata',
      'never-return-webhook-error',
      'never-return-webhook-metadata',
      'never-return-recipient-provider-id',
      'never-return-status-reason',
      'never-return-request-payload',
      'never-return-response-payload',
      'never-return-generation-error',
      'never-return-provider-job-refs',
      'never-return-generation-metadata',
      'never-return-credit-metadata',
      'never-return-storage-key',
      'never-return-moderation-provider-ref',
      'never-return-moderation-metadata',
      'never-return-moderation-error',
      'never-return-notification-template-data',
      'never-return-notification-email',
      'never-return-callback-email',
      'never-return-callback-reason',
      'never-return-callback-payload',
      'never-return-token-hash',
      'never-return-audit-metadata',
    ]) {
      expect(serialized).not.toContain(forbiddenValue);
    }
  });

  it('uses only parameterized, bounded SELECT statements without raw sensitive columns', async () => {
    queueCompleteEvidence();

    await service.getOrderEvidence(orderId);

    const statements = query.mock.calls.map(([sql]) => String(sql));
    const combined = statements.join('\n').toLowerCase();
    expect(statements.every((sql) => sql.includes('$1'))).toBe(true);
    expect(combined).not.toMatch(/select\s+\*/);
    expect(combined).not.toMatch(
      /\b(insert|update|delete|alter|drop|truncate|grant|revoke)\b/,
    );
    for (const forbiddenColumn of [
      'recipient_address',
      'recipient_addresses',
      'sender_address',
      'request_payload',
      'response_payload',
      'event_metadata',
      'provider_job_refs',
      'result_metadata',
      'provider_job_ref',
      'token_hash',
      'storage_key',
      's3_key',
      'template_data',
      'recipient_email',
      'raw_payload',
    ]) {
      expect(combined).not.toContain(forbiddenColumn);
    }
    expect(combined).not.toMatch(/\bmetadata\b/);
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8, 10].every((index) =>
        statements[index]?.includes('LIMIT $2'),
      ),
    ).toBe(true);
  });

  it('reports truncation and never returns more than the section cap', async () => {
    const payments = Array.from({ length: 101 }, (_, index) => ({
      ...paymentRow,
      id: `payment-${index}`,
      attempt_number: index + 1,
    }));
    queueCompleteEvidence(payments);

    const evidence = await service.getOrderEvidence(orderId);

    expect(evidence.payments.items).toHaveLength(100);
    expect(evidence.payments.truncated).toBe(true);
    expect(query).toHaveBeenNthCalledWith(2, expect.any(String), [
      orderId,
      101,
    ]);
  });

  it('returns a generic not-found result without executing related evidence reads', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(service.getOrderEvidence(orderId)).rejects.toThrow(
      NotFoundException,
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(directQuery).not.toHaveBeenCalled();
  });
});
