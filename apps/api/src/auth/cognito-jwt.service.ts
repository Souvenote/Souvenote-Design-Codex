import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createPublicKey, timingSafeEqual, verify, type JsonWebKey, type KeyObject } from 'node:crypto';
import {
  type AuthMode,
  type ConfigurationReader,
  readPositiveInteger,
  readString,
  resolveAuthMode,
} from '../config/runtime-config';
import type { AccessTokenClaims } from './auth.types';

type JwksResponse = {
  keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string; kty?: string }>;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type CachedKey = {
  key: KeyObject;
  expiresAt: number;
};

const LOCAL_TOKEN_PREFIX = 'souvenote-local';
const MAX_TOKEN_BYTES = 16 * 1024;
const MAX_JWKS_BYTES = 64 * 1024;
const MAX_JWKS_KEYS = 10;

@Injectable()
export class CognitoJwtService {
  private readonly authMode: AuthMode;
  private readonly clientId: string;
  private readonly issuer: string;
  private readonly jwksUri: string | null;
  private readonly localSecret: string | null;
  private readonly requiredScopes: ReadonlySet<string>;
  private readonly clockSkewSeconds: number;
  private readonly jwksCacheMs: number;
  private readonly jwksFetchTimeoutMs: number;
  private readonly keys = new Map<string, CachedKey>();
  private keyRefresh: Promise<void> | null = null;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigurationReader,
  ) {
    this.authMode = resolveAuthMode(this.configService);
    this.clockSkewSeconds = readPositiveInteger(this.configService, 'AUTH_CLOCK_SKEW_SECONDS', 60, 300);
    this.requiredScopes = new Set(
      (readString(this.configService, 'COGNITO_REQUIRED_SCOPES') ?? 'souvenote:customer')
        .split(/[\s,]+/)
        .filter(Boolean),
    );

    if (this.authMode === 'local') {
      this.localSecret = readString(this.configService, 'LOCAL_AUTH_SECRET') ?? '';
      if (Buffer.byteLength(this.localSecret, 'utf8') < 32) {
        throw new Error('LOCAL_AUTH_SECRET must contain at least 32 bytes in local authentication mode.');
      }

      this.clientId = readString(this.configService, 'LOCAL_AUTH_CLIENT_ID') ?? 'souvenote-local-web';
      this.issuer = LOCAL_TOKEN_PREFIX;
      this.jwksUri = null;
      this.jwksCacheMs = 0;
      this.jwksFetchTimeoutMs = 0;
      return;
    }

    const region = this.readConfig('COGNITO_REGION', 'AWS_REGION');
    const userPoolId = this.readConfig('COGNITO_USER_POOL_ID', 'AWS_COGNITO_USER_POOL_ID');
    this.clientId = this.readConfig('COGNITO_CLIENT_ID', 'AWS_COGNITO_CLIENT_ID');
    this.issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    this.jwksUri = `${this.issuer}/.well-known/jwks.json`;
    this.localSecret = null;
    this.jwksCacheMs = readPositiveInteger(this.configService, 'COGNITO_JWKS_CACHE_MS', 3_600_000, 86_400_000);
    this.jwksFetchTimeoutMs = readPositiveInteger(this.configService, 'COGNITO_JWKS_FETCH_TIMEOUT_MS', 2_000, 10_000);
  }

  async verifyToken(token: string): Promise<AccessTokenClaims> {
    if (Buffer.byteLength(token, 'utf8') > MAX_TOKEN_BYTES) {
      throw new UnauthorizedException('Bearer token is too large.');
    }

    return this.authMode === 'local' ? this.verifyLocalToken(token) : this.verifyCognitoToken(token);
  }

  private verifyLocalToken(token: string): AccessTokenClaims {
    const [prefix, payloadSegment, signatureSegment, extra] = token.split('.');
    if (prefix !== LOCAL_TOKEN_PREFIX || !payloadSegment || !signatureSegment || extra !== undefined) {
      throw new UnauthorizedException('Invalid local access token.');
    }

    if (!this.localSecret) {
      throw new ServiceUnavailableException('Local authentication is unavailable.');
    }

    const expected = createHmac('sha256', this.localSecret).update(`${LOCAL_TOKEN_PREFIX}.${payloadSegment}`).digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signatureSegment, 'base64url');
    } catch {
      throw new UnauthorizedException('Invalid local access token signature.');
    }

    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException('Invalid local access token signature.');
    }

    const claims = this.decodeSegment<Partial<AccessTokenClaims>>(payloadSegment);
    this.assertClaims(claims);
    return claims;
  }

  private async verifyCognitoToken(token: string): Promise<AccessTokenClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid bearer token.');
    }

    const header = this.decodeSegment<JwtHeader>(parts[0]);
    const claims = this.decodeSegment<Partial<AccessTokenClaims>>(parts[1]);
    if (header.alg !== 'RS256' || !header.kid || (header.typ && header.typ !== 'JWT')) {
      throw new UnauthorizedException('Unsupported Cognito token header.');
    }

    const key = await this.getSigningKey(header.kid);
    const verified = verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], 'base64url'),
    );
    if (!verified) {
      throw new UnauthorizedException('Invalid Cognito token signature.');
    }

    this.assertClaims(claims);
    return claims;
  }

  private readConfig(primaryKey: string, fallbackKey: string): string {
    const value = readString(this.configService, primaryKey) ?? readString(this.configService, fallbackKey);
    if (!value) throw new Error(`${primaryKey} is missing from environment variables.`);
    return value;
  }

  private decodeSegment<T>(segment: string): T {
    try {
      return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('Invalid access token payload.');
    }
  }

  private async getSigningKey(kid: string): Promise<KeyObject> {
    const cached = this.keys.get(kid);
    if (cached && cached.expiresAt > Date.now()) return cached.key;

    await this.refreshKeys();
    const refreshed = this.keys.get(kid);
    if (!refreshed || refreshed.expiresAt <= Date.now()) {
      throw new UnauthorizedException('Cognito signing key was not found.');
    }
    return refreshed.key;
  }

  private async refreshKeys(): Promise<void> {
    if (!this.jwksUri) throw new ServiceUnavailableException('Cognito authentication is unavailable.');
    if (this.keyRefresh) return this.keyRefresh;

    this.keyRefresh = this.fetchKeys().finally(() => {
      this.keyRefresh = null;
    });
    return this.keyRefresh;
  }

  private async fetchKeys(): Promise<void> {
    let response: Response;
    try {
      response = await fetch(this.jwksUri!, {
        redirect: 'error',
        signal: AbortSignal.timeout(this.jwksFetchTimeoutMs),
        headers: { accept: 'application/json' },
      });
    } catch {
      throw new ServiceUnavailableException('Cognito signing keys are temporarily unavailable.');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Cognito signing keys are temporarily unavailable.');
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_JWKS_BYTES) {
      throw new ServiceUnavailableException('Cognito signing key response exceeded the allowed size.');
    }

    let jwks: JwksResponse;
    try {
      jwks = JSON.parse(raw) as JwksResponse;
    } catch {
      throw new ServiceUnavailableException('Cognito signing key response was invalid.');
    }

    const candidates = (jwks.keys ?? []).slice(0, MAX_JWKS_KEYS);
    const expiresAt = Date.now() + this.jwksCacheMs;
    const nextKeys = new Map<string, CachedKey>();
    for (const jwk of candidates) {
      if (!jwk.kid || jwk.alg !== 'RS256' || jwk.kty !== 'RSA' || (jwk.use && jwk.use !== 'sig')) continue;
      try {
        nextKeys.set(jwk.kid, { key: createPublicKey({ key: jwk, format: 'jwk' }), expiresAt });
      } catch {
        continue;
      }
    }

    if (nextKeys.size === 0) {
      throw new ServiceUnavailableException('Cognito signing key response contained no usable keys.');
    }

    this.keys.clear();
    for (const [keyId, key] of nextKeys) this.keys.set(keyId, key);
  }

  private assertClaims(claims: Partial<AccessTokenClaims>): asserts claims is AccessTokenClaims {
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== this.issuer) throw new UnauthorizedException('Access token issuer did not match.');
    if (claims.token_use !== 'access') throw new UnauthorizedException('Use a Cognito access token for this API.');
    if (claims.client_id !== this.clientId) throw new UnauthorizedException('Access token client did not match.');
    if (typeof claims.sub !== 'string' || !claims.sub.trim()) {
      throw new UnauthorizedException('Access token is missing the subject claim.');
    }
    if (typeof claims.email !== 'string' || !claims.email.trim()) {
      throw new UnauthorizedException('Access token is missing the email claim.');
    }
    if (!Number.isInteger(claims.iat) || claims.iat! > now + this.clockSkewSeconds) {
      throw new UnauthorizedException('Access token issued-at time is invalid.');
    }
    if (!Number.isInteger(claims.exp) || claims.exp! <= now) {
      throw new UnauthorizedException('Access token has expired.');
    }
    if (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > now + this.clockSkewSeconds)) {
      throw new UnauthorizedException('Access token is not valid yet.');
    }

    const scopes = new Set(typeof claims.scope === 'string' ? claims.scope.split(/\s+/).filter(Boolean) : []);
    for (const requiredScope of this.requiredScopes) {
      if (!scopes.has(requiredScope)) throw new UnauthorizedException('Access token is missing a required scope.');
    }
  }
}
