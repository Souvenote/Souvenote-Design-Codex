import { HttpException, type ArgumentsHost, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ApiExceptionFilter } from './api-exception.filter';
import { CsrfBoundaryGuard } from './csrf-boundary.guard';
import { IdempotencyGuard } from './idempotency.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { RedactedRequestInterceptor } from './redacted-request.interceptor';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

function httpContext(request: Record<string, unknown>, response: Record<string, unknown> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response, getNext: () => undefined }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

function configuration(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function expectHttpCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error(`Expected HttpException with code ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toMatchObject({ code });
  }
}

describe('common HTTP security boundaries', () => {
  it('rejects BFF cookies at unsafe direct-API boundaries', () => {
    const guard = new CsrfBoundaryGuard();
    expectHttpCode(
      () =>
        guard.canActivate(
          httpContext({ method: 'POST', headers: { cookie: '__Host-souvenote_access=sealed-private-token' } }),
        ),
      'COOKIE_AUTH_NOT_ACCEPTED',
    );
    expect(guard.canActivate(httpContext({ method: 'GET', headers: { cookie: 'souvenote_access=sealed' } }))).toBe(
      true,
    );
  });

  it('requires bounded idempotency keys only for decorated mutations', () => {
    const requiredReflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new IdempotencyGuard(requiredReflector);
    expectHttpCode(() => guard.canActivate(httpContext({ headers: {} })), 'IDEMPOTENCY_KEY_REQUIRED');
    expect(guard.canActivate(httpContext({ headers: { 'idempotency-key': 'valid-request-key-1234' } }))).toBe(true);
  });

  it('enforces per-route limits and keeps attacker-controlled key storage bounded', () => {
    const guard = new RateLimitGuard(
      configuration({ RATE_LIMIT_MAX_REQUESTS: 1, RATE_LIMIT_MAX_KEYS: 2, RATE_LIMIT_WINDOW_MS: 60_000 }),
    );
    const request = (path: string) => ({ ip: '203.0.113.1', method: 'GET', path, socket: {} });
    expect(guard.canActivate(httpContext(request('/one')))).toBe(true);
    expect(() => guard.canActivate(httpContext(request('/one')))).toThrow(HttpException);
    expect(guard.canActivate(httpContext(request('/two')))).toBe(true);
    expectHttpCode(() => guard.canActivate(httpContext(request('/three'))), 'RATE_LIMITED');
  });

  it('logs only route metadata and never request bodies, tokens, or private identity', async () => {
    const interceptor = new RedactedRequestInterceptor();
    const log = jest.fn();
    Object.assign(interceptor, { logger: { log } });
    const request = {
      requestId: 'request-safe-1',
      method: 'POST',
      path: '/api/v1/card-drafts',
      route: { path: '/api/v1/card-drafts' },
      headers: { authorization: 'Bearer secret-token' },
      body: { recipientName: 'Private Person', prompt: 'private prompt' },
      user: { id: 'private-user-id', email: 'private@example.test' },
    };
    await lastValueFrom(
      interceptor.intercept(httpContext(request, { statusCode: 201 }), { handle: () => of({ ok: true }) }),
    );
    const serialized = JSON.stringify(log.mock.calls);
    expect(serialized).toContain('request-safe-1');
    expect(serialized).not.toMatch(/secret-token|Private Person|private prompt|private-user-id|private@example/);
  });

  it('redacts unexpected exception messages and emits only a safe error category', () => {
    const filter = new ApiExceptionFilter();
    const errorLog = jest.fn();
    Object.assign(filter, { logger: { error: errorLog } });
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const request = {
      requestId: 'request-safe-2',
      method: 'POST',
      path: '/api/v1/orders',
    };
    const response = { getHeader: () => undefined, status };
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;
    filter.catch(new Error('token=private-secret recipient=private@example.test'), host);
    expect(json).toHaveBeenCalledWith({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'The service could not complete the request.',
      requestId: 'request-safe-2',
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/private-secret|private@example/);
  });

  it('applies hardened headers and HSTS only in production', () => {
    const responseHeaders = new Map<string, string>();
    const response = { setHeader: (name: string, value: string) => responseHeaders.set(name, value) };
    const next = jest.fn();
    new SecurityHeadersMiddleware(configuration({ NODE_ENV: 'production' })).use({} as never, response as never, next);
    expect(responseHeaders.get('content-security-policy')).toContain("default-src 'none'");
    expect(responseHeaders.get('strict-transport-security')).toContain('max-age=31536000');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
