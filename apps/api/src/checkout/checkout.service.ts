import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readString, runtimeEnvironment, type ConfigurationReader } from '../config/runtime-config';
import { CheckoutRepository, type CheckoutSessionRow } from './checkout.repository';
import { DeterministicHostedCheckoutAdapter } from './hosted-checkout.adapter';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly repository: CheckoutRepository,
    private readonly adapter: DeterministicHostedCheckoutAdapter,
    @Inject(ConfigService) private readonly configuration: ConfigurationReader,
  ) {}

  async startPhysical(userId: string, orderId: string, idempotencyKey: string) {
    this.requireMockMode();
    const requestHash = this.hash({ purpose: 'physical_order', orderId });
    const session = await this.repository.createPhysical(userId, orderId, idempotencyKey, requestHash);
    return { checkoutSession: CheckoutRepository.toApi(await this.ensureOpen(userId, session)) };
  }

  async startCreditPack(userId: string, offerCode: string, idempotencyKey: string) {
    this.requireMockMode();
    const requestHash = this.hash({ purpose: 'credit_pack', offerCode });
    const session = await this.repository.createCreditPack(userId, offerCode, idempotencyKey, requestHash);
    return { checkoutSession: CheckoutRepository.toApi(await this.ensureOpen(userId, session)) };
  }

  async get(userId: string, sessionId: string) {
    return { checkoutSession: CheckoutRepository.toApi(await this.repository.get(userId, sessionId)) };
  }

  async completeMock(userId: string, sessionId: string, outcome: 'succeeded' | 'failed') {
    this.requireMockMode();
    const session = await this.repository.get(userId, sessionId);
    if (session.provider !== 'mock') {
      throw new ConflictException({ code: 'MOCK_CHECKOUT_REQUIRED', message: 'This is not a mock checkout.' });
    }
    if (outcome === 'succeeded') {
      await this.repository.complete(session.id, `mock_payment_${session.id.replaceAll('-', '')}`);
    } else {
      await this.repository.fail(session.id, 'mock_declined');
    }
    return { checkoutSession: CheckoutRepository.toApi(await this.repository.get(userId, sessionId)) };
  }

  private async ensureOpen(userId: string, session: CheckoutSessionRow): Promise<CheckoutSessionRow> {
    if (session.status !== 'creating') return session;
    try {
      const hosted = await this.adapter.create({
        sessionId: session.id,
        purpose: session.purpose,
        collectionMode: session.collection_mode,
        amountMinor: session.amount_minor,
        currency: session.currency,
      });
      return await this.repository.open(userId, session.id, hosted.providerSessionId);
    } catch (error: unknown) {
      await this.repository.failCreation(userId, session.id);
      throw error;
    }
  }

  private requireMockMode(): void {
    const environment = runtimeEnvironment(this.configuration);
    const paymentMode = readString(this.configuration, 'PAYMENT_PROVIDER_MODE')?.toLowerCase();
    if (!['development', 'test'].includes(environment) || paymentMode !== 'mock') {
      throw new ConflictException({
        code: 'CHECKOUT_NOT_ENABLED',
        message: 'Hosted checkout is disabled in this environment.',
      });
    }
  }

  private hash(value: Record<string, string>): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
