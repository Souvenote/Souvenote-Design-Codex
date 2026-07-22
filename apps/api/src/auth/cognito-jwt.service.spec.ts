import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import type { ConfigurationReader } from '../config/runtime-config';
import type { AccessTokenClaims } from './auth.types';
import { CognitoJwtService } from './cognito-jwt.service';

const LOCAL_SECRET = 'local-test-secret-that-is-longer-than-thirty-two-bytes';
const LOCAL_ISSUER = 'souvenote-local';
const LOCAL_CLIENT = 'souvenote-local-web';
const REQUIRED_SCOPE = 'souvenote:customer';

function configuration(values: Record<string, string>): ConfigurationReader {
  return { get: (key: string) => values[key] };
}

function validClaims(overrides: Partial<AccessTokenClaims> = {}): AccessTokenClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'subject-1',
    email: 'person@example.test',
    iss: LOCAL_ISSUER,
    client_id: LOCAL_CLIENT,
    token_use: 'access',
    scope: REQUIRED_SCOPE,
    iat: now - 1,
    exp: now + 300,
    ...overrides,
  };
}

function localToken(claims: AccessTokenClaims, secret = LOCAL_SECRET): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`souvenote-local.${payload}`).digest('base64url');
  return `souvenote-local.${payload}.${signature}`;
}

function localService(): CognitoJwtService {
  return new CognitoJwtService(
    configuration({
      NODE_ENV: 'test',
      AUTH_MODE: 'local',
      LOCAL_AUTH_SECRET: LOCAL_SECRET,
      LOCAL_AUTH_CLIENT_ID: LOCAL_CLIENT,
      COGNITO_REQUIRED_SCOPES: REQUIRED_SCOPE,
    }),
  );
}

describe('CognitoJwtService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('accepts a signed local access token without contacting AWS', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(localService().verifyToken(localToken(validClaims()))).resolves.toMatchObject({
      sub: 'subject-1',
      email: 'person@example.test',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['signature', localToken(validClaims(), `${LOCAL_SECRET}-wrong`)],
    ['issuer', localToken(validClaims({ iss: 'other-issuer' }))],
    ['client', localToken(validClaims({ client_id: 'other-client' }))],
    ['token use', localToken(validClaims({ token_use: 'id' }))],
    ['expiry', localToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 1 }))],
    ['not-before', localToken(validClaims({ nbf: Math.floor(Date.now() / 1000) + 3600 }))],
    ['scope', localToken(validClaims({ scope: 'openid' }))],
  ])('rejects a local token with invalid %s', async (_reason, token) => {
    await expect(localService().verifyToken(token)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects local mode in production and rejects short local secrets', () => {
    expect(
      () =>
        new CognitoJwtService(
          configuration({ NODE_ENV: 'production', AUTH_MODE: 'local', LOCAL_AUTH_SECRET: LOCAL_SECRET }),
        ),
    ).toThrow('AUTH_MODE=local is permitted only');
    expect(
      () =>
        new CognitoJwtService(configuration({ NODE_ENV: 'test', AUTH_MODE: 'local', LOCAL_AUTH_SECRET: 'too-short' })),
    ).toThrow('at least 32 bytes');
  });

  it('validates a Cognito RS256 access token against the bounded JWKS response', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' });
    const issuer = 'https://cognito-idp.ca-central-1.amazonaws.com/ca-test';
    const claims = validClaims({ iss: issuer, client_id: 'client-test' });
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'kid-1', alg: 'RS256', use: 'sig' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const service = new CognitoJwtService(
      configuration({
        NODE_ENV: 'test',
        AUTH_MODE: 'cognito',
        COGNITO_REGION: 'ca-central-1',
        COGNITO_USER_POOL_ID: 'ca-test',
        COGNITO_CLIENT_ID: 'client-test',
        COGNITO_REQUIRED_SCOPES: REQUIRED_SCOPE,
      }),
    );

    await expect(service.verifyToken(`${header}.${payload}.${signature}`)).resolves.toMatchObject({ sub: 'subject-1' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await expect(service.verifyToken(`${header}.${payload}.${signature}`)).resolves.toBeDefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed when JWKS retrieval fails or returns an unusable key set', async () => {
    const serviceValues = {
      NODE_ENV: 'test',
      AUTH_MODE: 'cognito',
      COGNITO_REGION: 'ca-central-1',
      COGNITO_USER_POOL_ID: 'ca-test',
      COGNITO_CLIENT_ID: 'client-test',
    };
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'missing' })).toString('base64url')}.${Buffer.from(JSON.stringify(validClaims({ iss: 'https://cognito-idp.ca-central-1.amazonaws.com/ca-test', client_id: 'client-test' }))).toString('base64url')}.invalid`;
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network unavailable'));
    await expect(new CognitoJwtService(configuration(serviceValues)).verifyToken(unsigned)).rejects.toMatchObject({
      status: 503,
    });

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ keys: [] }), { status: 200 }));
    await expect(new CognitoJwtService(configuration(serviceValues)).verifyToken(unsigned)).rejects.toMatchObject({
      status: 503,
    });
  });
});
