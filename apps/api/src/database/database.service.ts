import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { Pool, PoolClient, type PoolConfig, QueryResult, QueryResultRow } from 'pg';
import {
  type ConfigurationReader,
  readPositiveInteger,
  readString,
  runtimeEnvironment,
} from '../config/runtime-config';

// Make this injectable so if any other class needs to access database
// NestJs gives it the ability to do so without needing to know how the database connection works
// by asking for DatabaseService
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  // Pool is a PostgreSQL preopened database connections to tables
  // instead of reopening multiple connections, we can reuse the same
  // connection to make queries.
  private readonly pool: Pool;
  private readonly readinessTimeoutMs: number;
  private isClosed = false;

  // throws a configService to access .env files data
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigurationReader,
  ) {
    const connectionTimeoutMillis = readPositiveInteger(this.configService, 'DATABASE_CONNECTION_TIMEOUT_MS', 5_000);
    const idleTimeoutMillis = readPositiveInteger(this.configService, 'DATABASE_IDLE_TIMEOUT_MS', 30_000);
    const queryTimeoutMillis = readPositiveInteger(this.configService, 'DATABASE_QUERY_TIMEOUT_MS', 10_000);
    this.readinessTimeoutMs = readPositiveInteger(this.configService, 'DATABASE_READINESS_TIMEOUT_MS', 2_000);
    this.pool = new Pool({
      ...resolveDatabasePoolConfig(this.configService),
      connectionTimeoutMillis,
      idleTimeoutMillis,
      query_timeout: queryTimeoutMillis,
    });
  }

  // This what services will call to run SQL queries against the database
  // text : SQL query string with $1, $2 placeholders for parameters
  // params: array of values to replace the placeholders in the query
  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Database readiness check timed out.')), this.readinessTimeoutMs);
    });

    try {
      await Promise.race([this.pool.query('SELECT 1'), timeoutPromise]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    await this.pool.end();
  }
}

export function resolveDatabasePoolConfig(configuration: ConfigurationReader): PoolConfig {
  const environment = runtimeEnvironment(configuration);
  const sslMode =
    readString(configuration, 'DATABASE_SSL_MODE') ?? (environment === 'production' ? 'verify-full' : 'disable');
  if (sslMode !== 'disable' && sslMode !== 'verify-full') {
    throw new Error('DATABASE_SSL_MODE must be either "disable" or "verify-full".');
  }
  if (environment === 'production' && sslMode !== 'verify-full') {
    throw new Error('Production database connections require DATABASE_SSL_MODE=verify-full.');
  }
  const ssl = sslMode === 'verify-full' ? readVerifiedTlsConfiguration(configuration) : undefined;
  const connectionString = readString(configuration, 'DATABASE_URL');
  if (connectionString) return { connectionString, ssl };

  const host = readString(configuration, 'DATABASE_HOST');
  const database = readString(configuration, 'DATABASE_NAME');
  const user = readString(configuration, 'DATABASE_USER');
  const password = readString(configuration, 'DATABASE_PASSWORD');
  if (!host || !database || !user || !password) {
    throw new Error('DATABASE_URL or DATABASE_HOST, DATABASE_NAME, DATABASE_USER, and DATABASE_PASSWORD are required.');
  }
  if (!/^[A-Za-z0-9_.-]{1,253}$/u.test(host)) throw new Error('DATABASE_HOST is invalid.');
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/u.test(database)) throw new Error('DATABASE_NAME is invalid.');
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/u.test(user)) throw new Error('DATABASE_USER is invalid.');

  return {
    host,
    port: readPositiveInteger(configuration, 'DATABASE_PORT', 5432, 65_535),
    database,
    user,
    password,
    ssl,
  };
}

function readVerifiedTlsConfiguration(configuration: ConfigurationReader): { rejectUnauthorized: true; ca: string } {
  const encodedCa = readString(configuration, 'DATABASE_SSL_CA_BASE64');
  const caFile = readString(configuration, 'DATABASE_SSL_CA_FILE');
  if (encodedCa && caFile) {
    throw new Error('Set only one of DATABASE_SSL_CA_BASE64 or DATABASE_SSL_CA_FILE.');
  }

  let ca: string;
  if (encodedCa) {
    ca = Buffer.from(encodedCa, 'base64').toString('utf8');
  } else if (caFile) {
    try {
      ca = readFileSync(caFile, 'utf8');
    } catch {
      throw new Error('DATABASE_SSL_CA_FILE could not be read.');
    }
  } else {
    throw new Error('DATABASE_SSL_CA_BASE64 or DATABASE_SSL_CA_FILE is required for verified database TLS.');
  }
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('Database TLS CA configuration must contain a PEM certificate authority.');
  }
  return { rejectUnauthorized: true, ca };
}
