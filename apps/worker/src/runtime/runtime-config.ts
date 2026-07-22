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
  workerMode: 'idle';
}>;

const parsePort = (rawValue: string | undefined): number => {
  const value = rawValue ?? '4001';
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('WORKER_PORT must be an integer from 1 through 65535.');
  }

  return port;
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

export const readWorkerRuntimeConfig = (environment: NodeJS.ProcessEnv = process.env): WorkerRuntimeConfig => {
  const nodeEnvironment = (environment.NODE_ENV ?? 'development').toLowerCase();
  if (nodeEnvironment !== 'development' && nodeEnvironment !== 'test') {
    throw new Error('The Section 1 idle worker is permitted only in development or test.');
  }

  const authMode = environment.AUTH_MODE ?? 'disabled';
  if (authMode !== 'disabled') {
    throw new Error('AUTH_MODE must be disabled in the Section 1 worker scaffold.');
  }

  const workerMode = environment.WORKER_MODE ?? 'idle';
  if (workerMode !== 'idle') {
    throw new Error('WORKER_MODE must be idle in the Section 1 worker scaffold.');
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
    paymentProviderMode: parseProviderMode('PAYMENT_PROVIDER_MODE', environment.PAYMENT_PROVIDER_MODE),
    port: parsePort(environment.WORKER_PORT),
    textProviderMode: parseProviderMode('TEXT_PROVIDER_MODE', environment.TEXT_PROVIDER_MODE),
    workerMode,
  });
};
