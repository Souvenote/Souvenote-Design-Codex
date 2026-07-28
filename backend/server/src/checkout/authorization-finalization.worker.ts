import {
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutProviderRegistry } from './checkout-provider.registry';
import { CheckoutService } from './checkout.service';

@Injectable()
export class AuthorizationFinalizationWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(AuthorizationFinalizationWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly providerRegistry: CheckoutProviderRegistry,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (!this.enabled()) return;
    if (this.providerRegistry.getActiveProvider().mode !== 'stripe') {
      throw new InternalServerErrorException(
        'The authorization finalization worker requires Stripe checkout mode.',
      );
    }
    void this.tick();
    this.timer = setInterval(
      () => void this.tick(),
      this.integer(
        'AUTHORIZATION_WORKER_INTERVAL_MS',
        60_000,
        10_000,
        3_600_000,
      ),
    );
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.checkoutService.finalizeDueAuthorizations(
        this.integer('AUTHORIZATION_WORKER_BATCH_SIZE', 10, 1, 50),
      );
      if (result.claimed > 0) {
        this.logger.log({
          event: 'authorization_finalization_batch',
          ...result,
        });
      }
    } catch {
      this.logger.error({ event: 'authorization_finalization_failed' });
    } finally {
      this.running = false;
    }
  }

  private enabled() {
    const configured = this.configService
      .get<string>('AUTHORIZATION_WORKER_ENABLED')
      ?.trim()
      .toLowerCase();
    if (!configured) {
      return (
        this.configService.get<string>('NODE_ENV')?.trim().toLowerCase() ===
        'production'
      );
    }
    if (configured === 'true') return true;
    if (configured === 'false') return false;
    throw new InternalServerErrorException(
      'AUTHORIZATION_WORKER_ENABLED must be true or false.',
    );
  }

  private integer(
    name: string,
    fallback: number,
    minimum: number,
    maximum: number,
  ) {
    const configured = this.configService.get<string>(name);
    if (!configured) return fallback;
    const value = Number(configured);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new InternalServerErrorException(
        `${name} must be an integer between ${minimum} and ${maximum}.`,
      );
    }
    return value;
  }
}
