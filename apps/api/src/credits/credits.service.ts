import { Injectable } from '@nestjs/common';
import { CreditsRepository } from './credits.repository';

@Injectable()
export class CreditsService {
  constructor(private readonly repository: CreditsRepository) {}

  async findBalance(userId: string) {
    return { balance: await this.repository.findBalance(userId) };
  }

  async reserveInitialGeneration(userId: string, jobId: string, idempotencyKey: string) {
    await this.repository.applyFixedEntry(
      userId,
      'generation_reservation',
      -2,
      'initial_generation',
      jobId,
      `${idempotencyKey}:reserve`,
    );
    return this.findBalance(userId);
  }

  async refundInitialGeneration(userId: string, jobId: string, idempotencyKey: string) {
    await this.repository.applyFixedEntry(
      userId,
      'generation_refund',
      2,
      'initial_generation_failure',
      jobId,
      `${idempotencyKey}:refund`,
    );
    return this.findBalance(userId);
  }
}
