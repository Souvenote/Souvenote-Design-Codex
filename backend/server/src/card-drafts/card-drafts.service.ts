import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCardDraftDto } from './card-drafts.controller';

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

  async getCardDraftById(draftId: string) {
    const result = await this.databaseService.query(
      `
        SELECT id, user_id, occasion, relationship, creative_brief, status, created_at, updated_at
        FROM card_drafts
        WHERE id = $1
          AND deleted_at IS NULL;
      `,
      [draftId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Card draft not found.');
    }

    return {
      cardDraft: result.rows[0],
    };
  }

  async createCardDraft(dto: CreateCardDraftDto) {
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
        dto.userId,
        dto.occasion ?? null,
        dto.relationship ?? null,
        JSON.stringify(dto.creativeBrief ?? {}),
      ],
    );

    return {
      cardDraft: result.rows[0],
    };
  }
}