import {
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorReportingService } from './error-reporting.service';
import { OperationalAlertsService } from './operational-alerts.service';

@Injectable()
export class OperationalAlertsWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OperationalAlertsWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly alerts: OperationalAlertsService,
    private readonly errorReporting: ErrorReportingService,
  ) {}

  onApplicationBootstrap() {
    if (!this.enabled()) return;
    void this.tick();
    this.timer = setInterval(
      () => void this.tick(),
      this.integer('OPERATIONAL_ALERTS_INTERVAL_MS', 60_000, 60_000, 3_600_000),
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
      await this.alerts.evaluateNow();
    } catch (error) {
      this.logger.error({ event: 'operational_alert_evaluation_failed' });
      this.errorReporting.reportException(
        'operational_alert_evaluation_failed',
        { operation: 'alert_evaluation', outcome: 'error' },
        error,
      );
    } finally {
      this.running = false;
    }
  }

  private enabled() {
    const configured = this.configService
      .get<string>('OPERATIONAL_ALERTS_ENABLED')
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
      'OPERATIONAL_ALERTS_ENABLED must be true or false.',
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
