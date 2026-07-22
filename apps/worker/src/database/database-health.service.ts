import { Injectable } from '@nestjs/common';
import { WorkerDatabaseService } from './worker-database.service';

@Injectable()
export class DatabaseHealthService {
  constructor(private readonly database: WorkerDatabaseService) {}

  async ping(): Promise<void> {
    await this.database.ping();
  }
}
