import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateCardDraftDto,
  UpdateCardDraftDto,
} from './card-drafts.controller';

@Injectable()
export class CardDraftsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCardDraftsByUserId(userId: string) {
    const result = await this.databaseService.query(
      `
        SELECT id, user_id, occasion, relationship, creative_brief, status, created_at, updated_at
        FROM card_drafts
        WHERE user_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC;
      `,
      [userId],
    );

    return {
      userId,
      cardDrafts: result.rows,
    };
  }

  async getCardDraftById(userId: string, draftId: string) {
    const result = await this.databaseService.query(
      `
        SELECT id, user_id, occasion, relationship, creative_brief, status, created_at, updated_at
        FROM card_drafts
        WHERE id = $1
          AND user_id = $2
          AND deleted_at IS NULL;
      `,
      [draftId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Card draft not found.');
    }

    return {
      cardDraft: result.rows[0],
    };
  }

  async createCardDraft(userId: string, dto: CreateCardDraftDto) {
    const result = await this.databaseService.query(
      `
        INSERT INTO card_drafts (
          user_id,
          occasion,
          relationship,
          creative_brief,
          status
        )
        VALUES ($1, $2, $3, $4, 'draft')
        RETURNING id, user_id, occasion, relationship, creative_brief, status, created_at, updated_at;
      `,
      [
        userId,
        dto.occasion ?? null,
        dto.relationship ?? null,
        JSON.stringify(dto.creativeBrief ?? {}),
      ],
    );

    return {
      cardDraft: result.rows[0],
    };
  }

  async updateCardDraft(
    userId: string,
    draftId: string,
    dto: UpdateCardDraftDto,
  ) {
    const result = await this.databaseService.query(
      `
        UPDATE card_drafts
        SET
          occasion = COALESCE($2, occasion),
          relationship = COALESCE($3, relationship),
          creative_brief = COALESCE($4::jsonb, creative_brief),
          updated_at = NOW()
        WHERE id = $1
          AND user_id = $5
          AND deleted_at IS NULL
        RETURNING id, user_id, occasion, relationship, creative_brief, status, created_at, updated_at;
      `,
      [
        draftId,
        dto.occasion ?? null,
        dto.relationship ?? null,
        dto.creativeBrief === undefined
          ? null
          : JSON.stringify(dto.creativeBrief ?? {}),
        userId,
      ],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Card draft not found.');
    }

    return {
      cardDraft: result.rows[0],
    };
  }
}
