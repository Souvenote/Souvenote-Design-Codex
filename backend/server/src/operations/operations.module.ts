import { Module } from '@nestjs/common';
import { OperationsEvidenceService } from './operations-evidence.service';
import { OperationsController } from './operations.controller';
import { OperationsGuard } from './operations.guard';

@Module({
  controllers: [OperationsController],
  providers: [OperationsEvidenceService, OperationsGuard],
  exports: [OperationsEvidenceService],
})
export class OperationsModule {}
