import { Controller, Post, Get, Param, Body, Patch, Req } from '@nestjs/common';
import { CardDraftsService } from './card-drafts.service';
import { IsString, IsOptional, IsObject } from 'class-validator';
import type { AuthenticatedRequest } from '../auth/auth.types';

export class CreateCardDraftDto {
  @IsOptional()
  @IsString()
  occasion?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsObject()
  creativeBrief?: Record<string, unknown>;
}

export class UpdateCardDraftDto {
  @IsOptional()
  @IsString()
  occasion?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsObject()
  creativeBrief?: Record<string, unknown>;
}

@Controller('card-drafts')
export class CardDraftsController {
  constructor(private readonly cardDraftsService: CardDraftsService) {}

  @Get()
  async getCardDrafts(@Req() request: AuthenticatedRequest) {
    return this.cardDraftsService.getCardDraftsByUserId(request.localUser.id);
  }

  @Get(':draftId')
  async getCardDraftById(
    @Req() request: AuthenticatedRequest,
    @Param('draftId') draftId: string,
  ) {
    return this.cardDraftsService.getCardDraftById(
      request.localUser.id,
      draftId,
    );
  }

  @Post()
  async createCardDraft(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCardDraftDto,
  ) {
    return this.cardDraftsService.createCardDraft(request.localUser.id, dto);
  }

  @Patch(':draftId')
  async updateCardDraft(
    @Req() request: AuthenticatedRequest,
    @Param('draftId') draftId: string,
    @Body() dto: UpdateCardDraftDto,
  ) {
    return this.cardDraftsService.updateCardDraft(
      request.localUser.id,
      draftId,
      dto,
    );
  }
}
