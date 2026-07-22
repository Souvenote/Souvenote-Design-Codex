import { Body, Controller, Post } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { IsOptional, IsString } from 'class-validator';

export class StartGenerationDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  cardDraftId?: string;

  @IsString()
  idempotencyKey: string;
}

@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('start')
  async startGeneration(@Body() dto: StartGenerationDto) {
    return this.generationService.startGeneration(dto);
  }
}
