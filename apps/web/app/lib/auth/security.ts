import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { LOCAL_TOKEN_PREFIX } from './constants';
import type { LocalAccessClaims } from './types';

const SEALED_VALUE_VERSION = 'v1';

function encodeBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url');
}

function encryptionKey(secret: string) {
  return createHash('sha256').update(secret, 'utf8').digest();
}

function assertSecret(secret: string, name: string) {
  if (secret.length < 32) {
    throw new Error(`${name} must contain at least 32 characters.`);
  }
}

export function randomBase64Url(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function createPkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isSafeOAuthState(value: string | null): value is string {
  return Boolean(value && value.length >= 32 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value));
}

export function isSafeAuthorizationCode(value: string | null): value is string {
  return Boolean(value && value.length <= 2_048 && !/[\u0000-\u0020\u007f]/.test(value));
}

export function sealJson(value: unknown, secret: string) {
  assertSecret(secret, 'BFF_SESSION_SECRET');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [SEALED_VALUE_VERSION, encodeBase64Url(iv), encodeBase64Url(ciphertext), encodeBase64Url(tag)].join('.');
}

export function unsealJson<T>(sealedValue: string, secret: string): T | null {
  try {
    assertSecret(secret, 'BFF_SESSION_SECRET');
    const [version, ivValue, ciphertextValue, tagValue, extra] = sealedValue.split('.');
    if (version !== SEALED_VALUE_VERSION || !ivValue || !ciphertextValue || !tagValue || extra) return null;

    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), decodeBase64Url(ivValue));
    decipher.setAuthTag(decodeBase64Url(tagValue));
    const plaintext = Buffer.concat([decipher.update(decodeBase64Url(ciphertextValue)), decipher.final()]).toString(
      'utf8',
    );

    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

export function createLocalAccessToken(claims: LocalAccessClaims, secret: string) {
  assertSecret(secret, 'LOCAL_AUTH_SECRET');
  const payload = encodeBase64Url(JSON.stringify(claims));
  const signedValue = `${LOCAL_TOKEN_PREFIX}.${payload}`;
  const signature = createHmac('sha256', secret).update(signedValue, 'utf8').digest('base64url');
  return `${signedValue}.${signature}`;
}

export function verifyLocalAccessToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  assertSecret(secret, 'LOCAL_AUTH_SECRET');
  const [prefix, payload, signature, extra] = token.split('.');
  if (prefix !== LOCAL_TOKEN_PREFIX || !payload || !signature || extra) return null;

  const signedValue = `${LOCAL_TOKEN_PREFIX}.${payload}`;
  const expected = createHmac('sha256', secret).update(signedValue, 'utf8').digest('base64url');
  if (!safeEquals(signature, expected)) return null;

  try {
    const claims = JSON.parse(decodeBase64Url(payload).toString('utf8')) as Partial<LocalAccessClaims>;
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.email !== 'string' ||
      claims.iss !== LOCAL_TOKEN_PREFIX ||
      typeof claims.client_id !== 'string' ||
      claims.token_use !== 'access' ||
      typeof claims.scope !== 'string' ||
      typeof claims.iat !== 'number' ||
      typeof claims.exp !== 'number' ||
      claims.iat > nowSeconds + 60 ||
      claims.exp <= nowSeconds
    ) {
      return null;
    }

    return claims as LocalAccessClaims;
  } catch {
    return null;
  }
}

export function readJwtPayload(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    return JSON.parse(decodeBase64Url(parts[1]).toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}
