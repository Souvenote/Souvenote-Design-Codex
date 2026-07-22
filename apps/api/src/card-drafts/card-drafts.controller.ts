import { Controller, Post, Get, Param, Body, Patch } from '@nestjs/common';
import { CardDraftsService } from './card-drafts.service';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateCardDraftDto {
  @IsString()
  userId: string;

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

  @Get('/user/:userId')
  async getCardDraftsByUserId(@Param('userId') userId: string) {
    return this.cardDraftsService.getCardDraftsByUserId(userId);
  }

  @Get(':draftId')
  async getCardDraftById(@Param('draftId') draftId: string) {
    return this.cardDraftsService.getCardDraftById(draftId);
  }

  @Post()
  async createCardDraft(@Body() dto: CreateCardDraftDto) {
    return this.cardDraftsService.createCardDraft(dto);
  }

  @Patch(':draftId')
  async updateCardDraft(@Param('draftId') draftId: string, @Body() dto: UpdateCardDraftDto) {
    return this.cardDraftsService.updateCardDraft(draftId, dto);
  }
}
