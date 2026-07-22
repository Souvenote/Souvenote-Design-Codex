import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { GenerationRepository } from './generation.repository';

@Module({
  controllers: [GenerationController],
  providers: [GenerationRepository, GenerationService],
})
export class GenerationModule {}
