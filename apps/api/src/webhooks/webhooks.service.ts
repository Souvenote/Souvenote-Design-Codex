import { BadRequestException, Injectable } from '@nestjs/common';
import { WebhookSignatureService, type WebhookProvider } from './webhook-signature.service';
import { WebhooksRepository } from './webhooks.repository';

type WebhookOutcome = 'processed' | 'ignored';

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
    const eventId = this.string(body.id);
    const eventType = this.string(body.type) || 'unknown';
    if (!eventId || eventId.length > 255 || eventType.length > 160) {
      throw new BadRequestException({ code: 'WEBHOOK_EVENT_INVALID', message: 'Webhook event identity is invalid.' });
    }
    const event = await this.repository.record(provider, eventId, eventType, rawBody);
    if (!(await this.repository.claim(event.id))) return { received: true };
    try {
      const outcome = await this.reconcile(provider, eventType, body);
      await this.repository.finish(event.id, outcome);
      return { received: true };
    } catch (error: unknown) {
      await this.repository.failEvent(event.id, this.category(error));
      throw error;
    }
  }

  private async reconcile(
    provider: WebhookProvider,
    eventType: string,
    body: Record<string, unknown>,
  ): Promise<WebhookOutcome> {
    const object = this.eventObject(body);
    if (provider === 'stripe') {
      const providerSessionId = this.string(object.id);
      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(eventType)) {
        const paymentId = this.string(object.payment_intent);
        if (!providerSessionId || !paymentId) this.invalidPayload();
        return this.repository.completeStripeCheckout(providerSessionId, paymentId);
      }
      if (eventType === 'checkout.session.async_payment_failed') {
        if (!providerSessionId) this.invalidPayload();
        return this.repository.failStripeCheckout(providerSessionId, 'provider_declined');
      }
      return 'ignored';
    }

    const providerJobId = this.string(object.id) || this.string(object.job_id);
    const stateByType: Record<string, string> = {
      'job.accepted': 'accepted',
      'job.printing': 'printing',
      'job.mailed': 'mailed',
      'job.delivered': 'delivered',
      'job.retryable_failed': 'retryable_failed',
      'job.failed': 'permanent_failed',
    };
    const state = stateByType[eventType];
    if (!state) return 'ignored';
    if (!providerJobId) this.invalidPayload();
    return this.repository.reconcileScribeless(providerJobId, state);
  }

  private eventObject(body: Record<string, unknown>): Record<string, unknown> {
    const data = body.data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return body;
    const object = (data as Record<string, unknown>).object;
    return typeof object === 'object' && object !== null && !Array.isArray(object)
      ? (object as Record<string, unknown>)
      : (data as Record<string, unknown>);
  }

  private string(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private invalidPayload(): never {
    throw new BadRequestException({ code: 'WEBHOOK_PAYLOAD_INVALID', message: 'Webhook payload is invalid.' });
  }

  private category(error: unknown): string {
    if (error instanceof BadRequestException) return 'invalid_payload';
    if (error instanceof Error && error.name === 'ConflictException') return 'state_conflict';
    return 'reconciliation_failed';
  }
}
