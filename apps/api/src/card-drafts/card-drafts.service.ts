import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CardDraftsRepository } from './card-drafts.repository';

export type CardDraftInput = {
  creationRoute: 'personalize_template' | 'build_my_card';
  occasion?: string;
  relationship?: string;
  creativeBrief?: Record<string, unknown>;
};

export type CardDraftUpdate = Omit<CardDraftInput, 'creationRoute'>;
export type CardDraftApproval = { imageAssetId: string; messageAssetId: string; songAssetId?: string };

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

  async approve(userId: string, draftId: string, idempotencyKey: string, input: CardDraftApproval) {
    const selectedAssetIds = [input.imageAssetId, input.messageAssetId, input.songAssetId].filter(
      (assetId): assetId is string => Boolean(assetId),
    );
    if (new Set(selectedAssetIds).size !== selectedAssetIds.length) {
      throw new BadRequestException({
        code: 'APPROVAL_ASSETS_MUST_BE_DISTINCT',
        message: 'Choose a different generated asset for each approved output type.',
      });
    }

    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          imageAssetId: input.imageAssetId,
          messageAssetId: input.messageAssetId,
          songAssetId: input.songAssetId ?? null,
        }),
      )
      .digest('hex');
    return {
      cardDraft: CardDraftsRepository.toApi(
        await this.repository.approve(userId, draftId, idempotencyKey, requestHash, input),
      ),
    };
  }
}
