import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { ScribelessSubmission } from './scribeless.adapter';

export type FulfillmentVariant = 'personalized' | 'blank_handoff';

export type FulfillmentJobRow = {
  id: string;
  order_id: string;
  provider: 'mock' | 'scribeless';
  provider_job_id: string | null;
  status: string;
  fulfillment_variant: FulfillmentVariant;
  request_payload_sha256: string;
  response_payload_sha256: string | null;
  attempt_count: number;
  last_error_category: string | null;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type OrderPayloadRow = {
  order_id: string;
  order_number: string;
  order_status: string;
  currency: 'CAD';
  recipient_address: ScribelessSubmission['recipientAddress'];
  sender_address: ScribelessSubmission['senderAddress'];
  quantity: number;
  offer_type: 'try_risk_free' | 'big_sender';
  artwork_storage_key: string;
  artwork_content_sha256: string;
  artwork_media_type: string;
  message_storage_key: string | null;
  message_content_sha256: string | null;
  message_media_type: string | null;
  public_path: string;
  qr_payload_version: number;
};

const JOB_COLUMNS = `
  id, order_id, provider, provider_job_id, status, fulfillment_variant,
  request_payload_sha256, response_payload_sha256, attempt_count,
  last_error_category, submitted_at, created_at, updated_at
`;

@Injectable()
export class FulfillmentRepository {
  constructor(private readonly database: DatabaseService) {}

  async prepare(
    userId: string,
    orderId: string,
    idempotencyKey: string,
    variant: FulfillmentVariant,
  ): Promise<{ job: FulfillmentJobRow; submission: ScribelessSubmission }> {
    return this.database.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`, [`fulfillment:${orderId}`]);
      const payloadResult = await client.query<OrderPayloadRow>(
        `SELECT order_record.id AS order_id, order_record.order_number,
                order_record.status AS order_status, order_record.currency,
                order_record.recipient_address, order_record.sender_address,
                item.quantity, offer.offer_type,
                artwork.storage_key AS artwork_storage_key,
                artwork.content_sha256 AS artwork_content_sha256,
                artwork.media_type AS artwork_media_type,
                message.storage_key AS message_storage_key,
                message.content_sha256 AS message_content_sha256,
                message.media_type AS message_media_type,
                link.public_path, link.qr_payload_version
         FROM orders order_record
         JOIN order_items item ON item.order_id = order_record.id AND item.user_id = order_record.user_id
         JOIN price_offers offer ON offer.id = item.price_offer_id
         JOIN assets artwork ON artwork.id = item.print_asset_id AND artwork.user_id = item.user_id
         JOIN card_share_links link ON link.id = item.share_link_id AND link.user_id = item.user_id
         JOIN card_drafts draft ON draft.id = item.card_draft_id AND draft.user_id = item.user_id
         LEFT JOIN assets message
           ON message.id = draft.approved_message_asset_id AND message.user_id = draft.user_id
         WHERE order_record.id = $1 AND order_record.user_id = $2
         ORDER BY item.created_at, item.id LIMIT 1
         FOR UPDATE OF order_record;`,
        [orderId, userId],
      );
      const source = payloadResult.rows[0];
      if (!source) throw new NotFoundException('Order not found.');
      const submission = this.toSubmission(source, variant);
      const requestHash = this.hash(submission);

      const existing = await client.query<FulfillmentJobRow>(
        `SELECT ${JOB_COLUMNS} FROM fulfillment_jobs WHERE order_id = $1;`,
        [orderId],
      );
      if (existing.rows[0]) {
        if (
          existing.rows[0].request_payload_sha256 !== requestHash ||
          existing.rows[0].fulfillment_variant !== variant
        ) {
          throw new ConflictException({
            code: 'FULFILLMENT_ALREADY_PREPARED',
            message: 'This order already has a different fulfillment submission.',
          });
        }
        return { job: existing.rows[0], submission };
      }

      if (!['authorized', 'paid'].includes(source.order_status)) {
        throw new ConflictException({
          code: 'ORDER_NOT_FULFILLABLE',
          message: 'The order does not have an approved payment state.',
        });
      }

      if (source.offer_type === 'try_risk_free') {
        const authorization = await client.query<{ id: string; entitlement_id: string }>(
          `SELECT id, entitlement_id FROM try_risk_free_authorizations
           WHERE order_id = $1 AND user_id = $2 AND status = 'authorized'
           FOR UPDATE;`,
          [orderId, userId],
        );
        const authorizationRow = authorization.rows[0];
        if (!authorizationRow?.entitlement_id) {
          throw new ConflictException({
            code: 'TRY_RISK_FREE_NOT_AUTHORIZED',
            message: 'The Try Risk-Free authorization cannot enter fulfillment.',
          });
        }
        if (variant === 'blank_handoff') {
          await client.query(
            `INSERT INTO blank_card_handoffs
               (user_id, order_id, entitlement_id, request_sha256, idempotency_key)
             VALUES ($1, $2, $3, $4, $5);`,
            [userId, orderId, authorizationRow.entitlement_id, requestHash, idempotencyKey],
          );
        }
        const resolved = await client.query<{ authorization_id: string }>(
          `SELECT authorization_id
           FROM resolve_try_risk_free_for_fulfillment($1, $2, clock_timestamp());`,
          [authorizationRow.id, userId],
        );
        if (!resolved.rows[0]) {
          throw new ConflictException({
            code: 'TRY_RISK_FREE_AUTHORIZATION_EXPIRED',
            message: 'The Try Risk-Free authorization can no longer enter fulfillment.',
          });
        }
      } else {
        if (variant === 'blank_handoff') {
          throw new ConflictException({
            code: 'BLANK_HANDOFF_TRY_RISK_FREE_ONLY',
            message: 'Blank-card handoff is available only for a one-card Try Risk-Free order.',
          });
        }
        const entitlement = await client.query<{ id: string; quantity_total: number; quantity_consumed: number }>(
          `SELECT id, quantity_total, quantity_consumed
           FROM card_entitlements
           WHERE user_id = $1 AND source_type = 'big_sender' AND source_id = $2
             AND status = 'available'
           FOR UPDATE;`,
          [userId, orderId],
        );
        const entitlementRow = entitlement.rows[0];
        if (!entitlementRow || entitlementRow.quantity_total - entitlementRow.quantity_consumed < source.quantity) {
          throw new ConflictException({
            code: 'CARD_ENTITLEMENT_UNAVAILABLE',
            message: 'The physical-card entitlement is unavailable.',
          });
        }
        await client.query(
          `UPDATE card_entitlements
           SET quantity_consumed = quantity_consumed + $2,
               status = CASE WHEN quantity_consumed + $2 = quantity_total THEN 'consumed' ELSE status END
           WHERE id = $1;`,
          [entitlementRow.id, source.quantity],
        );
      }

      await client.query(
        `UPDATE orders
         SET status = 'fulfillment_pending', fulfillment_variant = $3
         WHERE id = $1 AND user_id = $2 AND status IN ('authorized', 'paid');`,
        [orderId, userId, variant],
      );
      const inserted = await client.query<FulfillmentJobRow>(
        `INSERT INTO fulfillment_jobs
           (user_id, order_id, provider, fulfillment_variant,
            request_payload_sha256, idempotency_key)
         VALUES ($1, $2, 'mock', $3, $4, $5)
         RETURNING ${JOB_COLUMNS};`,
        [userId, orderId, variant, requestHash, idempotencyKey],
      );
      return { job: this.requireRow(inserted.rows[0]), submission };
    });
  }

  async claim(userId: string, jobId: string): Promise<boolean> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE fulfillment_jobs
       SET status = 'submitting', attempt_count = attempt_count + 1, last_error_category = NULL
       WHERE id = $1 AND user_id = $2 AND status = 'queued'
       RETURNING id;`,
      [jobId, userId],
    );
    return Boolean(result.rows[0]);
  }

  async markSubmitted(
    userId: string,
    jobId: string,
    providerJobId: string,
    responseHash: string,
  ): Promise<FulfillmentJobRow> {
    return this.database.transaction(async (client) => {
      const updated = await client.query<FulfillmentJobRow>(
        `UPDATE fulfillment_jobs
         SET status = 'submitted', provider_job_id = $3,
             response_payload_sha256 = $4, submitted_at = clock_timestamp()
         WHERE id = $1 AND user_id = $2 AND status = 'submitting'
         RETURNING ${JOB_COLUMNS};`,
        [jobId, userId, providerJobId, responseHash],
      );
      const job = this.requireRow(updated.rows[0]);
      await client.query(
        `UPDATE orders SET status = 'submitted'
         WHERE id = $1 AND user_id = $2 AND status = 'fulfillment_pending';`,
        [job.order_id, userId],
      );
      if (job.fulfillment_variant === 'blank_handoff') {
        await client.query(
          `UPDATE blank_card_handoffs
           SET status = 'submitted', submitted_at = clock_timestamp()
           WHERE order_id = $1 AND user_id = $2 AND status = 'reserved';`,
          [job.order_id, userId],
        );
      }
      return job;
    });
  }

  async markAccepted(userId: string, jobId: string): Promise<FulfillmentJobRow> {
    return this.database.transaction(async (client) => {
      const updated = await client.query<FulfillmentJobRow>(
        `UPDATE fulfillment_jobs SET status = 'accepted'
         WHERE id = $1 AND user_id = $2 AND status = 'submitted'
         RETURNING ${JOB_COLUMNS};`,
        [jobId, userId],
      );
      const job = updated.rows[0] ?? (await this.getWithClient(client, userId, jobId));
      await client.query(
        `UPDATE orders SET status = 'in_fulfillment'
         WHERE id = $1 AND user_id = $2 AND status = 'submitted';`,
        [job.order_id, userId],
      );
      return job;
    });
  }

  async markRetryableFailure(userId: string, jobId: string, category: string): Promise<void> {
    await this.database.query(
      `UPDATE fulfillment_jobs
       SET status = 'retryable_failed', last_error_category = $3
       WHERE id = $1 AND user_id = $2 AND status = 'submitting';`,
      [jobId, userId, category.slice(0, 80)],
    );
  }

  async resetRetry(userId: string, jobId: string): Promise<FulfillmentJobRow> {
    const result = await this.database.query<FulfillmentJobRow>(
      `UPDATE fulfillment_jobs SET status = 'queued', last_error_category = NULL
       WHERE id = $1 AND user_id = $2 AND status = 'retryable_failed'
       RETURNING ${JOB_COLUMNS};`,
      [jobId, userId],
    );
    if (result.rows[0]) return result.rows[0];
    return this.get(userId, jobId);
  }

  async get(userId: string, jobId: string): Promise<FulfillmentJobRow> {
    const result = await this.database.query<FulfillmentJobRow>(
      `SELECT ${JOB_COLUMNS} FROM fulfillment_jobs WHERE id = $1 AND user_id = $2;`,
      [jobId, userId],
    );
    return this.requireRow(result.rows[0]);
  }

  static toApi(row: FulfillmentJobRow) {
    return {
      id: row.id,
      orderId: row.order_id,
      provider: row.provider,
      status: row.status,
      variant: row.fulfillment_variant,
      attemptCount: row.attempt_count,
      lastErrorCategory: row.last_error_category,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toSubmission(source: OrderPayloadRow, variant: FulfillmentVariant): ScribelessSubmission {
    if (!source.recipient_address || !source.sender_address) {
      throw new ConflictException({ code: 'ORDER_ADDRESS_REQUIRED', message: 'Canadian addresses are required.' });
    }
    if (variant === 'blank_handoff' && (source.offer_type !== 'try_risk_free' || source.quantity !== 1)) {
      throw new ConflictException({
        code: 'BLANK_HANDOFF_TRY_RISK_FREE_ONLY',
        message: 'Blank-card handoff requires a one-card Try Risk-Free order.',
      });
    }
    return {
      contractVersion: 'scribeless.mock.v1',
      idempotencyKey: `order:${source.order_id}`,
      orderId: source.order_id,
      orderNumber: source.order_number,
      variant,
      quantity: source.quantity,
      recipientAddress: source.recipient_address,
      senderAddress: source.sender_address,
      artwork:
        variant === 'personalized'
          ? {
              storageKey: source.artwork_storage_key,
              contentSha256: source.artwork_content_sha256,
              mediaType: source.artwork_media_type,
            }
          : null,
      insideMessage:
        variant === 'personalized' && source.message_storage_key && source.message_content_sha256
          ? {
              storageKey: source.message_storage_key,
              contentSha256: source.message_content_sha256,
              mediaType: source.message_media_type ?? 'text/plain',
            }
          : null,
      qr:
        variant === 'personalized'
          ? { publicPath: source.public_path, payloadVersion: source.qr_payload_version }
          : null,
    };
  }

  private hash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private async getWithClient(
    client: { query: <T extends Record<string, unknown>>(text: string, values: unknown[]) => Promise<{ rows: T[] }> },
    userId: string,
    jobId: string,
  ): Promise<FulfillmentJobRow> {
    const result = await client.query<FulfillmentJobRow>(
      `SELECT ${JOB_COLUMNS} FROM fulfillment_jobs WHERE id = $1 AND user_id = $2;`,
      [jobId, userId],
    );
    return this.requireRow(result.rows[0]);
  }

  private requireRow(row: FulfillmentJobRow | undefined): FulfillmentJobRow {
    if (!row) throw new NotFoundException('Fulfillment job not found.');
    return row;
  }
}
