import { Injectable } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import { LocalObjectStorageService } from '../storage/local-object-storage.service';

@Injectable()
export class AssetsService {
  constructor(
    private readonly repository: AssetsRepository,
    private readonly storage: LocalObjectStorageService,
  ) {}

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

  async content(userId: string, assetId: string) {
    const asset = await this.repository.get(userId, assetId);
    if (asset.storage_provider !== 'local') throw new Error('Only local mock asset content is available in Section 4.');
    return { content: await this.storage.get(asset.storage_key), mediaType: asset.media_type };
  }
}
