import {
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { AnalyticsProviderRegistry } from './analytics-provider.registry';
import type { FunnelEventName, SafeAnalyticsValue } from './analytics.provider';

type GenerationEvent = {
  providerMode: string;
  assetCount: number;
};

type CommerceEvent = {
  providerMode: string;
  offerType: string;
  quantity: number;
  currency: string;
};

@Injectable()
export class AnalyticsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly providerRegistry: AnalyticsProviderRegistry,
  ) {}

  onModuleInit() {
    const provider = this.providerRegistry.getActiveProvider();
    if (provider.mode === 'posthog') {
      this.identitySecret();
    }
  }

  async onApplicationShutdown() {
    await this.providerRegistry.getActiveProvider().shutdown?.();
  }

  accountProvisioned(userId: string) {
    return this.capture(userId, userId, 'account provisioned', {
      acquisition: 'authenticated_request',
    });
  }

  generationStarted(
    userId: string,
    generationJobId: string,
    event: GenerationEvent,
  ) {
    return this.capture(userId, generationJobId, 'generation started', {
      providerMode: this.safeToken(event.providerMode),
      assetCount: this.safeCount(event.assetCount, 3),
    });
  }

  generationApproved(
    userId: string,
    cardDraftId: string,
    event: GenerationEvent,
  ) {
    return this.capture(userId, cardDraftId, 'generation approved', {
      providerMode: this.safeToken(event.providerMode),
      assetCount: this.safeCount(event.assetCount, 3),
    });
  }

  checkoutStarted(userId: string, orderId: string, event: CommerceEvent) {
    return this.capture(userId, orderId, 'checkout started', {
      providerMode: this.safeToken(event.providerMode),
      offerType: this.safeToken(event.offerType),
      quantity: this.safeCount(event.quantity, 1_000),
      currency: this.safeCurrency(event.currency),
    });
  }

  orderConfirmed(userId: string, orderId: string, event: CommerceEvent) {
    return this.capture(userId, orderId, 'order confirmed', {
      providerMode: this.safeToken(event.providerMode),
      offerType: this.safeToken(event.offerType),
      quantity: this.safeCount(event.quantity, 1_000),
      currency: this.safeCurrency(event.currency),
    });
  }

  private capture(
    userId: string,
    subjectId: string,
    event: FunnelEventName,
    properties: Record<string, SafeAnalyticsValue>,
  ) {
    const provider = this.providerRegistry.getActiveProvider();
    if (provider.mode === 'disabled') return;

    try {
      const secret = this.identitySecret();
      provider.capture({
        distinctId: `user_${this.digest(secret, `user:${userId}`).toString('hex').slice(0, 32)}`,
        eventId: this.eventUuid(
          this.digest(secret, `event:${event}:${subjectId}`),
        ),
        event,
        properties: {
          schemaVersion: 1,
          source: 'backend',
          ...properties,
        },
      });
    } catch {
      this.logger.warn({
        event: 'analytics_capture_failed',
        funnelEvent: event,
      });
    }
  }

  private identitySecret() {
    const value = this.configService
      .get<string>('ANALYTICS_ID_HASH_SECRET')
      ?.trim();
    if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
      throw new InternalServerErrorException(
        'ANALYTICS_ID_HASH_SECRET must be 32 bytes encoded as 64 hexadecimal characters.',
      );
    }
    return Buffer.from(value, 'hex');
  }

  private digest(secret: Buffer, value: string) {
    return createHmac('sha256', secret).update(value, 'utf8').digest();
  }

  private eventUuid(digest: Buffer) {
    const bytes = Buffer.from(digest.subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  private safeToken(value: string) {
    const normalized = value.trim().toLowerCase();
    return /^[a-z0-9_]{1,50}$/.test(normalized) ? normalized : 'unknown';
  }

  private safeCurrency(value: string) {
    const normalized = value.trim().toLowerCase();
    return /^[a-z]{3}$/.test(normalized) ? normalized : 'unknown';
  }

  private safeCount(value: number, maximum: number) {
    return Number.isInteger(value) && value >= 0 && value <= maximum
      ? value
      : 0;
  }
}
