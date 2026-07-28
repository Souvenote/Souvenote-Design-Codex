import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithRequestId } from './request-id.middleware';

type HttpRequestEvent = {
  event:
    | 'http_request_completed'
    | 'http_request_failed'
    | 'http_request_aborted';
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
};

export function safeRouteTemplate(request: Request) {
  const route = (request as unknown as { route?: unknown }).route;
  if (!route || typeof route !== 'object') {
    return 'unmatched';
  }

  const routePath = (route as Record<string, unknown>).path;
  return typeof routePath === 'string' ? routePath : 'unmatched';
}

function successfulHealthProbe(route: string, statusCode: number) {
  if (statusCode >= 400) {
    return false;
  }

  return ['/health', '/health/live', '/health/ready'].some(
    (suffix) => route === suffix || route.endsWith(`/api${suffix}`),
  );
}

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HttpRequest');

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = performance.now();
    let recorded = false;

    response.once('finish', () => {
      if (recorded) {
        return;
      }
      recorded = true;
      const event =
        response.statusCode >= 400
          ? 'http_request_failed'
          : 'http_request_completed';
      this.writeEvent(event, request, response.statusCode, startedAt);
    });

    response.once('close', () => {
      if (recorded || response.writableEnded) {
        return;
      }
      recorded = true;
      this.writeEvent('http_request_aborted', request, 499, startedAt);
    });

    next();
  }

  private writeEvent(
    event: HttpRequestEvent['event'],
    request: Request,
    statusCode: number,
    startedAt: number,
  ) {
    const route = safeRouteTemplate(request);
    if (successfulHealthProbe(route, statusCode)) {
      return;
    }

    const requestId = (request as Partial<RequestWithRequestId>).requestId;
    const logEvent: HttpRequestEvent = {
      event,
      requestId: requestId ?? 'unavailable',
      method: request.method,
      route,
      statusCode,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };

    if (statusCode >= 500) {
      this.logger.error(logEvent);
    } else if (statusCode >= 400) {
      this.logger.warn(logEvent);
    } else {
      this.logger.log(logEvent);
    }
  }
}
