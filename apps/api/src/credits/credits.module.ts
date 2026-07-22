import { Module } from '@nestjs/common';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { CreditsRepository } from './credits.repository';

@Module({
  controllers: [CreditsController],
  providers: [CreditsRepository, CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
