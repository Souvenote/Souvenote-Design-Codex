import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CardDraftListResponseDto, CardDraftResponseDto } from '../common/api-response.dto';
import { IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Idempotent } from '../common/idempotent.decorator';
import { CardDraftsService } from './card-drafts.service';

export class CreateCardDraftDto {
  @ApiProperty({ enum: ['personalize_template', 'build_my_card'] })
  @IsIn(['personalize_template', 'build_my_card'])
  creationRoute!: 'personalize_template' | 'build_my_card';

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  occasion?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  relationship?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  creativeBrief?: Record<string, unknown>;
}

export class UpdateCardDraftDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  occasion?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  relationship?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  creativeBrief?: Record<string, unknown>;
}

export class CardDraftListQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Opaque owner-scoped cursor from the previous page.' })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class ApproveCardDraftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  imageAssetId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  messageAssetId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  songAssetId?: string;
}

@ApiTags('card-drafts')
@ApiBearerAuth()
@Controller('card-drafts')
export class CardDraftsController {
  constructor(private readonly cardDraftsService: CardDraftsService) {}

  @Get()
  @ApiOperation({ operationId: 'listCardDrafts' })
  @ApiOkResponse({ type: CardDraftListResponseDto })
  async list(@Req() request: AuthenticatedRequest, @Query() query: CardDraftListQueryDto) {
    return this.cardDraftsService.list(request.user.id, query.limit ?? 20, query.cursor);
  }

  @Get(':draftId')
  @ApiOperation({ operationId: 'getCardDraft' })
  @ApiOkResponse({ type: CardDraftResponseDto })
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('draftId', new ParseUUIDPipe({ version: '4' })) draftId: string,
  ) {
    return this.cardDraftsService.get(request.user.id, draftId);
  }

  @Post()
  @ApiOperation({ operationId: 'createCardDraft' })
  @ApiCreatedResponse({ type: CardDraftResponseDto })
  async create(@Req() request: AuthenticatedRequest, @Body() dto: CreateCardDraftDto) {
    return this.cardDraftsService.create(request.user.id, dto);
  }

  @Patch(':draftId')
  @ApiOperation({ operationId: 'updateCardDraft' })
  @ApiOkResponse({ type: CardDraftResponseDto })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('draftId', new ParseUUIDPipe({ version: '4' })) draftId: string,
    @Body() dto: UpdateCardDraftDto,
  ) {
    return this.cardDraftsService.update(request.user.id, draftId, dto);
  }

  @Post(':draftId/approve')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  @ApiOperation({ operationId: 'approveCardDraft' })
  @ApiOkResponse({ type: CardDraftResponseDto })
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('draftId', new ParseUUIDPipe({ version: '4' })) draftId: string,
    @Body() dto: ApproveCardDraftDto,
  ) {
    return this.cardDraftsService.approve(request.user.id, draftId, request.header('idempotency-key')!, dto);
  }
}
