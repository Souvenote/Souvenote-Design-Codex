import type { ErrorEvent } from '@sentry/node';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SENTRY_ADAPTER, type SentryAdapter } from './sentry.adapter';

export type SafeErrorContext = {
  requestId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  provider?: string;
  operation?: string;
  outcome?: string;
};

export function scrubSentryEvent(event: ErrorEvent) {
  delete event.request;
  delete event.user;
  delete event.contexts;
  delete event.extra;
  delete event.breadcrumbs;
  delete event.modules;
  delete event.transaction;
  return event;
}

@Injectable()
export class ErrorReportingService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(ErrorReportingService.name);
  private initialized = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SENTRY_ADAPTER) private readonly sentry: SentryAdapter,
  ) {}

  onModuleInit() {
    this.initialize();
  }

  async onApplicationShutdown() {
    if (!this.initialized) return;
    await this.sentry.close(
      this.integer('SENTRY_FLUSH_TIMEOUT_MS', 2_000, 100, 10_000),
    );
    this.initialized = false;
  }

  reportException(code: string, context: SafeErrorContext, original?: unknown) {
    if (!this.initialize()) return;
    const safeCode = this.safeTag(code, 'error_report');
    const safeContext = this.safeContext(context);
    const exception = this.safeException(safeCode, original);

    try {
      this.sentry.withScope((scope) => {
        scope.setTags(safeContext);
        scope.setFingerprint([
          safeCode,
          safeContext.provider ?? safeContext.route ?? 'backend',
          safeContext.operation ?? String(safeContext.statusCode ?? 500),
        ]);
        scope.captureException(exception);
      });
    } catch {
      this.logger.warn({
        event: 'external_error_report_failed',
        code: safeCode,
      });
    }
  }

  reportOperationalAlert(name: string, count: number, threshold: number) {
    if (!this.initialize()) return;
    const safeName = this.safeTag(name, 'operational_alert');
    try {
      this.sentry.withScope((scope) => {
        scope.setLevel('error');
        scope.setTags({
          alert: safeName,
          count: String(this.safeInteger(count)),
          threshold: String(this.safeInteger(threshold)),
        });
        scope.setFingerprint(['operational_alert', safeName]);
        scope.captureMessage(`operational_alert:${safeName}`);
      });
    } catch {
      this.logger.warn({
        event: 'external_operational_alert_failed',
        alert: safeName,
      });
    }
  }

  private initialize() {
    if (this.initialized) return true;
    const mode = this.mode();
    if (mode === 'disabled') return false;
    const dsn = this.dsn();

    this.sentry.init({
      dsn,
      environment:
        this.configService.get<string>('SENTRY_ENVIRONMENT')?.trim() ||
        this.configService.get<string>('NODE_ENV')?.trim() ||
        'development',
      release:
        this.configService.get<string>('SENTRY_RELEASE')?.trim() || undefined,
      sendDefaultPii: false,
      sampleRate: 1,
      tracesSampleRate: 0,
      beforeSend: scrubSentryEvent,
    });
    this.initialized = true;
    return true;
  }

  private mode() {
    const environment = (
      this.configService.get<string>('NODE_ENV') ?? 'development'
    )
      .trim()
      .toLowerCase();
    const configured = this.configService
      .get<string>('ERROR_REPORTING_MODE')
      ?.trim()
      .toLowerCase();
    const productionPreview =
      this.configService
        .get<string>('PRODUCTION_PREVIEW_MODE')
        ?.trim()
        .toLowerCase() === 'true';
    const mode =
      configured || (environment === 'production' ? 'sentry' : 'disabled');
    if (
      environment === 'production' &&
      !productionPreview &&
      mode !== 'sentry'
    ) {
      throw new InternalServerErrorException(
        'Production error reporting must use ERROR_REPORTING_MODE=sentry.',
      );
    }
    if (mode !== 'disabled' && mode !== 'sentry') {
      throw new InternalServerErrorException(
        'ERROR_REPORTING_MODE must be disabled or sentry.',
      );
    }
    return mode;
  }

  private dsn() {
    const configured = this.configService.get<string>('SENTRY_DSN')?.trim();
    if (!configured) {
      throw new InternalServerErrorException(
        'SENTRY_DSN is required in Sentry error-reporting mode.',
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      throw new InternalServerErrorException('SENTRY_DSN is invalid.');
    }
    if (
      parsed.protocol !== 'https:' ||
      !parsed.username ||
      parsed.password ||
      !/^\/\d+\/?$/.test(parsed.pathname)
    ) {
      throw new InternalServerErrorException(
        'SENTRY_DSN must be a credential-safe HTTPS Sentry project DSN.',
      );
    }
    return configured;
  }

  private safeException(code: string, original: unknown) {
    const exception = new Error(code);
    const originalName =
      original instanceof Error &&
      /^[A-Za-z][A-Za-z0-9_]{0,80}$/.test(original.name)
        ? original.name
        : 'BackendError';
    exception.name = originalName;
    if (original instanceof Error && original.stack) {
      const frames = original.stack
        .split(/\r?\n/)
        .slice(1, 31)
        .map((line) => this.safeStackLine(line));
      exception.stack = `${originalName}: ${code}\n${frames.join('\n')}`;
    }
    return exception;
  }

  private safeStackLine(line: string) {
    return line
      .replaceAll(process.cwd(), '<app>')
      .replace(/([A-Za-z]:\\Users\\|\/(?:home|Users)\/)[^/\\]+/g, '$1<user>')
      .slice(0, 500);
  }

  private safeContext(context: SafeErrorContext) {
    const tags: Record<string, string> = {};
    if (context.requestId) {
      tags.requestId = this.safeTag(context.requestId, 'unavailable');
    }
    if (context.method) {
      tags.method = this.safeTag(context.method, 'UNKNOWN');
    }
    if (context.route) tags.route = this.safeRoute(context.route);
    if (context.statusCode !== undefined) {
      tags.statusCode = String(this.safeInteger(context.statusCode));
    }
    if (context.provider) {
      tags.provider = this.safeTag(context.provider, 'unknown');
    }
    if (context.operation) {
      tags.operation = this.safeTag(context.operation, 'unknown');
    }
    if (context.outcome) {
      tags.outcome = this.safeTag(context.outcome, 'unknown');
    }
    return tags;
  }

  private safeRoute(route: string) {
    return /^\/[A-Za-z0-9_{}*?/:.-]{0,199}$/.test(route) ? route : 'unmatched';
  }

  private safeTag(value: string, fallback: string) {
    const normalized = value.trim();
    return /^[A-Za-z0-9_:/{}*?.-]{1,200}$/.test(normalized)
      ? normalized
      : fallback;
  }

  private safeInteger(value: number) {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
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
