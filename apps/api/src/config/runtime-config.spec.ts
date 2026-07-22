import {
  type ConfigurationReader,
  resolveAuthMode,
  resolveCorsAllowedOrigins,
  resolveHost,
  resolvePort,
} from './runtime-config';

function configuration(values: Record<string, string | number | undefined>): ConfigurationReader {
  return {
    get(key: string): unknown {
      return values[key];
    },
  };
}

describe('runtime configuration', () => {
  it('uses Cognito by default', () => {
    expect(resolveAuthMode(configuration({ NODE_ENV: 'development' }))).toBe('cognito');
  });

  it('allows explicit local authentication only in development and test', () => {
    expect(resolveAuthMode(configuration({ NODE_ENV: 'development', AUTH_MODE: 'local' }))).toBe('local');
    expect(resolveAuthMode(configuration({ NODE_ENV: 'test', AUTH_MODE: 'local' }))).toBe('local');
  });

  it('rejects local authentication in production', () => {
    expect(() => resolveAuthMode(configuration({ NODE_ENV: 'production', AUTH_MODE: 'local' }))).toThrow(
      'AUTH_MODE=local is permitted only',
    );
  });

  it('rejects unsupported authentication modes', () => {
    expect(() => resolveAuthMode(configuration({ AUTH_MODE: 'fake-user' }))).toThrow('AUTH_MODE must be either');
  });

  it('provides exact local development origins', () => {
    expect(resolveCorsAllowedOrigins(configuration({}))).toEqual(['http://127.0.0.1:3000', 'http://localhost:3000']);
  });

  it('validates and deduplicates configured exact origins', () => {
    expect(
      resolveCorsAllowedOrigins(
        configuration({
          NODE_ENV: 'production',
          CORS_ALLOWED_ORIGINS: 'https://app.souvenote.com,https://app.souvenote.com',
        }),
      ),
    ).toEqual(['https://app.souvenote.com']);
  });

  it('requires an explicit production allowlist and rejects wildcards', () => {
    expect(() => resolveCorsAllowedOrigins(configuration({ NODE_ENV: 'production' }))).toThrow(
      'CORS_ALLOWED_ORIGINS is required in production',
    );
    expect(() => resolveCorsAllowedOrigins(configuration({ CORS_ALLOWED_ORIGINS: 'https://*.souvenote.com' }))).toThrow(
      'cannot contain wildcards',
    );
  });

  it('rejects origins with paths and invalid host/port values', () => {
    expect(() =>
      resolveCorsAllowedOrigins(configuration({ CORS_ALLOWED_ORIGINS: 'https://souvenote.com/app' })),
    ).toThrow('must be an exact HTTP(S) origin');
    expect(() => resolveHost(configuration({ HOST: 'https://localhost' }))).toThrow(
      'HOST must be a hostname or IP address',
    );
    expect(() => resolveHost(configuration({ HOST: 'localhost:4000' }))).toThrow(
      'HOST must be a hostname or IP address',
    );
    expect(() => resolvePort(configuration({ PORT: 70_000 }))).toThrow('PORT must be an integer');
  });

  it('accepts a configured hostname without a port or scheme', () => {
    expect(resolveHost(configuration({ HOST: 'api-1.souvenote.com' }))).toBe('api-1.souvenote.com');
  });

  it('keeps local authentication bound to loopback only', () => {
    expect(resolveHost(configuration({ NODE_ENV: 'test', AUTH_MODE: 'local', HOST: '127.0.0.1' }))).toBe('127.0.0.1');
    expect(() => resolveHost(configuration({ NODE_ENV: 'test', AUTH_MODE: 'local', HOST: '0.0.0.0' }))).toThrow(
      'requires a loopback HOST',
    );
  });
});
