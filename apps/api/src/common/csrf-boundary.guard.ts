import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BFF_AUTH_COOKIES = [
  '__Host-souvenote_access=',
  '__Host-souvenote_refresh=',
  '__Host-souvenote_auth_tx=',
  'souvenote_access=',
  'souvenote_refresh=',
  'souvenote_auth_tx=',
];

@Injectable()
export class CsrfBoundaryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!UNSAFE_METHODS.has(request.method)) return true;

    const cookie = request.headers.cookie ?? '';
    if (BFF_AUTH_COOKIES.some((name) => cookie.includes(name))) {
      throw new ForbiddenException({
        code: 'COOKIE_AUTH_NOT_ACCEPTED',
        message: 'Browser session cookies must be validated by the Souvenote BFF before calling this API.',
      });
    }
    return true;
  }
}
