import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GenerationRepository } from './generation.repository';

@Injectable()
export class GenerationService {
  constructor(private readonly repository: GenerationRepository) {}

  async start(userId: string, idempotencyKey: string, cardDraftId: string) {
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ cardDraftId, assets: ['image', 'song'] }))
      .digest('hex');
    const result = await this.repository.start(userId, idempotencyKey, requestHash, cardDraftId);
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
}
