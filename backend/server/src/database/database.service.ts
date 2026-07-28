import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { readDatabasePoolConfig } from './database.config';

export type DatabaseTransaction = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

// Make this injectable so if any other class needs to access database
// NestJs gives it the ability to do so without needing to know how the database connection works
// by asking for DatabaseService
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  // Pool is a PostgreSQL preopened database connections to tables
  // instead of reopening multiple connections, we can reuse the same
  // connection to make queries.
  private readonly pool: Pool;

  // throws a configService to access .env files data
  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool(readDatabasePoolConfig(this.configService));
    this.pool.on('error', () => {
      this.logger.error('Unexpected idle PostgreSQL client error.');
    });
  }

  // This what services will call to run SQL queries against the database
  // text : SQL query string with $1, $2 placeholders for parameters
  // params: array of values to replace the placeholders in the query
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(
    operation: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.runTransaction('BEGIN', operation);
  }

  async withReadOnlyTransaction<T>(
    operation: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.runTransaction('BEGIN TRANSACTION READ ONLY', operation, true);
  }

  private async runTransaction<T>(
    beginStatement: 'BEGIN' | 'BEGIN TRANSACTION READ ONLY',
    operation: (transaction: DatabaseTransaction) => Promise<T>,
    shortReadTimeout = false,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query(beginStatement);
      if (shortReadTimeout) {
        await client.query("SET LOCAL statement_timeout = '5000ms'");
      }
      const transaction: DatabaseTransaction = {
        query: (text, params) => client.query(text, params),
      };
      const result = await operation(transaction);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // When the server closes NestJS automatically calls this hook
  // to clean up the database connection pool
  async onModuleDestroy() {
    await this.pool.end();
  }
}
