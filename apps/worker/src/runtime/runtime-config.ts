export type ProviderMode = 'disabled' | 'mock';

export type WorkerRuntimeConfig = Readonly<{
  authMode: 'disabled';
  databaseUrl: string;
  emailProviderMode: ProviderMode;
  fulfillmentProviderMode: ProviderMode;
  host: string;
  imageProviderMode: ProviderMode;
  musicProviderMode: ProviderMode;
  notificationProviderMode: ProviderMode;
  paymentProviderMode: ProviderMode;
  port: number;
  textProviderMode: ProviderMode;
  tryRiskFreeResolverEnabled: boolean;
  tryRiskFreeResolverIntervalMs: number;
  workerMode: 'idle' | 'schedules';
}>;

const parsePort = (rawValue: string | undefined): number => {
  const value = rawValue ?? '4001';
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('WORKER_PORT must be an integer from 1 through 65535.');
  }

  return port;
};

const parseResolverInterval = (rawValue: string | undefined): number => {
  const value = Number(rawValue ?? '60000');
  if (!Number.isInteger(value) || value < 1_000 || value > 3_600_000) {
    throw new Error('TRY_RISK_FREE_RESOLVER_INTERVAL_MS must be an integer from 1000 through 3600000.');
  }
  return value;
};

const parseProviderMode = (name: string, rawValue: string | undefined): ProviderMode => {
  const value = rawValue ?? 'disabled';

  if (value !== 'disabled' && value !== 'mock') {
    throw new Error(`${name} must be either disabled or mock.`);
  }

  return value;
};

const parseDatabaseUrl = (rawValue: string | undefined): string => {
  if (!rawValue) {
    throw new Error('DATABASE_URL is required.');
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawValue);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (databaseUrl.protocol !== 'postgres:' && databaseUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres or postgresql protocol.');
  }

  return rawValue;
};

const parseBoolean = (name: string, rawValue: string | undefined): boolean => {
  const value = (rawValue ?? 'false').toLowerCase();
  if (value !== 'true' && value !== 'false') throw new Error(`${name} must be either true or false.`);
  return value === 'true';
};

export const readWorkerRuntimeConfig = (environment: NodeJS.ProcessEnv = process.env): WorkerRuntimeConfig => {
  const nodeEnvironment = (environment.NODE_ENV ?? 'development').toLowerCase();
  if (nodeEnvironment !== 'development' && nodeEnvironment !== 'test') {
    throw new Error('The Section 5 worker is permitted only in development or test.');
  }

  const authMode = environment.AUTH_MODE ?? 'disabled';
  if (authMode !== 'disabled') {
    throw new Error('AUTH_MODE must be disabled in the Section 5 worker.');
  }

  const workerMode = environment.WORKER_MODE ?? 'idle';
  if (workerMode !== 'idle' && workerMode !== 'schedules') {
    throw new Error('WORKER_MODE must be either idle or schedules.');
  }

  const paymentProviderMode = parseProviderMode('PAYMENT_PROVIDER_MODE', environment.PAYMENT_PROVIDER_MODE);
  const tryRiskFreeResolverEnabled = parseBoolean(
    'TRY_RISK_FREE_RESOLVER_ENABLED',
    environment.TRY_RISK_FREE_RESOLVER_ENABLED,
  );
  if (tryRiskFreeResolverEnabled && (workerMode !== 'schedules' || paymentProviderMode !== 'mock')) {
    throw new Error('The Try Risk-Free resolver requires WORKER_MODE=schedules and PAYMENT_PROVIDER_MODE=mock.');
  }

  return Object.freeze({
    authMode,
    databaseUrl: parseDatabaseUrl(environment.DATABASE_URL),
    emailProviderMode: parseProviderMode('EMAIL_PROVIDER_MODE', environment.EMAIL_PROVIDER_MODE),
    fulfillmentProviderMode: parseProviderMode('FULFILLMENT_PROVIDER_MODE', environment.FULFILLMENT_PROVIDER_MODE),
    host: environment.WORKER_HOST ?? '127.0.0.1',
    imageProviderMode: parseProviderMode('IMAGE_PROVIDER_MODE', environment.IMAGE_PROVIDER_MODE),
    musicProviderMode: parseProviderMode('MUSIC_PROVIDER_MODE', environment.MUSIC_PROVIDER_MODE),
    notificationProviderMode: parseProviderMode('NOTIFICATION_PROVIDER_MODE', environment.NOTIFICATION_PROVIDER_MODE),
    paymentProviderMode,
    port: parsePort(environment.WORKER_PORT),
    textProviderMode: parseProviderMode('TEXT_PROVIDER_MODE', environment.TEXT_PROVIDER_MODE),
    tryRiskFreeResolverEnabled,
    tryRiskFreeResolverIntervalMs: parseResolverInterval(environment.TRY_RISK_FREE_RESOLVER_INTERVAL_MS),
    workerMode,
  });
};
