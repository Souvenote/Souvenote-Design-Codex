import { Module } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service';
import { WorkerDatabaseService } from './worker-database.service';

@Module({
  providers: [WorkerDatabaseService, DatabaseHealthService],
  exports: [WorkerDatabaseService, DatabaseHealthService],
})
export class DatabaseModule {}
