import type { ConfigService } from '@nestjs/config';
import type { PoolConfig } from 'pg';
import { readFileSync } from 'node:fs';

type NumericSetting = {
  defaultValue: number;
  minimum: number;
  maximum: number;
};

const NUMERIC_SETTINGS = {
  DATABASE_PORT: {
    defaultValue: 5432,
    minimum: 1,
    maximum: 65_535,
  },
  DATABASE_POOL_MAX: {
    defaultValue: 10,
    minimum: 1,
    maximum: 100,
  },
  DATABASE_CONNECTION_TIMEOUT_MS: {
    defaultValue: 5_000,
    minimum: 100,
    maximum: 60_000,
  },
  DATABASE_IDLE_TIMEOUT_MS: {
    defaultValue: 30_000,
    minimum: 1_000,
    maximum: 600_000,
  },
  DATABASE_QUERY_TIMEOUT_MS: {
    defaultValue: 30_000,
    minimum: 100,
    maximum: 300_000,
  },
} as const satisfies Record<string, NumericSetting>;

type NumericSettingName = keyof typeof NUMERIC_SETTINGS;

function requiredSetting(
  configService: Pick<ConfigService, 'get'>,
  name: string,
) {
  const value = configService.get<string>(name)?.trim();
  if (!value) {
    throw new Error(`${name} is missing from environment variables.`);
  }
  return value;
}

function connectionSettings(
  configService: Pick<ConfigService, 'get'>,
): Pick<
  PoolConfig,
  'connectionString' | 'host' | 'port' | 'database' | 'user' | 'password'
> {
  const databaseUrl = configService.get<string>('DATABASE_URL')?.trim();
  if (databaseUrl) {
    return { connectionString: databaseUrl };
  }

  const port = boundedInteger(
    'DATABASE_PORT',
    configService.get<string>('DATABASE_PORT'),
  );

  return {
    host: requiredSetting(configService, 'DATABASE_HOST'),
    port,
    database: requiredSetting(configService, 'DATABASE_NAME'),
    user: requiredSetting(configService, 'DATABASE_USER'),
    password: requiredSetting(configService, 'DATABASE_PASSWORD'),
  };
}

function sslSettings(
  configService: Pick<ConfigService, 'get'>,
): PoolConfig['ssl'] {
  const mode = (
    configService.get<string>('DATABASE_SSL_MODE') ?? 'disable'
  ).trim();
  if (mode === '' || mode === 'disable') {
    return undefined;
  }
  if (mode === 'require') {
    return { rejectUnauthorized: false };
  }
  if (mode === 'verify-full') {
    const certificatePath = requiredSetting(configService, 'DATABASE_SSL_CA');
    return {
      ca: readFileSync(certificatePath, 'utf8'),
      rejectUnauthorized: true,
    };
  }
  throw new Error(
    'DATABASE_SSL_MODE must be disable, require, or verify-full.',
  );
}

function boundedInteger(
  name: NumericSettingName,
  configuredValue: string | undefined,
) {
  const setting = NUMERIC_SETTINGS[name];
  if (configuredValue === undefined || configuredValue.trim() === '') {
    return setting.defaultValue;
  }

  const normalizedValue = configuredValue.trim();
  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(`${name} must be an integer.`);
  }

  const parsedValue = Number(normalizedValue);
  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < setting.minimum ||
    parsedValue > setting.maximum
  ) {
    throw new Error(
      `${name} must be between ${setting.minimum} and ${setting.maximum}.`,
    );
  }

  return parsedValue;
}

export function readDatabasePoolConfig(
  configService: Pick<ConfigService, 'get'>,
): PoolConfig {
  const queryTimeout = boundedInteger(
    'DATABASE_QUERY_TIMEOUT_MS',
    configService.get<string>('DATABASE_QUERY_TIMEOUT_MS'),
  );

  return {
    ...connectionSettings(configService),
    application_name: 'souvenote-backend',
    keepAlive: true,
    max: boundedInteger(
      'DATABASE_POOL_MAX',
      configService.get<string>('DATABASE_POOL_MAX'),
    ),
    connectionTimeoutMillis: boundedInteger(
      'DATABASE_CONNECTION_TIMEOUT_MS',
      configService.get<string>('DATABASE_CONNECTION_TIMEOUT_MS'),
    ),
    idleTimeoutMillis: boundedInteger(
      'DATABASE_IDLE_TIMEOUT_MS',
      configService.get<string>('DATABASE_IDLE_TIMEOUT_MS'),
    ),
    query_timeout: queryTimeout,
    statement_timeout: queryTimeout,
    ssl: sslSettings(configService),
  };
}
