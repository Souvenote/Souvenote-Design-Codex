import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  GenerationListResponseDto,
  GenerationResponseDto,
  GenerationStartResponseDto,
} from '../common/api-response.dto';
import { IsEnum, IsUUID } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Idempotent } from '../common/idempotent.decorator';
import { CursorPaginationQueryDto } from '../common/pagination.dto';
import { GenerationService } from './generation.service';
import { GENERATION_ACTIONS, type GenerationAction } from './generation-policy';

export class StartGenerationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cardDraftId!: string;

  @ApiProperty({ enum: GENERATION_ACTIONS })
  @IsEnum(GENERATION_ACTIONS)
  actionType!: GenerationAction;
}

@ApiTags('generation-jobs')
@ApiBearerAuth()
@Controller('generation-jobs')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ operationId: 'startGenerationJob' })
  @ApiCreatedResponse({ type: GenerationStartResponseDto })
  async start(@Req() request: AuthenticatedRequest, @Body() dto: StartGenerationDto) {
    return this.generationService.start(
      request.user.id,
      request.header('idempotency-key')!,
      dto.cardDraftId,
      dto.actionType,
    );
  }

  @Get()
  @ApiOperation({ operationId: 'listGenerationJobs' })
  @ApiOkResponse({ type: GenerationListResponseDto })
  async list(@Req() request: AuthenticatedRequest, @Query() query: CursorPaginationQueryDto) {
    return this.generationService.list(request.user.id, query.limit ?? 20, query.cursor);
  }

  @Get(':jobId')
  @ApiOperation({ operationId: 'getGenerationJob' })
  @ApiOkResponse({ type: GenerationResponseDto })
  async get(@Req() request: AuthenticatedRequest, @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string) {
    return this.generationService.get(request.user.id, jobId);
  }
}
