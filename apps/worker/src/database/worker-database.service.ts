import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { WORKER_RUNTIME_CONFIG } from '../runtime/runtime.module';
import type { WorkerRuntimeConfig } from '../runtime/runtime-config';

@Injectable()
export class WorkerDatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(WORKER_RUNTIME_CONFIG) config: WorkerRuntimeConfig) {
    this.pool = new Pool({
      application_name: 'souvenote-worker',
      ...config.database,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 10_000,
      max: 2,
      statement_timeout: 2_000,
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string): Promise<QueryResult<T>> {
    return this.pool.query<T>(text);
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
