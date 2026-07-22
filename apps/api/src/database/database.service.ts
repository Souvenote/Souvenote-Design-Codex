import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
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
    const databaseUrl = readString(this.configService, 'DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is missing from environment variables.');
    }

    const connectionTimeoutMillis = readPositiveInteger(this.configService, 'DATABASE_CONNECTION_TIMEOUT_MS', 5_000);
    const idleTimeoutMillis = readPositiveInteger(this.configService, 'DATABASE_IDLE_TIMEOUT_MS', 30_000);
    const queryTimeoutMillis = readPositiveInteger(this.configService, 'DATABASE_QUERY_TIMEOUT_MS', 10_000);
    this.readinessTimeoutMs = readPositiveInteger(this.configService, 'DATABASE_READINESS_TIMEOUT_MS', 2_000);
    const sslMode =
      readString(this.configService, 'DATABASE_SSL_MODE') ??
      (runtimeEnvironment(this.configService) === 'production' ? 'verify-full' : 'disable');
    if (sslMode !== 'disable' && sslMode !== 'verify-full') {
      throw new Error('DATABASE_SSL_MODE must be either "disable" or "verify-full".');
    }
    if (runtimeEnvironment(this.configService) === 'production' && sslMode !== 'verify-full') {
      throw new Error('Production database connections require DATABASE_SSL_MODE=verify-full.');
    }
    const ssl = sslMode === 'verify-full' ? this.readVerifiedTlsConfiguration() : undefined;

    // gets the connection string from .env file and uses it to connect to the database
    this.pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis,
      idleTimeoutMillis,
      query_timeout: queryTimeoutMillis,
      ssl,
    });
  }

  private readVerifiedTlsConfiguration(): { rejectUnauthorized: true; ca: string } {
    const encodedCa = readString(this.configService, 'DATABASE_SSL_CA_BASE64');
    if (!encodedCa) throw new Error('DATABASE_SSL_CA_BASE64 is required for verified database TLS.');
    let ca: string;
    try {
      ca = Buffer.from(encodedCa, 'base64').toString('utf8');
    } catch {
      throw new Error('DATABASE_SSL_CA_BASE64 must be valid base64.');
    }
    if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
      throw new Error('DATABASE_SSL_CA_BASE64 must contain a PEM certificate authority.');
    }
    return { rejectUnauthorized: true, ca };
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
