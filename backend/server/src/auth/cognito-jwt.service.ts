import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicKey,
  verify,
  type JsonWebKey,
  type KeyObject,
} from 'crypto';
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
  private readonly region: string;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly issuer: string;
  private readonly jwksUri: string;
  private readonly keys = new Map<string, KeyObject>();

  constructor(private readonly configService: ConfigService) {
    this.region = this.readConfig('COGNITO_REGION', 'AWS_REGION');
    this.userPoolId = this.readConfig(
      'COGNITO_USER_POOL_ID',
      'AWS_COGNITO_USER_POOL_ID',
    );
    this.clientId = this.readConfig(
      'COGNITO_CLIENT_ID',
      'AWS_COGNITO_CLIENT_ID',
    );
    this.issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
    this.jwksUri = `${this.issuer}/.well-known/jwks.json`;
  }

  async verifyToken(token: string): Promise<CognitoJwtClaims> {
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
    const value =
      this.configService.get<string>(primaryKey) ??
      this.configService.get<string>(fallbackKey);

    if (!value) {
      throw new Error(`${primaryKey} is missing from environment variables.`);
    }

    return value;
  }

  private decodeSegment<T>(segment: string): T {
    try {
      return JSON.parse(
        Buffer.from(segment, 'base64url').toString('utf8'),
      ) as T;
    } catch {
      throw new UnauthorizedException('Invalid Cognito token payload.');
    }
  }

  private async getSigningKey(kid: string) {
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

  private assertClaims(
    claims: Partial<CognitoJwtClaims>,
  ): asserts claims is CognitoJwtClaims {
    const now = Math.floor(Date.now() / 1000);

    if (claims.iss !== this.issuer) {
      throw new UnauthorizedException('Cognito token issuer did not match.');
    }

    if (claims.token_use !== 'id') {
      throw new UnauthorizedException('Use the Cognito ID token for this API.');
    }

    if (claims.aud !== this.clientId) {
      throw new UnauthorizedException('Cognito token audience did not match.');
    }

    if (!claims.sub || !claims.email) {
      throw new UnauthorizedException(
        'Cognito token is missing required user claims.',
      );
    }

    if (!claims.exp || claims.exp <= now - 60) {
      throw new UnauthorizedException('Cognito token has expired.');
    }

    if (claims.nbf && claims.nbf > now + 60) {
      throw new UnauthorizedException('Cognito token is not valid yet.');
    }
  }
}
