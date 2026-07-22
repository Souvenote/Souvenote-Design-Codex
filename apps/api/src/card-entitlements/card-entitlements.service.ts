import { Injectable } from '@nestjs/common';
import { CardEntitlementsRepository } from './card-entitlements.repository';

@Injectable()
export class CardEntitlementsService {
  constructor(private readonly repository: CardEntitlementsRepository) {}

  async list(userId: string, limit: number, cursor?: string) {
    const rows = await this.repository.list(userId, limit, cursor);
    return {
      data: rows.map((row) => CardEntitlementsRepository.toApi(row)),
      nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    };
  }
}
