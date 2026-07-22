import {
  createPkceChallenge,
  createLocalAccessToken,
  isSafeAuthorizationCode,
  isSafeOAuthState,
  sealJson,
  unsealJson,
  verifyLocalAccessToken,
} from './security';
import { cleanReturnTo, getBffConfig, getCookieProfile, resolveAuthMode, resolveLoopbackRequestOrigin } from './config';
import {
  consumeAuthTransaction,
  createAuthTransaction,
  establishLocalSession,
  getActiveAccessSession,
} from './session';
import { assertSameOriginMutation } from './backend';
import type { AuthTransaction, LocalAccessClaims } from './types';

const sessionSecret = 'test-bff-session-secret-that-is-at-least-32-characters';
const localSecret = 'test-local-auth-secret-that-is-at-least-32-characters';

type StoredCookie = { value: string; options?: Record<string, unknown> };

class MemoryCookieStore {
  readonly values = new Map<string, StoredCookie>();

  get(name: string) {
    const value = this.values.get(name);
    return value ? { name, value: value.value } : undefined;
  }

  set(name: string, value: string, options?: Record<string, unknown>) {
    this.values.set(name, { value, options });
  }
}

function setLocalEnvironment() {
  process.env = {
    ...process.env,
    NODE_ENV: 'test',
    AUTH_MODE: 'local',
    API_INTERNAL_BASE_URL: 'http://127.0.0.1:4000/api/v1',
    BFF_SESSION_SECRET: sessionSecret,
    LOCAL_AUTH_SECRET: localSecret,
    LOCAL_AUTH_CLIENT_ID: 'souvenote-local-web',
    LOCAL_AUTH_SUBJECT: '00000000-0000-4000-8000-000000000001',
    LOCAL_AUTH_EMAIL: 'local@souvenote.invalid',
    LOCAL_AUTH_SCOPE: 'souvenote:customer',
  };
}

describe('web BFF security primitives', () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
    setLocalEnvironment();
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('produces the RFC 7636 S256 challenge and validates bounded callback parameters', () => {
    expect(createPkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    expect(isSafeOAuthState('a'.repeat(43))).toBe(true);
    expect(isSafeOAuthState('short')).toBe(false);
    expect(isSafeOAuthState(`${'a'.repeat(42)}!`)).toBe(false);
    expect(isSafeAuthorizationCode('provider-code_123')).toBe(true);
    expect(isSafeAuthorizationCode(`code\nvalue`)).toBe(false);
    expect(isSafeAuthorizationCode('x'.repeat(2_049))).toBe(false);
  });

  it('encrypts and authenticates cookie payloads and rejects tampering', () => {
    const sealed = sealJson({ accessToken: 'private-token', csrfToken: 'csrf' }, sessionSecret);
    expect(sealed).not.toContain('private-token');
    expect(unsealJson(sealed, sessionSecret)).toEqual({ accessToken: 'private-token', csrfToken: 'csrf' });
    const tamperedSegments = sealed.split('.');
    const ciphertext = tamperedSegments[2] as string;
    tamperedSegments[2] = `${ciphertext.startsWith('a') ? 'b' : 'a'}${ciphertext.slice(1)}`;
    expect(unsealJson(tamperedSegments.join('.'), sessionSecret)).toBeNull();
    expect(unsealJson(sealed, `${sessionSecret}-wrong`)).toBeNull();
  });

  it('creates a credential-free local cookie session that the same BFF boundary can read', async () => {
    const store = new MemoryCookieStore();
    const cookieStore = store as unknown as Parameters<typeof establishLocalSession>[0];
    const session = establishLocalSession(cookieStore);
    expect(session.accessToken).not.toContain('local@souvenote.invalid');
    const profile = getCookieProfile();
    const stored = store.values.get(profile.accessName);
    expect(stored?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
    expect(stored?.value).not.toContain(session.accessToken);
    await expect(getActiveAccessSession(cookieStore)).resolves.toMatchObject({
      provider: 'local',
      csrfToken: session.csrfToken,
    });
  });

  it('consumes state/nonce/PKCE transactions exactly once and rejects expired transactions', () => {
    const store = new MemoryCookieStore();
    const cookieStore = store as unknown as Parameters<typeof createAuthTransaction>[0];
    const transaction: AuthTransaction = {
      state: 's'.repeat(43),
      nonce: 'n'.repeat(43),
      verifier: 'v'.repeat(64),
      returnTo: '/create',
      authPath: '/login',
      createdAt: Date.now(),
    };
    createAuthTransaction(cookieStore, transaction);
    expect(consumeAuthTransaction(cookieStore)).toEqual(transaction);
    expect(consumeAuthTransaction(cookieStore)).toBeNull();

    createAuthTransaction(cookieStore, { ...transaction, createdAt: Date.now() - 11 * 60 * 1000 });
    expect(consumeAuthTransaction(cookieStore)).toBeNull();
  });

  it('signs bounded local access tokens and rejects tampered or expired claims', () => {
    const now = Math.floor(Date.now() / 1000);
    const claims: LocalAccessClaims = {
      sub: 'subject',
      email: 'person@example.test',
      iss: 'souvenote-local',
      client_id: 'souvenote-local-web',
      token_use: 'access',
      scope: 'souvenote:customer',
      iat: now - 1,
      exp: now + 60,
    };
    const token = createLocalAccessToken(claims, localSecret);
    expect(verifyLocalAccessToken(token, localSecret, now)).toEqual(claims);
    expect(verifyLocalAccessToken(`${token}x`, localSecret, now)).toBeNull();
    expect(
      verifyLocalAccessToken(createLocalAccessToken({ ...claims, exp: now }, localSecret), localSecret, now),
    ).toBeNull();
  });

  it('fails closed on production local mode, short secrets, unsafe URLs, and open redirects', () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    expect(resolveAuthMode).toThrow('AUTH_MODE=local is permitted only');

    setLocalEnvironment();
    process.env.BFF_SESSION_SECRET = 'short';
    expect(getBffConfig).toThrow('at least 32 characters');
    process.env.BFF_SESSION_SECRET = sessionSecret;
    process.env.API_INTERNAL_BASE_URL = 'https://shared.example.test/api/v1';
    expect(getBffConfig).toThrow('requires a loopback API_INTERNAL_BASE_URL');
    process.env.API_INTERNAL_BASE_URL = 'http://127.0.0.1:4000/api/v1';
    process.env.API_INTERNAL_BASE_URL = 'https://api.example.test/path';
    expect(getBffConfig).toThrow('requires a loopback API_INTERNAL_BASE_URL');
    expect(cleanReturnTo('https://evil.example/path', '/')).toBe('/');
    expect(cleanReturnTo('//evil.example/path', '/')).toBe('/');
    expect(cleanReturnTo('/create?draft=1', '/')).toBe('/create?draft=1');
  });

  it('requires same-origin browser metadata for cookie-backed mutations', () => {
    const allowed = new Request('http://127.0.0.1:3000/api/bff/api/v1/me', {
      method: 'PATCH',
      headers: { Origin: 'http://127.0.0.1:3000', 'Sec-Fetch-Site': 'same-origin' },
    });
    expect(() => assertSameOriginMutation(allowed)).not.toThrow();

    const denied = new Request('http://127.0.0.1:3000/api/bff/api/v1/me', {
      method: 'PATCH',
      headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
    });
    try {
      assertSameOriginMutation(denied);
      throw new Error('Expected a rejected cross-origin mutation.');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
    }
  });

  it('keeps local redirects on the validated initiating loopback origin', () => {
    expect(
      resolveLoopbackRequestOrigin(
        new Request('http://localhost:3000/api/auth/login', { headers: { Host: '127.0.0.1:3000' } }),
      ),
    ).toBe('http://127.0.0.1:3000');
    expect(() =>
      resolveLoopbackRequestOrigin(
        new Request('http://localhost:3000/api/auth/login', { headers: { Host: 'example.invalid' } }),
      ),
    ).toThrow('loopback origin');
  });

  it('uses __Host secure HttpOnly cookies outside development and test', () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    const profile = getCookieProfile();
    expect(profile.accessName).toBe('__Host-souvenote_access');
    expect(profile.common).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
  });
});
