import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationProviderRegistry } from './notification-provider.registry';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(NotificationsWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly providerRegistry: NotificationProviderRegistry,
  ) {}

  onApplicationBootstrap() {
    if (!this.enabled()) return;
    this.providerRegistry.getActiveProvider();
    const intervalMs = this.integer(
      'NOTIFICATION_WORKER_INTERVAL_MS',
      5_000,
      1_000,
      60_000,
    );
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.notificationsService.dispatchBatch();
      if (result.claimed > 0) {
        this.logger.log({ event: 'notification_dispatch_batch', ...result });
      }
    } catch {
      this.logger.error({ event: 'notification_dispatch_failed' });
    } finally {
      this.running = false;
    }
  }

  private enabled() {
    const configured = this.configService
      .get<string>('NOTIFICATION_WORKER_ENABLED')
      ?.trim()
      .toLowerCase();
    if (configured === undefined || configured === '') {
      return (
        this.configService.get<string>('NODE_ENV')?.trim().toLowerCase() ===
        'production'
      );
    }
    if (configured === 'true') return true;
    if (configured === 'false') return false;
    throw new Error('NOTIFICATION_WORKER_ENABLED must be true or false.');
  }

  private integer(
    name: string,
    defaultValue: number,
    minimum: number,
    maximum: number,
  ) {
    const configured = this.configService.get<string>(name);
    if (!configured) return defaultValue;
    if (!/^\d+$/.test(configured.trim()))
      throw new Error(`${name} is invalid.`);
    const value = Number(configured);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${name} is invalid.`);
    }
    return value;
  }
}
