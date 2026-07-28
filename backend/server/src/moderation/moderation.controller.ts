import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { ModerationService } from './moderation.service';
import { ModeratorGuard } from './moderator.guard';

class ListModerationJobsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

class ModerationJobParams {
  @IsUUID('4')
  jobId: string;
}

class RecordModerationDecisionDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9][a-z0-9_-]*$/)
  reasonCode?: string;
}

@Controller('moderation')
@UseGuards(ModeratorGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('jobs')
  listJobs(@Query() query: ListModerationJobsQuery) {
    return this.moderationService.listPendingJobs(query.limit ?? 50);
  }

  @Post('jobs/:jobId/decision')
  recordDecision(
    @Req() request: AuthenticatedRequest,
    @Param() params: ModerationJobParams,
    @Body() dto: RecordModerationDecisionDto,
  ) {
    return this.moderationService.recordDecision(
      request.localUser.id,
      params.jobId,
      dto.decision,
      dto.reasonCode,
    );
  }
}
