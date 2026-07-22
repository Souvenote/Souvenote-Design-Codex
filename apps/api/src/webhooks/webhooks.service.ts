import { BadRequestException, Injectable } from '@nestjs/common';
import { WebhookSignatureService, type WebhookProvider } from './webhook-signature.service';
import { WebhooksRepository } from './webhooks.repository';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly signatures: WebhookSignatureService,
    private readonly repository: WebhooksRepository,
  ) {}

  async receive(
    provider: WebhookProvider,
    rawBody: Buffer | undefined,
    signature: string | undefined,
    body: Record<string, unknown>,
  ) {
    if (!rawBody) throw new BadRequestException({ code: 'RAW_BODY_REQUIRED', message: 'Webhook body is invalid.' });
    this.signatures.verify(provider, rawBody, signature);
    const eventId = typeof body.id === 'string' ? body.id.trim() : '';
    const eventType = typeof body.type === 'string' ? body.type.trim() : 'unknown';
    if (!eventId || eventId.length > 255 || eventType.length > 160) {
      throw new BadRequestException({ code: 'WEBHOOK_EVENT_INVALID', message: 'Webhook event identity is invalid.' });
    }
    await this.repository.record(provider, eventId, eventType || 'unknown', rawBody);
    return { received: true };
  }
}
