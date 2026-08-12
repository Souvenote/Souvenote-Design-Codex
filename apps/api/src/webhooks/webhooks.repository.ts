import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { WebhookProvider } from './webhook-signature.service';

type WebhookRow = {
  id: string;
  payload_sha256: string;
  status: 'received' | 'processing' | 'processed' | 'failed' | 'ignored';
};

@Injectable()
export class WebhooksRepository {
  constructor(private readonly database: DatabaseService) {}

  async record(provider: WebhookProvider, eventId: string, eventType: string, rawBody: Buffer): Promise<WebhookRow> {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const result = await this.database.query<WebhookRow>(
      `INSERT INTO webhook_events
         (provider, provider_event_id, event_type, payload_sha256, signature_verified_at)
       VALUES ($1, $2, $3, $4, clock_timestamp())
       ON CONFLICT (provider, provider_event_id) DO UPDATE
         SET provider_event_id = EXCLUDED.provider_event_id
       RETURNING id, payload_sha256, status;`,
      [provider, eventId, eventType, payloadHash],
    );
    const event = result.rows[0];
    if (!event || event.payload_sha256 !== payloadHash) {
      throw new ConflictException({
        code: 'WEBHOOK_EVENT_CONFLICT',
        message: 'The provider event identifier was already used with another payload.',
      });
    }
    return event;
  }

  async claim(eventId: string): Promise<boolean> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE webhook_events
       SET status = 'processing', attempt_count = attempt_count + 1,
           last_error_category = NULL, updated_at = clock_timestamp()
       WHERE id = $1
         AND (
           status IN ('received', 'failed')
           OR (status = 'processing' AND updated_at < clock_timestamp() - INTERVAL '5 minutes')
         )
       RETURNING id;`,
      [eventId],
    );
    return Boolean(result.rows[0]);
  }

  async finish(eventId: string, status: 'processed' | 'ignored'): Promise<void> {
    await this.database.query(
      `UPDATE webhook_events
       SET status = $2, processed_at = clock_timestamp(), updated_at = clock_timestamp()
       WHERE id = $1 AND status = 'processing';`,
      [eventId, status],
    );
  }

  async failEvent(eventId: string, category: string): Promise<void> {
    await this.database.query(
      `UPDATE webhook_events
       SET status = 'failed', last_error_category = $2, updated_at = clock_timestamp()
       WHERE id = $1 AND status = 'processing';`,
      [eventId, category.slice(0, 80)],
    );
  }

  async completeStripeCheckout(providerSessionId: string, providerPaymentId: string): Promise<'processed' | 'ignored'> {
    const session = await this.database.query<{ id: string }>(
      `SELECT id FROM checkout_sessions
       WHERE provider = 'stripe' AND provider_session_id = $1;`,
      [providerSessionId],
    );
    if (!session.rows[0]) return 'ignored';
    await this.database.query(`SELECT complete_checkout_session($1, $2, clock_timestamp());`, [
      session.rows[0].id,
      providerPaymentId,
    ]);
    return 'processed';
  }

  async failStripeCheckout(providerSessionId: string, category: string): Promise<'processed' | 'ignored'> {
    const session = await this.database.query<{ id: string }>(
      `SELECT id FROM checkout_sessions
       WHERE provider = 'stripe' AND provider_session_id = $1;`,
      [providerSessionId],
    );
    if (!session.rows[0]) return 'ignored';
    await this.database.query(`SELECT fail_checkout_session($1, $2);`, [session.rows[0].id, category]);
    return 'processed';
  }

  async reconcileScribeless(providerJobId: string, state: string): Promise<'processed' | 'ignored'> {
    return this.database.transaction(async (client) => {
      const result = await client.query<{
        id: string;
        user_id: string;
        order_id: string;
        status: string;
      }>(
        `SELECT id, user_id, order_id, status FROM fulfillment_jobs
         WHERE provider = 'scribeless' AND provider_job_id = $1 FOR UPDATE;`,
        [providerJobId],
      );
      const job = result.rows[0];
      if (!job) return 'ignored';
      if (job.status === state) return 'processed';

      const allowed: Record<string, string[]> = {
        accepted: ['submitted'],
        printing: ['accepted'],
        mailed: ['printing'],
        delivered: ['mailed'],
        retryable_failed: ['submitted', 'accepted', 'printing'],
        permanent_failed: ['submitted', 'accepted', 'printing'],
      };
      if (!allowed[state]?.includes(job.status)) {
        throw new ConflictException({
          code: 'FULFILLMENT_RECONCILIATION_CONFLICT',
          message: 'The fulfillment event is out of order.',
        });
      }
      await client.query(`UPDATE fulfillment_jobs SET status = $2 WHERE id = $1;`, [job.id, state]);
      if (state === 'accepted') {
        await client.query(
          `UPDATE orders SET status = 'in_fulfillment'
           WHERE id = $1 AND user_id = $2 AND status = 'submitted';`,
          [job.order_id, job.user_id],
        );
      } else if (state === 'mailed') {
        await client.query(
          `UPDATE orders SET status = 'shipped'
           WHERE id = $1 AND user_id = $2 AND status = 'in_fulfillment';`,
          [job.order_id, job.user_id],
        );
      } else if (state === 'delivered') {
        await client.query(
          `UPDATE orders SET status = 'delivered'
           WHERE id = $1 AND user_id = $2 AND status = 'shipped';`,
          [job.order_id, job.user_id],
        );
      } else if (state === 'permanent_failed') {
        await client.query(
          `UPDATE orders SET status = 'fulfillment_failed'
           WHERE id = $1 AND user_id = $2 AND status IN ('submitted', 'in_fulfillment');`,
          [job.order_id, job.user_id],
        );
      }
      return 'processed';
    });
  }
}
