import { ConfigService } from '@nestjs/config';
import { readDatabasePoolConfig } from './database.config';

function config(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((name: string) => values[name]),
  } as unknown as ConfigService;
}

describe('readDatabasePoolConfig', () => {
  it('applies bounded production-safe defaults', () => {
    expect(
      readDatabasePoolConfig(
        config({ DATABASE_URL: ' postgres://db.example/souvenote ' }),
      ),
    ).toEqual({
      connectionString: 'postgres://db.example/souvenote',
      application_name: 'souvenote-backend',
      keepAlive: true,
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      query_timeout: 30_000,
      statement_timeout: 30_000,
      ssl: undefined,
    });
  });

  it('accepts discrete database connection settings for managed runtimes', () => {
    expect(
      readDatabasePoolConfig(
        config({
          DATABASE_HOST: 'db.internal',
          DATABASE_PORT: '5433',
          DATABASE_NAME: 'souvenote',
          DATABASE_USER: 'app',
          DATABASE_PASSWORD: 'secret',
        }),
      ),
    ).toMatchObject({
      host: 'db.internal',
      port: 5433,
      database: 'souvenote',
      user: 'app',
      password: 'secret',
    });
  });

  it('accepts valid explicit limits', () => {
    expect(
      readDatabasePoolConfig(
        config({
          DATABASE_URL: 'postgres://db.example/souvenote',
          DATABASE_POOL_MAX: '25',
          DATABASE_CONNECTION_TIMEOUT_MS: '10000',
          DATABASE_IDLE_TIMEOUT_MS: '60000',
          DATABASE_QUERY_TIMEOUT_MS: '120000',
        }),
      ),
    ).toMatchObject({
      max: 25,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 60_000,
      query_timeout: 120_000,
      statement_timeout: 120_000,
    });
  });

  it('rejects missing URL and discrete connection settings', () => {
    expect(() => readDatabasePoolConfig(config({}))).toThrow(
      'DATABASE_HOST is missing from environment variables.',
    );
    expect(() =>
      readDatabasePoolConfig(config({ DATABASE_URL: '   ' })),
    ).toThrow('DATABASE_HOST is missing from environment variables.');
  });

  it.each([
    ['DATABASE_POOL_MAX', '0'],
    ['DATABASE_POOL_MAX', '101'],
    ['DATABASE_CONNECTION_TIMEOUT_MS', '99'],
    ['DATABASE_IDLE_TIMEOUT_MS', '600001'],
    ['DATABASE_QUERY_TIMEOUT_MS', '30.5'],
    ['DATABASE_QUERY_TIMEOUT_MS', 'not-a-number'],
  ])('rejects invalid %s=%s', (name, value) => {
    expect(() =>
      readDatabasePoolConfig(
        config({
          DATABASE_URL: 'postgres://db.example/souvenote',
          [name]: value,
        }),
      ),
    ).toThrow(name);
  });
});
