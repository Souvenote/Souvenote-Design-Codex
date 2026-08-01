import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { LocalUser } from '../cognitoAuth';
import { AUTH_CSRF_HEADER, MAX_PROXY_BODY_BYTES } from './constants';
import { getBffConfig, resolveAuthMode, resolveLoopbackRequestOrigin } from './config';
import { safeEquals } from './security';
import { getActiveAccessSession } from './session';
import type { AccessSession } from './types';

const PUBLIC_PROXY_PATHS = new Set(['pricing']);
const FORWARDED_REQUEST_HEADERS = new Set(['accept', 'content-type', 'idempotency-key', 'if-match']);
const FORWARDED_RESPONSE_HEADERS = new Set(['content-type', 'etag', 'location', 'retry-after']);

function requestIdFor(request: Request): string {
  const supplied = request.headers.get('x-request-id');
  return supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
}

export function apiError(status: number, code: string, message: string, requestId: string = randomUUID()) {
  return NextResponse.json(
    { code, message, requestId },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId,
      },
    },
  );
}

function validateProxyPath(path: string[]) {
  return (
    path.length > 0 &&
    path.every(
      (segment) =>
        segment.length > 0 &&
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('/') &&
        !segment.includes('\\') &&
        !/[\u0000-\u001f\u007f]/.test(segment),
    )
  );
}

function isMutation(method: string) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

async function readBoundedBody(request: Request, requestId: string) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_PROXY_BODY_BYTES) {
    throw apiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.', requestId);
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_PROXY_BODY_BYTES) {
    throw apiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.', requestId);
  }
  return body.byteLength > 0 ? body : undefined;
}

async function requireMutationCsrf(request: Request, session: AccessSession | null, requestId: string) {
  if (!session) throw apiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.', requestId);
  assertSameOriginMutation(request, requestId);
  const supplied = request.headers.get(AUTH_CSRF_HEADER);
  if (!supplied || !safeEquals(supplied, session.csrfToken)) {
    throw apiError(403, 'CSRF_VALIDATION_FAILED', 'The request could not be verified.', requestId);
  }
}

export function assertSameOriginMutation(request: Request, requestId: string = randomUUID()) {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  let expectedOrigin: string;
  try {
    expectedOrigin =
      resolveAuthMode() === 'local' ? resolveLoopbackRequestOrigin(request) : new URL(request.url).origin;
  } catch {
    throw apiError(403, 'CSRF_ORIGIN_REJECTED', 'Cross-origin mutation requests are not accepted.', requestId);
  }
  if (origin !== expectedOrigin || (fetchSite && fetchSite !== 'same-origin')) {
    throw apiError(403, 'CSRF_ORIGIN_REJECTED', 'Cross-origin mutation requests are not accepted.', requestId);
  }
}

function backendHeaders(request: Request, requestId: string, session: AccessSession | null) {
  const headers = new Headers();
  for (const [name, value] of request.headers.entries()) {
    if (FORWARDED_REQUEST_HEADERS.has(name.toLowerCase())) headers.set(name, value);
  }
  headers.set('X-Request-Id', requestId);
  if (session) headers.set('Authorization', `Bearer ${session.accessToken}`);
  return headers;
}

export async function proxyApiRequest(request: Request, path: string[]) {
  const requestId = requestIdFor(request);
  if (!validateProxyPath(path)) return apiError(400, 'INVALID_PROXY_PATH', 'The API path is invalid.', requestId);

  if (path[0] !== 'api' || path[1] !== 'v1' || path.length < 3) {
    return apiError(404, 'NOT_FOUND', 'API route not found.', requestId);
  }
  const upstreamPath = path.slice(2);

  const session = await getActiveAccessSession();
  const publicPath = upstreamPath.length === 1 && PUBLIC_PROXY_PATHS.has(upstreamPath[0]);
  if (!session && !publicPath) {
    return apiError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.', requestId);
  }

  try {
    if (isMutation(request.method)) await requireMutationCsrf(request, session, requestId);
    const body = isMutation(request.method) ? await readBoundedBody(request, requestId) : undefined;
    const config = getBffConfig();
    const target = new URL(`${config.apiBaseUrl}/${upstreamPath.map(encodeURIComponent).join('/')}`);
    const incomingUrl = new URL(request.url);
    target.search = incomingUrl.search;

    const backendResponse = await fetch(target, {
      method: request.method,
      headers: backendHeaders(request, requestId, session),
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    const responseHeaders = new Headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': backendResponse.headers.get('x-request-id') || requestId,
    });
    for (const [name, value] of backendResponse.headers.entries()) {
      if (FORWARDED_RESPONSE_HEADERS.has(name.toLowerCase())) responseHeaders.set(name, value);
    }
    return new NextResponse(backendResponse.body, { status: backendResponse.status, headers: responseHeaders });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return apiError(502, 'UPSTREAM_UNAVAILABLE', 'The Souvenote API is temporarily unavailable.', requestId);
  }
}

export async function fetchCurrentUser(session: AccessSession) {
  const config = getBffConfig();
  const requestId = randomUUID();
  const response = await fetch(`${config.apiBaseUrl}/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      'X-Request-Id': requestId,
    },
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { user?: unknown; data?: unknown };
  const candidate = (payload.user || payload.data) as
    | (Partial<LocalUser> & {
        firstName?: string | null;
        lastName?: string | null;
        marketingOptIn?: boolean | null;
        createdAt?: string;
        updatedAt?: string;
      })
    | undefined;
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.email !== 'string') return null;
  return {
    ...candidate,
    first_name: candidate.firstName ?? candidate.first_name ?? null,
    last_name: candidate.lastName ?? candidate.last_name ?? null,
    marketing_opt_in: candidate.marketingOptIn ?? candidate.marketing_opt_in ?? false,
    created_at: candidate.createdAt ?? candidate.created_at,
    updated_at: candidate.updatedAt ?? candidate.updated_at,
  } as LocalUser;
}
