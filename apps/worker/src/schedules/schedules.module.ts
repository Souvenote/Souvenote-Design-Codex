import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TryRiskFreeResolverService } from './try-risk-free-resolver.service';
import { TryRiskFreeResolverRepository } from './try-risk-free-resolver.repository';

@Module({
  imports: [DatabaseModule],
  providers: [TryRiskFreeResolverRepository, TryRiskFreeResolverService],
})
export class SchedulesModule {}
