import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { LocalObjectStorageService } from '../storage/local-object-storage.service';
import {
  DeterministicGenerationProvider,
  DeterministicProviderError,
  type GeneratedAssetType,
} from './deterministic-generation.provider';
import { GenerationRepository, type StoredMockAsset } from './generation.repository';
import { generationCreditCost, type GenerationAction, type GenerationFailureCategory } from './generation-policy';

@Injectable()
export class GenerationService {
  constructor(
    private readonly repository: GenerationRepository,
    private readonly provider: DeterministicGenerationProvider,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async start(
    userId: string,
    idempotencyKey: string,
    cardDraftId: string,
    action: GenerationAction,
    creativeDirection?: string,
  ) {
    this.provider.assertEnabled(action);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ cardDraftId, action, creativeDirection: creativeDirection?.trim() || null }))
      .digest('hex');
    const started = await this.repository.start(
      userId,
      idempotencyKey,
      requestHash,
      cardDraftId,
      action,
      generationCreditCost(action),
    );
    if (!started.created) {
      return { generationJob: GenerationRepository.toApi(started.job), balance: started.balance };
    }

    const assetTypes = this.provider.assetTypes(action);
    const context = await this.repository.beginMock(userId, started.job.id, assetTypes);
    const creativeBriefHash = createHash('sha256').update(JSON.stringify(context.creativeBrief)).digest('hex');
    const storedAssets: StoredMockAsset[] = [];
    let activeAssetType: GeneratedAssetType = assetTypes[0] ?? 'image';
    try {
      for (const assetType of assetTypes) {
        activeAssetType = assetType;
        const output = this.provider.generate(
          assetType,
          `${context.job.request_hash}:${creativeBriefHash}:${assetType}`,
          context.creativeBrief,
        );
        const storageKey = `private/${userId}/${cardDraftId}/generated/${context.job.id}/${assetType}${this.extension(
          output.mediaType,
        )}`;
        await this.storage.put(storageKey, output.content);
        storedAssets.push({
          assetType,
          storageKey,
          mediaType: output.mediaType,
          contentSha256: createHash('sha256').update(output.content).digest('hex'),
          byteSize: output.content.length,
          widthPixels: output.widthPixels,
          heightPixels: output.heightPixels,
          durationSeconds: output.durationSeconds,
          moderationStatus: output.moderationStatus,
        });
      }
      const completed = await this.repository.completeMock(userId, context.job.id, storedAssets);
      return { generationJob: GenerationRepository.toApi(completed.job), balance: completed.balance };
    } catch (error: unknown) {
      const category = error instanceof DeterministicProviderError ? error.category : 'provider_failed';
      const failedAssetType = error instanceof DeterministicProviderError ? error.assetType : activeAssetType;
      const failed = await this.repository.failMock(userId, context.job.id, storedAssets, failedAssetType, category);
      return { generationJob: GenerationRepository.toApi(failed.job), balance: failed.balance };
    }
  }

  async failAndRefund(userId: string, jobId: string, category: GenerationFailureCategory) {
    const result = await this.repository.failAndRefund(userId, jobId, category);
    return { generationJob: GenerationRepository.toApi(result.job), balance: result.balance };
  }

  async list(userId: string, limit: number, cursor?: string) {
    const rows = await this.repository.list(userId, limit, cursor);
    return {
      data: rows.map((row) => GenerationRepository.toApi(row)),
      nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, jobId: string) {
    return { generationJob: GenerationRepository.toApi(await this.repository.get(userId, jobId)) };
  }

  private extension(mediaType: string): string {
    if (mediaType === 'image/svg+xml') return '.svg';
    if (mediaType === 'audio/wav') return '.wav';
    return '.txt';
  }
}
