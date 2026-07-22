import { Injectable } from '@nestjs/common';
import { CardDraftsRepository } from './card-drafts.repository';

export type CardDraftInput = {
  creationRoute: 'personalize_template' | 'build_my_card';
  occasion?: string;
  relationship?: string;
  creativeBrief?: Record<string, unknown>;
};

export type CardDraftUpdate = Omit<CardDraftInput, 'creationRoute'>;

@Injectable()
export class CardDraftsService {
  constructor(private readonly repository: CardDraftsRepository) {}

  async list(userId: string, limit: number, cursor?: string) {
    const rows = await this.repository.list(userId, limit, cursor);
    return {
      data: rows.map((row) => CardDraftsRepository.toApi(row)),
      nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, draftId: string) {
    return { cardDraft: CardDraftsRepository.toApi(await this.repository.get(userId, draftId)) };
  }

  async create(userId: string, input: CardDraftInput) {
    return { cardDraft: CardDraftsRepository.toApi(await this.repository.create(userId, input)) };
  }

  async update(userId: string, draftId: string, input: CardDraftUpdate) {
    return { cardDraft: CardDraftsRepository.toApi(await this.repository.update(userId, draftId, input)) };
  }
}
