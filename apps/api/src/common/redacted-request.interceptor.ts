import { CallHandler, ExecutionContext, Injectable, Logger, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RedactedRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { requestId?: string; user?: { id: string } }>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log({
          requestId: request.requestId,
          method: request.method,
          path:
            typeof (request.route as { path?: unknown } | undefined)?.path === 'string'
              ? (request.route as { path: string }).path
              : request.path,
          status: response.statusCode,
          durationMs: Date.now() - startedAt,
          authenticated: Boolean(request.user),
        });
      }),
    );
  }
}
