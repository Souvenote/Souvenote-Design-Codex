import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  TOKEN_REFRESH_SKEW_SECONDS,
  TRANSACTION_COOKIE_MAX_AGE_SECONDS,
} from './constants';
import { getBffConfig, getCookieProfile } from './config';
import { createLocalAccessToken, randomBase64Url, sealJson, unsealJson } from './security';
import type { AccessSession, AuthTransaction, CognitoTokenResponse, LocalAccessClaims, RefreshSession } from './types';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function isAccessSession(value: AccessSession | null): value is AccessSession {
  return Boolean(
    value &&
    typeof value.accessToken === 'string' &&
    typeof value.csrfToken === 'string' &&
    typeof value.expiresAt === 'number' &&
    (value.provider === 'cognito' || value.provider === 'local'),
  );
}

function isRefreshSession(value: RefreshSession | null): value is RefreshSession {
  return Boolean(value && typeof value.refreshToken === 'string' && value.provider === 'cognito');
}

function isAuthTransaction(value: AuthTransaction | null): value is AuthTransaction {
  return Boolean(
    value &&
    typeof value.state === 'string' &&
    typeof value.nonce === 'string' &&
    typeof value.verifier === 'string' &&
    typeof value.returnTo === 'string' &&
    typeof value.authPath === 'string' &&
    typeof value.createdAt === 'number',
  );
}

function writeAccessSession(store: CookieStore, session: AccessSession) {
  const config = getBffConfig();
  const profile = getCookieProfile();
  const lifetime = Math.max(
    1,
    Math.min(ACCESS_COOKIE_MAX_AGE_SECONDS, session.expiresAt - Math.floor(Date.now() / 1000)),
  );
  store.set(profile.accessName, sealJson(session, config.sessionSecret), {
    ...profile.common,
    maxAge: lifetime,
  });
}

function writeRefreshSession(store: CookieStore, session: RefreshSession) {
  const config = getBffConfig();
  const profile = getCookieProfile();
  store.set(profile.refreshName, sealJson(session, config.sessionSecret), {
    ...profile.common,
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookies(store: CookieStore) {
  const profile = getCookieProfile();
  for (const name of [profile.accessName, profile.refreshName, profile.transactionName]) {
    store.set(name, '', { ...profile.common, maxAge: 0 });
  }
}

export function createAuthTransaction(store: CookieStore, transaction: AuthTransaction) {
  const config = getBffConfig();
  const profile = getCookieProfile();
  store.set(profile.transactionName, sealJson(transaction, config.sessionSecret), {
    ...profile.common,
    maxAge: TRANSACTION_COOKIE_MAX_AGE_SECONDS,
  });
}

export function consumeAuthTransaction(store: CookieStore) {
  const config = getBffConfig();
  const profile = getCookieProfile();
  const sealed = store.get(profile.transactionName)?.value;
  store.set(profile.transactionName, '', { ...profile.common, maxAge: 0 });
  if (!sealed) return null;
  const transaction = unsealJson<AuthTransaction>(sealed, config.sessionSecret);
  if (!isAuthTransaction(transaction)) return null;
  if (Date.now() - transaction.createdAt > TRANSACTION_COOKIE_MAX_AGE_SECONDS * 1000) return null;
  return transaction;
}

export function establishCognitoSession(store: CookieStore, tokenResponse: CognitoTokenResponse) {
  if (!tokenResponse.access_token || typeof tokenResponse.expires_in !== 'number') {
    throw new Error('Cannot establish a session from an incomplete Cognito response.');
  }

  const accessSession: AccessSession = {
    accessToken: tokenResponse.access_token,
    csrfToken: randomBase64Url(),
    expiresAt: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
    provider: 'cognito',
  };
  writeAccessSession(store, accessSession);
  if (tokenResponse.refresh_token) {
    writeRefreshSession(store, { refreshToken: tokenResponse.refresh_token, provider: 'cognito' });
  }
  return accessSession;
}

export function establishLocalSession(store: CookieStore) {
  const config = getBffConfig();
  if (config.authMode !== 'local' || !config.localAuth) {
    throw new Error('Local authentication is not enabled.');
  }

  const now = Math.floor(Date.now() / 1000);
  const claims: LocalAccessClaims = {
    sub: config.localAuth.subject,
    email: config.localAuth.email,
    iss: 'souvenote-local',
    client_id: config.localAuth.clientId,
    token_use: 'access',
    scope: config.localAuth.scope,
    iat: now,
    exp: now + ACCESS_COOKIE_MAX_AGE_SECONDS,
  };
  const accessSession: AccessSession = {
    accessToken: createLocalAccessToken(claims, config.localAuth.secret),
    csrfToken: randomBase64Url(),
    expiresAt: claims.exp,
    provider: 'local',
  };
  writeAccessSession(store, accessSession);
  return accessSession;
}

export async function getActiveAccessSession(store?: CookieStore) {
  const cookieStore = store ?? (await cookies());
  const config = getBffConfig();
  const profile = getCookieProfile();
  const sealedAccess = cookieStore.get(profile.accessName)?.value;
  if (!sealedAccess) return null;
  const accessSession = unsealJson<AccessSession>(sealedAccess, config.sessionSecret);
  if (!isAccessSession(accessSession)) {
    clearAuthCookies(cookieStore);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (accessSession.expiresAt > now + TOKEN_REFRESH_SKEW_SECONDS) return accessSession;
  if (accessSession.provider !== 'cognito' || config.authMode !== 'cognito' || !config.cognito) {
    clearAuthCookies(cookieStore);
    return null;
  }

  const sealedRefresh = cookieStore.get(profile.refreshName)?.value;
  const refreshSession = sealedRefresh ? unsealJson<RefreshSession>(sealedRefresh, config.sessionSecret) : null;
  if (!isRefreshSession(refreshSession)) {
    clearAuthCookies(cookieStore);
    return null;
  }

  try {
    const { refreshCognitoTokens } = await import('./cognito');
    const refreshed = await refreshCognitoTokens(config.cognito, refreshSession.refreshToken);
    const nextSession: AccessSession = {
      accessToken: refreshed.access_token as string,
      csrfToken: accessSession.csrfToken,
      expiresAt: now + (refreshed.expires_in as number),
      provider: 'cognito',
    };
    writeAccessSession(cookieStore, nextSession);
    if (refreshed.refresh_token) {
      writeRefreshSession(cookieStore, { refreshToken: refreshed.refresh_token, provider: 'cognito' });
    }
    return nextSession;
  } catch {
    clearAuthCookies(cookieStore);
    return null;
  }
}
