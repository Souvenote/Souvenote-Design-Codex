import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GenerationRepository } from './generation.repository';
import { DeterministicGenerationProvider } from './deterministic-generation.provider';

@Module({
  controllers: [GenerationController],
  providers: [GenerationRepository, GenerationService, DeterministicGenerationProvider],
})
export class GenerationModule {}
