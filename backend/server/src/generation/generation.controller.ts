import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { GenerationService } from './generation.service';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { GenerationAssetType } from './generation.provider';

export class StartGenerationDto {
  @IsString()
  @IsNotEmpty()
  cardDraftId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  idempotencyKey: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(['image', 'song', 'message'], { each: true })
  assetTypes?: GenerationAssetType[];
}

@Controller('generation')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post('start')
  async startGeneration(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StartGenerationDto,
  ) {
    return this.generationService.startGeneration(request.localUser.id, dto);
  }

  @Get(':generationJobId')
  async getGeneration(
    @Req() request: AuthenticatedRequest,
    @Param('generationJobId') generationJobId: string,
  ) {
    return this.generationService.getGeneration(
      request.localUser.id,
      generationJobId,
    );
  }
}
