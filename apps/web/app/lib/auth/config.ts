import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import {
  AUTH_ACCESS_COOKIE,
  AUTH_REFRESH_COOKIE,
  AUTH_TRANSACTION_COOKIE,
  DEFAULT_AUTH_SCOPES,
  PRODUCTION_AUTH_ACCESS_COOKIE,
  PRODUCTION_AUTH_REFRESH_COOKIE,
  PRODUCTION_AUTH_TRANSACTION_COOKIE,
} from './constants';
import type { AuthMode } from './types';

export type BffConfig = {
  authMode: AuthMode;
  apiBaseUrl: string;
  sessionSecret: string;
  localAuth?: {
    secret: string;
    clientId: string;
    subject: string;
    email: string;
    scope: string;
  };
  cognito?: {
    domain: string;
    issuer: string;
    clientId: string;
    redirectUri: string;
    logoutUri: string;
    scopes: string[];
  };
};

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function requiredSecret(name: string) {
  const value = requiredEnvironment(name);
  if (value.length < 32) throw new Error(`${name} must contain at least 32 characters.`);
  return value;
}

function isDevelopmentOrTest() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

function validateHttpUrl(value: string, name: string, allowLoopbackHttp: boolean) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }

  const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(allowLoopbackHttp && isLoopback && url.protocol === 'http:')) {
    throw new Error(`${name} must use HTTPS${allowLoopbackHttp ? ' or loopback HTTP' : ''}.`);
  }
  if (url.username || url.password || url.hash) {
    throw new Error(`${name} cannot contain credentials or a fragment.`);
  }

  return url.toString().replace(/\/$/, '');
}

function requireOrigin(value: string, name: string, allowLoopbackHttp: boolean) {
  const normalized = validateHttpUrl(value, name, allowLoopbackHttp);
  const url = new URL(normalized);
  if (url.pathname !== '/' || url.search) throw new Error(`${name} must contain only an HTTPS origin.`);
  return url.origin;
}

function requireUrlWithoutQuery(value: string, name: string, allowLoopbackHttp: boolean) {
  const normalized = validateHttpUrl(value, name, allowLoopbackHttp);
  if (new URL(normalized).search) throw new Error(`${name} cannot contain a query string.`);
  return normalized;
}

export function isLoopbackHostname(hostname: string) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1';
}

export function resolveLoopbackRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get('host')?.trim();
  if (!host || /[\\/\s]/.test(host)) throw new Error('A valid loopback Host header is required.');

  const origin = new URL(`${requestUrl.protocol}//${host}`);
  if (
    (origin.protocol !== 'http:' && origin.protocol !== 'https:') ||
    !isLoopbackHostname(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('Local authentication requires an exact loopback origin.');
  }
  return origin.origin;
}

export function resolveAuthMode(): AuthMode {
  const configured = process.env.AUTH_MODE?.trim().toLowerCase() || 'cognito';
  if (configured !== 'cognito' && configured !== 'local') {
    throw new Error('AUTH_MODE must be either "cognito" or "local" for the web BFF.');
  }
  if (configured === 'local' && !isDevelopmentOrTest()) {
    throw new Error('AUTH_MODE=local is permitted only when NODE_ENV is development or test.');
  }
  return configured;
}

export function getBffConfig(): BffConfig {
  const authMode = resolveAuthMode();
  const allowLoopbackHttp = isDevelopmentOrTest();
  const apiBaseUrl = validateHttpUrl(
    process.env.API_INTERNAL_BASE_URL?.trim() || 'http://127.0.0.1:4000/api/v1',
    'API_INTERNAL_BASE_URL',
    true,
  );
  const sessionSecret = requiredSecret('BFF_SESSION_SECRET');
  if (!isLoopbackHostname(new URL(apiBaseUrl).hostname)) {
    throw new Error('The Souvenote BFF requires a loopback API_INTERNAL_BASE_URL.');
  }

  if (authMode === 'local') {
    return {
      authMode,
      apiBaseUrl,
      sessionSecret,
      localAuth: {
        secret: requiredSecret('LOCAL_AUTH_SECRET'),
        clientId: process.env.LOCAL_AUTH_CLIENT_ID?.trim() || 'souvenote-local-web',
        subject: process.env.LOCAL_AUTH_SUBJECT?.trim() || '00000000-0000-4000-8000-000000000001',
        email: process.env.LOCAL_AUTH_EMAIL?.trim() || 'local@souvenote.invalid',
        scope: process.env.LOCAL_AUTH_SCOPE?.trim() || 'souvenote/customer',
      },
    };
  }

  const scopes = (process.env.COGNITO_OAUTH_SCOPES || DEFAULT_AUTH_SCOPES.join(' '))
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (!scopes.includes('openid')) throw new Error('COGNITO_OAUTH_SCOPES must include openid.');
  if (!scopes.includes('souvenote/customer')) {
    throw new Error('COGNITO_OAUTH_SCOPES must include souvenote/customer.');
  }

  return {
    authMode,
    apiBaseUrl,
    sessionSecret,
    cognito: {
      domain: requireOrigin(requiredEnvironment('COGNITO_DOMAIN'), 'COGNITO_DOMAIN', allowLoopbackHttp),
      issuer: requireUrlWithoutQuery(requiredEnvironment('COGNITO_ISSUER'), 'COGNITO_ISSUER', allowLoopbackHttp),
      clientId: requiredEnvironment('COGNITO_CLIENT_ID'),
      redirectUri: requireUrlWithoutQuery(
        requiredEnvironment('COGNITO_REDIRECT_URI'),
        'COGNITO_REDIRECT_URI',
        allowLoopbackHttp,
      ),
      logoutUri: requireUrlWithoutQuery(
        requiredEnvironment('COGNITO_LOGOUT_URI'),
        'COGNITO_LOGOUT_URI',
        allowLoopbackHttp,
      ),
      scopes,
    },
  };
}

export function getCookieProfile() {
  const localRuntime = isDevelopmentOrTest();
  const common: Pick<ResponseCookie, 'httpOnly' | 'sameSite' | 'secure' | 'path'> = {
    httpOnly: true,
    sameSite: 'lax',
    secure: !localRuntime,
    path: '/',
  };

  return {
    accessName: localRuntime ? AUTH_ACCESS_COOKIE : PRODUCTION_AUTH_ACCESS_COOKIE,
    refreshName: localRuntime ? AUTH_REFRESH_COOKIE : PRODUCTION_AUTH_REFRESH_COOKIE,
    transactionName: localRuntime ? AUTH_TRANSACTION_COOKIE : PRODUCTION_AUTH_TRANSACTION_COOKIE,
    common,
  };
}

export function cleanReturnTo(value: string | null | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, 'https://souvenote.invalid');
    if (parsed.origin !== 'https://souvenote.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
