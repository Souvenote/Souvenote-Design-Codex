import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

// Make this injectable so if any other class needs to access database
// NestJs gives it the ability to do so without needing to know how the database connection works
// by asking for DatabaseService
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  // Pool is a PostgreSQL preopened database connections to tables
  // instead of reopening multiple connections, we can reuse the same 
  // connection to make queries.
  private readonly pool: Pool;

  // throws a configService to access .env files data
  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is missing from environment variables.');
    }

    // gets the connection string from .env file and uses it to connect to the database
    this.pool = new Pool({
      connectionString: databaseUrl,
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

  // When the server closes NestJS automatically calls this hook 
  // to clean up the database connection pool
  async onModuleDestroy() {
    await this.pool.end();
  }
}
