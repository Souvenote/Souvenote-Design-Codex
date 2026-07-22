import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GenerationRepository } from './generation.repository';
import { generationCreditCost, type GenerationAction, type GenerationFailureCategory } from './generation-policy';

@Injectable()
export class GenerationService {
  constructor(private readonly repository: GenerationRepository) {}

  async start(userId: string, idempotencyKey: string, cardDraftId: string, action: GenerationAction) {
    const requestHash = createHash('sha256').update(JSON.stringify({ cardDraftId, action })).digest('hex');
    const result = await this.repository.start(
      userId,
      idempotencyKey,
      requestHash,
      cardDraftId,
      action,
      generationCreditCost(action),
    );
    return { generationJob: GenerationRepository.toApi(result.job), balance: result.balance };
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
}
