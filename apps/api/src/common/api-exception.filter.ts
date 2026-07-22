import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

type ExceptionBody = { message?: string | string[]; code?: string; details?: Record<string, unknown> };

const STATUS_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId?: string }>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? response.getHeader('x-request-id')?.toString() ?? 'unknown';
    const status = this.statusCode(error);
    const body = error instanceof HttpException ? this.exceptionBody(error) : {};
    const code = body.code ?? STATUS_CODES[status] ?? 'INTERNAL_SERVER_ERROR';
    const message = this.safeMessage(status, body.message);

    if (status >= 500) {
      this.logger.error({
        requestId,
        method: request.method,
        path: request.path,
        status,
        code,
        errorCategory: error instanceof Error ? error.name : 'UnknownError',
        databaseCode: this.safeDatabaseCode(error),
      });
    }

    response.status(status).json({
      code,
      message,
      requestId,
      ...(body.details ? { details: body.details } : {}),
    });
  }

  private exceptionBody(error: HttpException): ExceptionBody {
    const response = error.getResponse();
    if (typeof response === 'string') return { message: response };
    return response && typeof response === 'object' ? response : {};
  }

  private statusCode(error: unknown): number {
    if (error instanceof HttpException) return error.getStatus();
    if (!error || typeof error !== 'object') return HttpStatus.INTERNAL_SERVER_ERROR;
    for (const candidate of ['status', 'statusCode'] as const) {
      const value = error[candidate as keyof typeof error];
      if (typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599) return value;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private safeMessage(status: number, message: string | string[] | undefined): string {
    if (status >= 500) return 'The service could not complete the request.';
    if (Array.isArray(message)) return message.join('; ');
    return message ?? 'The request could not be completed.';
  }

  private safeDatabaseCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
    return typeof error.code === 'string' && /^[A-Z0-9_]{1,16}$/.test(error.code) ? error.code : undefined;
  }
}
