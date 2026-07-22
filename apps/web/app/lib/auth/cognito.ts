import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createPkceChallenge } from './security';
import type { AuthIntent, AuthTransaction, CognitoSocialProvider, CognitoTokenResponse } from './types';

type CognitoConfig = NonNullable<import('./config').BffConfig['cognito']>;

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const MAX_TOKEN_RESPONSE_BYTES = 64 * 1024;
const MAX_JWT_BYTES = 16 * 1024;

function jwksFor(config: CognitoConfig) {
  let jwks = jwksByIssuer.get(config.issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${config.issuer}/.well-known/jwks.json`), {
      timeoutDuration: 2_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 3_600_000,
    });
    jwksByIssuer.set(config.issuer, jwks);
  }
  return jwks;
}

async function verifyIdToken(config: CognitoConfig, token: string, nonce: string) {
  if (Buffer.byteLength(token, 'utf8') > MAX_JWT_BYTES) throw new Error('Cognito ID token exceeded the allowed size.');
  const { payload, protectedHeader } = await jwtVerify(token, jwksFor(config), {
    algorithms: ['RS256'],
    audience: config.clientId,
    issuer: config.issuer,
    clockTolerance: 30,
  });
  if (protectedHeader.typ && protectedHeader.typ !== 'JWT') throw new Error('Unexpected ID token type.');
  if (payload.token_use !== 'id' || payload.nonce !== nonce) throw new Error('ID token did not match this login.');
  return payload;
}

function tokenEndpoint(config: CognitoConfig) {
  return `${config.domain}/oauth2/token`;
}

async function readTokenResponse(response: Response) {
  let payload: CognitoTokenResponse;
  try {
    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_TOKEN_RESPONSE_BYTES) {
      throw new Error('oversized token response');
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid token response');
    payload = parsed as CognitoTokenResponse;
  } catch {
    throw new Error('Cognito returned an invalid token response.');
  }

  if (!response.ok || payload.error) {
    throw new Error('Cognito could not complete the authorization request.');
  }
  if (
    typeof payload.access_token !== 'string' ||
    payload.access_token.length > MAX_JWT_BYTES ||
    typeof payload.expires_in !== 'number' ||
    payload.expires_in <= 0 ||
    payload.expires_in > 86_400 ||
    (payload.token_type !== undefined && payload.token_type.toLowerCase() !== 'bearer') ||
    (payload.refresh_token !== undefined && typeof payload.refresh_token !== 'string') ||
    (payload.id_token !== undefined && typeof payload.id_token !== 'string')
  ) {
    throw new Error('Cognito returned an incomplete token response.');
  }
  return payload;
}

export function buildCognitoAuthorizationUrl(
  config: CognitoConfig,
  transaction: AuthTransaction,
  intent: AuthIntent,
  provider?: CognitoSocialProvider,
) {
  const endpoint = intent === 'signup' && !provider ? `${config.domain}/signup` : `${config.domain}/oauth2/authorize`;
  const url = new URL(endpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', transaction.state);
  url.searchParams.set('nonce', transaction.nonce);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', createPkceChallenge(transaction.verifier));
  if (provider) url.searchParams.set('identity_provider', provider);
  return url;
}

export async function exchangeCognitoCode(config: CognitoConfig, code: string, transaction: AuthTransaction) {
  const response = await fetch(tokenEndpoint(config), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      code_verifier: transaction.verifier,
      redirect_uri: config.redirectUri,
    }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await readTokenResponse(response);
  if (!payload.id_token) throw new Error('Cognito did not return an ID token for nonce validation.');

  await verifyIdToken(config, payload.id_token, transaction.nonce);

  return payload;
}

export async function refreshCognitoTokens(config: CognitoConfig, refreshToken: string) {
  const response = await fetch(tokenEndpoint(config), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: refreshToken,
    }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  return readTokenResponse(response);
}

export function buildCognitoLogoutUrl(config: CognitoConfig) {
  const url = new URL(`${config.domain}/logout`);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('logout_uri', config.logoutUri);
  return url.toString();
}
