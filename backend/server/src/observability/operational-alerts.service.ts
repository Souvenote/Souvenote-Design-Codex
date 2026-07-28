import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ErrorReportingService } from './error-reporting.service';

export type OperationalAlertName =
  | 'payment_reconciliation_backlog'
  | 'moderation_queue_stale'
  | 'generation_refund_spike'
  | 'fulfillment_hold_backlog';

type AlertCountRow = QueryResultRow & {
  alert_name: OperationalAlertName;
  alert_count: number | string;
};

export const OPERATIONAL_ALERT_QUERY = `
  SELECT
    'payment_reconciliation_backlog'::text AS alert_name,
    (
      (
        SELECT COUNT(*)
        FROM payments
        WHERE provider_mode = 'stripe'
          AND (
            (
              status IN ('creating', 'checkout_started')
              AND updated_at < NOW() - ($1::integer * INTERVAL '1 minute')
            )
            OR (
              status = 'authorized'
              AND updated_at < NOW() - ($2::integer * INTERVAL '1 hour')
            )
          )
      )
      +
      (
        SELECT COUNT(*)
        FROM stripe_webhook_events
        WHERE status = 'processing'
          AND updated_at < NOW() - ($1::integer * INTERVAL '1 minute')
      )
    )::integer AS alert_count
  UNION ALL
  SELECT
    'moderation_queue_stale',
    COUNT(*)::integer
  FROM asset_moderation_jobs
  WHERE status IN ('pending', 'running')
    AND created_at < NOW() - ($3::integer * INTERVAL '1 minute')
  UNION ALL
  SELECT
    'generation_refund_spike',
    COUNT(*)::integer
  FROM generation_jobs
  WHERE refunded_at >= NOW() - ($4::integer * INTERVAL '1 minute')
  UNION ALL
  SELECT
    'fulfillment_hold_backlog',
    COUNT(*)::integer
  FROM fulfillment_jobs
  WHERE provider_mode = 'scribeless'
    AND status IN ('on_hold', 'submission_unknown', 'failed');
`;

@Injectable()
export class OperationalAlertsService {
  private readonly logger = new Logger(OperationalAlertsService.name);
  private readonly lastReportedAt = new Map<OperationalAlertName, number>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly errorReporting: ErrorReportingService,
  ) {}

  async evaluateNow(now = Date.now()) {
    const result = await this.databaseService.query<AlertCountRow>(
      OPERATIONAL_ALERT_QUERY,
      [
        this.integer('PAYMENT_RECONCILIATION_ALERT_AGE_MINUTES', 15, 1, 10_080),
        this.integer('PAYMENT_AUTHORIZATION_ALERT_AGE_HOURS', 144, 1, 720),
        this.integer('MODERATION_QUEUE_ALERT_AGE_MINUTES', 60, 1, 10_080),
        this.integer('GENERATION_REFUND_ALERT_WINDOW_MINUTES', 15, 1, 1_440),
      ],
    );
    const counts = new Map(
      result.rows.map((row) => [row.alert_name, Number(row.alert_count)]),
    );
    const thresholds: Record<OperationalAlertName, number> = {
      payment_reconciliation_backlog: this.integer(
        'PAYMENT_RECONCILIATION_ALERT_THRESHOLD',
        1,
        1,
        100_000,
      ),
      moderation_queue_stale: this.integer(
        'MODERATION_QUEUE_ALERT_THRESHOLD',
        10,
        1,
        100_000,
      ),
      generation_refund_spike: this.integer(
        'GENERATION_REFUND_ALERT_THRESHOLD',
        5,
        1,
        100_000,
      ),
      fulfillment_hold_backlog: this.integer(
        'FULFILLMENT_HOLD_ALERT_THRESHOLD',
        1,
        1,
        100_000,
      ),
    };
    const cooldownMs = this.integer(
      'OPERATIONAL_ALERT_REPEAT_MS',
      3_600_000,
      60_000,
      86_400_000,
    );

    for (const [alert, threshold] of Object.entries(thresholds) as Array<
      [OperationalAlertName, number]
    >) {
      const count = counts.get(alert) ?? 0;
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new InternalServerErrorException(
          'Operational alert query returned an invalid count.',
        );
      }
      if (count < threshold) {
        this.lastReportedAt.delete(alert);
        continue;
      }

      const lastReportedAt = this.lastReportedAt.get(alert);
      if (lastReportedAt !== undefined && now - lastReportedAt < cooldownMs) {
        continue;
      }
      this.lastReportedAt.set(alert, now);
      this.logger.error({
        event: 'operational_alert',
        alert,
        count,
        threshold,
      });
      this.errorReporting.reportOperationalAlert(alert, count, threshold);
    }

    return Object.fromEntries(counts);
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
