import { isIP } from 'node:net';

export interface ConfigurationReader {
  get(key: string): unknown;
}

export type AuthMode = 'cognito' | 'disabled';

const LOCAL_WEB_ORIGINS = ['http://127.0.0.1:3000', 'http://localhost:3000'] as const;

export function readString(configuration: ConfigurationReader, key: string): string | undefined {
  const value = configuration.get(key);
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

export function runtimeEnvironment(configuration: ConfigurationReader): string {
  return readString(configuration, 'NODE_ENV')?.toLowerCase() ?? 'development';
}

export function resolveAuthMode(configuration: ConfigurationReader): AuthMode {
  const configuredMode = readString(configuration, 'AUTH_MODE')?.toLowerCase();
  const mode = configuredMode ?? 'cognito';

  if (mode !== 'cognito' && mode !== 'disabled') {
    throw new Error('AUTH_MODE must be either "cognito" or "disabled".');
  }

  const environment = runtimeEnvironment(configuration);
  if (mode === 'disabled' && environment !== 'development' && environment !== 'test') {
    throw new Error('AUTH_MODE=disabled is permitted only when NODE_ENV is development or test.');
  }

  return mode;
}

export function resolveCorsAllowedOrigins(configuration: ConfigurationReader): string[] {
  const configuredOrigins = readString(configuration, 'CORS_ALLOWED_ORIGINS');

  if (!configuredOrigins) {
    if (runtimeEnvironment(configuration) === 'production') {
      throw new Error('CORS_ALLOWED_ORIGINS is required in production.');
    }

    return [...LOCAL_WEB_ORIGINS];
  }

  const origins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must contain at least one origin.');
  }

  const validatedOrigins = origins.map(validateExactHttpOrigin);
  return [...new Set(validatedOrigins)];
}

export function resolveHost(configuration: ConfigurationReader): string {
  const host = readString(configuration, 'HOST') ?? '127.0.0.1';

  if (isIP(host) === 0 && !isValidHostname(host)) {
    throw new Error('HOST must be a hostname or IP address without a scheme or path.');
  }

  return host;
}

function isValidHostname(host: string): boolean {
  if (host.length > 253 || !/^[a-z0-9.-]+$/i.test(host)) return false;

  return host
    .split('.')
    .every((label) => label.length > 0 && label.length <= 63 && !label.startsWith('-') && !label.endsWith('-'));
}

export function resolvePort(configuration: ConfigurationReader): number {
  return readBoundedInteger(configuration, 'PORT', 4000, 1, 65_535);
}

export function readPositiveInteger(
  configuration: ConfigurationReader,
  key: string,
  defaultValue: number,
  maximum = 120_000,
): number {
  return readBoundedInteger(configuration, key, defaultValue, 1, maximum);
}

function readBoundedInteger(
  configuration: ConfigurationReader,
  key: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const rawValue = configuration.get(key);
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}.`);
  }

  return value;
}

function validateExactHttpOrigin(origin: string): string {
  if (origin === '*' || origin.includes('*')) {
    throw new Error('CORS_ALLOWED_ORIGINS cannot contain wildcards.');
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(`Invalid CORS origin: ${origin}`);
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.origin !== origin ||
    url.username ||
    url.password
  ) {
    throw new Error(
      `CORS origin must be an exact HTTP(S) origin without credentials, path, query, or fragment: ${origin}`,
    );
  }

  return url.origin;
}
