import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-ID';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RequestWithRequestId = Request & {
  requestId: string;
};

export function selectRequestId(
  headerValue: string | string[] | undefined,
  generate: () => string = randomUUID,
) {
  if (
    typeof headerValue === 'string' &&
    UUID_PATTERN.test(headerValue.trim())
  ) {
    return headerValue.trim().toLowerCase();
  }

  return generate();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const requestId = selectRequestId(request.headers['x-request-id']);
    (request as RequestWithRequestId).requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
