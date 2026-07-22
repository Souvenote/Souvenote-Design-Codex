import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type { WebhookProvider } from './webhook-signature.service';

@Injectable()
export class WebhooksRepository {
  constructor(private readonly database: DatabaseService) {}

  async record(provider: WebhookProvider, eventId: string, eventType: string, rawBody: Buffer): Promise<void> {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const result = await this.database.query<{ payload_sha256: string }>(
      `INSERT INTO webhook_events
         (provider, provider_event_id, event_type, payload_sha256, signature_verified_at)
       VALUES ($1, $2, $3, $4, clock_timestamp())
       ON CONFLICT (provider, provider_event_id) DO UPDATE
         SET provider_event_id = EXCLUDED.provider_event_id
       RETURNING payload_sha256;`,
      [provider, eventId, eventType, payloadHash],
    );
    if (result.rows[0]?.payload_sha256 !== payloadHash) {
      throw new ConflictException({
        code: 'WEBHOOK_EVENT_CONFLICT',
        message: 'The provider event identifier was already used with another payload.',
      });
    }
  }
}
