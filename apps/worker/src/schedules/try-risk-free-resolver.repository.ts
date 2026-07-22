import { Injectable } from '@nestjs/common';
import { WorkerDatabaseService } from '../database/worker-database.service';

@Injectable()
export class TryRiskFreeResolverRepository {
  constructor(private readonly database: WorkerDatabaseService) {}

  async resolveDue(): Promise<number> {
    const result = await this.database.query<{ authorization_id: string }>(
      'SELECT authorization_id FROM resolve_due_try_risk_free_authorizations(clock_timestamp(), 100);',
    );
    return result.rowCount ?? 0;
  }
}
