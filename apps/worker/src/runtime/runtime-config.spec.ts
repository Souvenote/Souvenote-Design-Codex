import { readWorkerRuntimeConfig } from './runtime-config';

const validEnvironment = (): NodeJS.ProcessEnv => ({
  AUTH_MODE: 'disabled',
  DATABASE_URL: 'postgresql://souvenote:souvenote_local@127.0.0.1:55432/souvenote',
  EMAIL_PROVIDER_MODE: 'disabled',
  FULFILLMENT_PROVIDER_MODE: 'disabled',
  IMAGE_PROVIDER_MODE: 'mock',
  MUSIC_PROVIDER_MODE: 'disabled',
  NODE_ENV: 'test',
  NOTIFICATION_PROVIDER_MODE: 'disabled',
  PAYMENT_PROVIDER_MODE: 'disabled',
  TEXT_PROVIDER_MODE: 'mock',
  WORKER_MODE: 'idle',
  WORKER_PORT: '4001',
  TRY_RISK_FREE_RESOLVER_ENABLED: 'false',
});

describe('readWorkerRuntimeConfig', () => {
  it('accepts only an idle, non-live local profile', () => {
    expect(readWorkerRuntimeConfig(validEnvironment())).toEqual(
      expect.objectContaining({
        authMode: 'disabled',
        imageProviderMode: 'mock',
        port: 4001,
        workerMode: 'idle',
      }),
    );
  });

  it('rejects live provider traffic', () => {
    expect(() =>
      readWorkerRuntimeConfig({
        ...validEnvironment(),
        IMAGE_PROVIDER_MODE: 'live',
      }),
    ).toThrow('IMAGE_PROVIDER_MODE must be either disabled or mock.');
  });

  it('requires a PostgreSQL URL', () => {
    expect(() =>
      readWorkerRuntimeConfig({
        ...validEnvironment(),
        DATABASE_URL: 'https://example.invalid/database',
      }),
    ).toThrow('DATABASE_URL must use the postgres or postgresql protocol.');
  });

  it('rejects unknown worker modes', () => {
    expect(() =>
      readWorkerRuntimeConfig({
        ...validEnvironment(),
        WORKER_MODE: 'enabled',
      }),
    ).toThrow('WORKER_MODE must be either idle or schedules.');
  });

  it('permits the resolver only in explicit mock schedule mode', () => {
    expect(
      readWorkerRuntimeConfig({
        ...validEnvironment(),
        PAYMENT_PROVIDER_MODE: 'mock',
        TRY_RISK_FREE_RESOLVER_ENABLED: 'true',
        WORKER_MODE: 'schedules',
      }),
    ).toEqual(expect.objectContaining({ tryRiskFreeResolverEnabled: true, workerMode: 'schedules' }));

    expect(() =>
      readWorkerRuntimeConfig({
        ...validEnvironment(),
        TRY_RISK_FREE_RESOLVER_ENABLED: 'true',
      }),
    ).toThrow('The Try Risk-Free resolver requires WORKER_MODE=schedules and PAYMENT_PROVIDER_MODE=mock.');
  });

  it('allows only an idle, fully disabled production staging worker', () => {
    const ca = Buffer.from('-----BEGIN CERTIFICATE-----\ntrusted\n-----END CERTIFICATE-----').toString('base64');
    expect(
      readWorkerRuntimeConfig({
        ...validEnvironment(),
        DATABASE_SSL_CA_BASE64: ca,
        DATABASE_SSL_MODE: 'verify-full',
        IMAGE_PROVIDER_MODE: 'disabled',
        NODE_ENV: 'production',
        TEXT_PROVIDER_MODE: 'disabled',
      }),
    ).toMatchObject({ workerMode: 'idle', imageProviderMode: 'disabled', textProviderMode: 'disabled' });

    expect(() =>
      readWorkerRuntimeConfig({
        ...validEnvironment(),
        DATABASE_SSL_CA_BASE64: ca,
        DATABASE_SSL_MODE: 'verify-full',
        NODE_ENV: 'production',
      }),
    ).toThrow('Production staging permits only the idle worker with every provider disabled.');
  });
});
