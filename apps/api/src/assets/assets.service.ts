import { Injectable } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';

@Injectable()
export class AssetsService {
  constructor(private readonly repository: AssetsRepository) {}

  async list(userId: string, limit: number, cursor?: string, cardDraftId?: string) {
    const rows = await this.repository.list(userId, limit, cursor, cardDraftId);
    return {
      data: rows.map((row) => AssetsRepository.toApi(row)),
      nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, assetId: string) {
    return { asset: AssetsRepository.toApi(await this.repository.get(userId, assetId)) };
  }
}
