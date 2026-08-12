import { ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readString, runtimeEnvironment, type ConfigurationReader } from '../config/runtime-config';
import { FulfillmentRepository, type FulfillmentVariant } from './fulfillment.repository';
import { DeterministicScribelessAdapter, type ScribelessSubmission } from './scribeless.adapter';

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly repository: FulfillmentRepository,
    private readonly adapter: DeterministicScribelessAdapter,
    @Inject(ConfigService) private readonly configuration: ConfigurationReader,
  ) {}

  async submit(userId: string, orderId: string, idempotencyKey: string, variant: FulfillmentVariant) {
    this.requireMockMode();
    this.requireVariantEnabled(variant);
    const prepared = await this.repository.prepare(userId, orderId, idempotencyKey, variant);
    return {
      fulfillmentJob: FulfillmentRepository.toApi(await this.send(userId, prepared.job.id, prepared.submission)),
    };
  }

  async retry(userId: string, jobId: string) {
    this.requireMockMode();
    const reset = await this.repository.resetRetry(userId, jobId);
    const prepared = await this.repository.prepare(
      userId,
      reset.order_id,
      `retry:${reset.id}`,
      reset.fulfillment_variant,
    );
    return { fulfillmentJob: FulfillmentRepository.toApi(await this.send(userId, reset.id, prepared.submission)) };
  }

  async get(userId: string, jobId: string) {
    return { fulfillmentJob: FulfillmentRepository.toApi(await this.repository.get(userId, jobId)) };
  }

  private async send(userId: string, jobId: string, submission: ScribelessSubmission) {
    const current = await this.repository.get(userId, jobId);
    if (current.status === 'submitted') return this.repository.markAccepted(userId, jobId);
    if (['accepted', 'printing', 'mailed', 'delivered'].includes(current.status)) return current;
    if (!(await this.repository.claim(userId, jobId))) return this.repository.get(userId, jobId);
    try {
      const result = await this.adapter.submit(submission);
      await this.repository.markSubmitted(userId, jobId, result.providerJobId, result.responsePayloadSha256);
      return await this.repository.markAccepted(userId, jobId);
    } catch {
      await this.repository.markRetryableFailure(userId, jobId, 'provider_unavailable');
      throw new ServiceUnavailableException({
        code: 'FULFILLMENT_RETRYABLE_FAILURE',
        message: 'The fulfillment provider is temporarily unavailable.',
      });
    }
  }

  private requireMockMode(): void {
    const environment = runtimeEnvironment(this.configuration);
    const mode = readString(this.configuration, 'FULFILLMENT_PROVIDER_MODE')?.toLowerCase();
    if (!['development', 'test'].includes(environment) || mode !== 'mock') {
      throw new ConflictException({
        code: 'FULFILLMENT_NOT_ENABLED',
        message: 'Fulfillment is disabled in this environment.',
      });
    }
  }

  private requireVariantEnabled(variant: FulfillmentVariant): void {
    if (variant !== 'blank_handoff') return;
    const enabled = readString(this.configuration, 'BLANK_CARD_HANDOFF_ENABLED')?.toLowerCase() === 'true';
    if (!enabled || !['development', 'test'].includes(runtimeEnvironment(this.configuration))) {
      throw new ConflictException({
        code: 'BLANK_CARD_HANDOFF_NOT_ENABLED',
        message: 'Blank-card handoff is awaiting its final print-payload contract.',
      });
    }
  }
}
