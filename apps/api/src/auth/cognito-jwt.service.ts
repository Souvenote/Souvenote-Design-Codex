import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, verify, type JsonWebKey, type KeyObject } from 'crypto';
import { type AuthMode, type ConfigurationReader, readString, resolveAuthMode } from '../config/runtime-config';
import type { CognitoJwtClaims } from './auth.types';

type JwksResponse = {
  keys?: Array<JsonWebKey & { kid?: string; alg?: string }>;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

@Injectable()
export class CognitoJwtService {
  private readonly authMode: AuthMode;
  private readonly clientId: string | null;
  private readonly issuer: string | null;
  private readonly jwksUri: string | null;
  private readonly keys = new Map<string, KeyObject>();

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigurationReader,
  ) {
    this.authMode = resolveAuthMode(this.configService);

    if (this.authMode === 'disabled') {
      this.clientId = null;
      this.issuer = null;
      this.jwksUri = null;
      return;
    }

    const region = this.readConfig('COGNITO_REGION', 'AWS_REGION');
    const userPoolId = this.readConfig('COGNITO_USER_POOL_ID', 'AWS_COGNITO_USER_POOL_ID');
    this.clientId = this.readConfig('COGNITO_CLIENT_ID', 'AWS_COGNITO_CLIENT_ID');
    this.issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    this.jwksUri = `${this.issuer}/.well-known/jwks.json`;
  }

  async verifyToken(token: string): Promise<CognitoJwtClaims> {
    if (this.authMode === 'disabled') {
      throw new ServiceUnavailableException('Authentication is disabled in this development environment.');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid bearer token.');
    }

    const header = this.decodeSegment<JwtHeader>(parts[0]);
    const claims = this.decodeSegment<Partial<CognitoJwtClaims>>(parts[1]);

    if (header.alg !== 'RS256' || !header.kid) {
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

  private readConfig(primaryKey: string, fallbackKey: string) {
    const value = readString(this.configService, primaryKey) ?? readString(this.configService, fallbackKey);

    if (!value) {
      throw new Error(`${primaryKey} is missing from environment variables.`);
    }

    return value;
  }

  private decodeSegment<T>(segment: string): T {
    try {
      return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('Invalid Cognito token payload.');
    }
  }

  private async getSigningKey(kid: string) {
    if (!this.jwksUri) {
      throw new ServiceUnavailableException('Cognito authentication is unavailable.');
    }

    const cached = this.keys.get(kid);
    if (cached) return cached;

    const response = await fetch(this.jwksUri);
    if (!response.ok) {
      throw new UnauthorizedException('Could not load Cognito signing keys.');
    }

    const jwks = (await response.json()) as JwksResponse;
    for (const jwk of jwks.keys ?? []) {
      if (!jwk.kid) continue;
      this.keys.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
    }

    const key = this.keys.get(kid);
    if (!key) {
      throw new UnauthorizedException('Cognito signing key was not found.');
    }

    return key;
  }

  private assertClaims(claims: Partial<CognitoJwtClaims>): asserts claims is CognitoJwtClaims {
    const now = Math.floor(Date.now() / 1000);

    if (!this.issuer || claims.iss !== this.issuer) {
      throw new UnauthorizedException('Cognito token issuer did not match.');
    }

    if (claims.token_use !== 'id') {
      throw new UnauthorizedException('Use the Cognito ID token for this API.');
    }

    if (!this.clientId || claims.aud !== this.clientId) {
      throw new UnauthorizedException('Cognito token audience did not match.');
    }

    if (!claims.sub || !claims.email) {
      throw new UnauthorizedException('Cognito token is missing required user claims.');
    }

    if (!claims.exp || claims.exp <= now - 60) {
      throw new UnauthorizedException('Cognito token has expired.');
    }

    if (claims.nbf && claims.nbf > now + 60) {
      throw new UnauthorizedException('Cognito token is not valid yet.');
    }
  }
}
