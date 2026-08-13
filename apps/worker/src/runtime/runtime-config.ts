import { readFileSync } from 'node:fs';

export type ProviderMode = 'disabled' | 'mock';

export type WorkerDatabaseConfig = Readonly<{
  connectionString?: string;
  database?: string;
  host?: string;
  password?: string;
  port?: number;
  ssl?: Readonly<{ ca: string; rejectUnauthorized: true }>;
  user?: string;
}>;

export type WorkerRuntimeConfig = Readonly<{
  authMode: 'disabled';
  database: WorkerDatabaseConfig;
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

const parseDatabaseUrl = (rawValue: string): string => {
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

const readDatabaseConfig = (environment: NodeJS.ProcessEnv, production: boolean): WorkerDatabaseConfig => {
  const sslMode = environment.DATABASE_SSL_MODE ?? (production ? 'verify-full' : 'disable');
  if (sslMode !== 'disable' && sslMode !== 'verify-full') {
    throw new Error('DATABASE_SSL_MODE must be either disable or verify-full.');
  }
  if (production && sslMode !== 'verify-full') {
    throw new Error('Production worker database connections require DATABASE_SSL_MODE=verify-full.');
  }

  let ssl: WorkerDatabaseConfig['ssl'];
  if (sslMode === 'verify-full') {
    if (environment.DATABASE_SSL_CA_BASE64 && environment.DATABASE_SSL_CA_FILE) {
      throw new Error('Set only one of DATABASE_SSL_CA_BASE64 or DATABASE_SSL_CA_FILE.');
    }
    let ca: string;
    if (environment.DATABASE_SSL_CA_BASE64) {
      ca = Buffer.from(environment.DATABASE_SSL_CA_BASE64, 'base64').toString('utf8');
    } else if (environment.DATABASE_SSL_CA_FILE) {
      try {
        ca = readFileSync(environment.DATABASE_SSL_CA_FILE, 'utf8');
      } catch {
        throw new Error('DATABASE_SSL_CA_FILE could not be read.');
      }
    } else {
      throw new Error('Verified database TLS requires DATABASE_SSL_CA_BASE64 or DATABASE_SSL_CA_FILE.');
    }
    if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
      throw new Error('Database TLS CA configuration must contain a PEM certificate authority.');
    }
    ssl = { ca, rejectUnauthorized: true };
  }

  if (environment.DATABASE_URL) return { connectionString: parseDatabaseUrl(environment.DATABASE_URL), ssl };
  const {
    DATABASE_HOST: host,
    DATABASE_NAME: database,
    DATABASE_PASSWORD: password,
    DATABASE_USER: user,
  } = environment;
  if (!host || !database || !password || !user) {
    throw new Error('DATABASE_URL or all managed database component values are required.');
  }
  if (!/^[A-Za-z0-9_.-]{1,253}$/u.test(host)) throw new Error('DATABASE_HOST is invalid.');
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/u.test(database)) throw new Error('DATABASE_NAME is invalid.');
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/u.test(user)) throw new Error('DATABASE_USER is invalid.');
  const port = Number(environment.DATABASE_PORT ?? '5432');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('DATABASE_PORT is invalid.');
  return { host, database, password, port, ssl, user };
};

const parseBoolean = (name: string, rawValue: string | undefined): boolean => {
  const value = (rawValue ?? 'false').toLowerCase();
  if (value !== 'true' && value !== 'false') throw new Error(`${name} must be either true or false.`);
  return value === 'true';
};

export const readWorkerRuntimeConfig = (environment: NodeJS.ProcessEnv = process.env): WorkerRuntimeConfig => {
  const nodeEnvironment = (environment.NODE_ENV ?? 'development').toLowerCase();
  const production = nodeEnvironment === 'production';
  if (!production && nodeEnvironment !== 'development' && nodeEnvironment !== 'test') {
    throw new Error('NODE_ENV must be development, test, or production.');
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

  const providerModes = [
    parseProviderMode('EMAIL_PROVIDER_MODE', environment.EMAIL_PROVIDER_MODE),
    parseProviderMode('FULFILLMENT_PROVIDER_MODE', environment.FULFILLMENT_PROVIDER_MODE),
    parseProviderMode('IMAGE_PROVIDER_MODE', environment.IMAGE_PROVIDER_MODE),
    parseProviderMode('MUSIC_PROVIDER_MODE', environment.MUSIC_PROVIDER_MODE),
    parseProviderMode('NOTIFICATION_PROVIDER_MODE', environment.NOTIFICATION_PROVIDER_MODE),
    paymentProviderMode,
    parseProviderMode('TEXT_PROVIDER_MODE', environment.TEXT_PROVIDER_MODE),
  ] as const;
  if (
    production &&
    (workerMode !== 'idle' || tryRiskFreeResolverEnabled || providerModes.some((mode) => mode !== 'disabled'))
  ) {
    throw new Error('Production staging permits only the idle worker with every provider disabled.');
  }

  return Object.freeze({
    authMode,
    database: readDatabaseConfig(environment, production),
    emailProviderMode: providerModes[0],
    fulfillmentProviderMode: providerModes[1],
    host: environment.WORKER_HOST ?? '127.0.0.1',
    imageProviderMode: providerModes[2],
    musicProviderMode: providerModes[3],
    notificationProviderMode: providerModes[4],
    paymentProviderMode,
    port: parsePort(environment.WORKER_PORT),
    textProviderMode: providerModes[6],
    tryRiskFreeResolverEnabled,
    tryRiskFreeResolverIntervalMs: parseResolverInterval(environment.TRY_RISK_FREE_RESOLVER_INTERVAL_MS),
    workerMode,
  });
};
