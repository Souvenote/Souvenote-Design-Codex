import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, throwError } from 'rxjs';
import { ErrorReportingService } from './error-reporting.service';
import { safeRouteTemplate } from './http-logging.middleware';
import type { RequestWithRequestId } from './request-id.middleware';

@Injectable()
export class ErrorReportingInterceptor implements NestInterceptor {
  constructor(private readonly errorReporting: ErrorReportingService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException ? error.getStatus() : 500;
        if (statusCode >= 500 && context.getType() === 'http') {
          const request = context
            .switchToHttp()
            .getRequest<Request & Partial<RequestWithRequestId>>();
          this.errorReporting.reportException(
            'http_unhandled_exception',
            {
              requestId: request.requestId,
              method: request.method,
              route: safeRouteTemplate(request),
              statusCode,
            },
            error,
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
