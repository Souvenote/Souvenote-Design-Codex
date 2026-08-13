import type { ConfigurationReader } from '../config/runtime-config';
import { resolveDatabasePoolConfig } from './database.service';

function configuration(values: Record<string, unknown>): ConfigurationReader {
  return { get: (key) => values[key] };
}

describe('resolveDatabasePoolConfig', () => {
  it('uses the local connection URL when supplied', () => {
    expect(
      resolveDatabasePoolConfig(
        configuration({
          DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55432/souvenote',
          DATABASE_SSL_MODE: 'disable',
          NODE_ENV: 'test',
        }),
      ),
    ).toEqual({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:55432/souvenote',
      ssl: undefined,
    });
  });

  it('builds a production pool from separately injected managed-database fields', () => {
    const ca = Buffer.from('-----BEGIN CERTIFICATE-----\ntrusted\n-----END CERTIFICATE-----').toString('base64');
    expect(
      resolveDatabasePoolConfig(
        configuration({
          DATABASE_HOST: 'souvenote.example.ca-central-1.rds.amazonaws.com',
          DATABASE_NAME: 'souvenote_mvp_staging',
          DATABASE_PASSWORD: 'secret-not-logged',
          DATABASE_PORT: '5432',
          DATABASE_SSL_CA_BASE64: ca,
          DATABASE_SSL_MODE: 'verify-full',
          DATABASE_USER: 'souvenote_admin',
          NODE_ENV: 'production',
        }),
      ),
    ).toMatchObject({
      database: 'souvenote_mvp_staging',
      host: 'souvenote.example.ca-central-1.rds.amazonaws.com',
      password: 'secret-not-logged',
      port: 5432,
      user: 'souvenote_admin',
      ssl: { rejectUnauthorized: true },
    });
  });

  it('fails closed when production TLS verification is disabled', () => {
    expect(() =>
      resolveDatabasePoolConfig(
        configuration({
          DATABASE_URL: 'postgresql://example.invalid/souvenote',
          DATABASE_SSL_MODE: 'disable',
          NODE_ENV: 'production',
        }),
      ),
    ).toThrow('Production database connections require DATABASE_SSL_MODE=verify-full.');
  });
});
