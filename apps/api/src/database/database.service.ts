import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { type ConfigurationReader, readPositiveInteger, readString } from '../config/runtime-config';

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

    // gets the connection string from .env file and uses it to connect to the database
    this.pool = new Pool({
      connectionString: databaseUrl,
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
