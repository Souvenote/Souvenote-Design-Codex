import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CardEntitlementsRepository } from './card-entitlements.repository';

@Injectable()
export class CardEntitlementsService {
  constructor(private readonly repository: CardEntitlementsRepository) {}

  async list(userId: string, limit: number, cursor?: string) {
    const rows = await this.repository.list(userId, limit, cursor);
    return {
      data: rows.map((row) => CardEntitlementsRepository.entitlementToApi(row)),
      nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    };
  }

  async reserveBigSender(userId: string, idempotencyKey: string, quantity: number) {
    const requestHash = this.hash({ quantity });
    const reservation = await this.repository.reserveBigSender(userId, idempotencyKey, requestHash, quantity);
    return { reservation: CardEntitlementsRepository.reservationToApi(reservation) };
  }

  async getReservation(userId: string, reservationId: string) {
    return {
      reservation: CardEntitlementsRepository.reservationToApi(
        await this.repository.getReservation(userId, reservationId),
      ),
    };
  }

  async releaseReservation(userId: string, reservationId: string, idempotencyKey: string) {
    const reservation = await this.repository.releaseReservation(userId, reservationId, idempotencyKey);
    return { reservation: CardEntitlementsRepository.reservationToApi(reservation) };
  }

  authorizeTryRiskFree(userId: string, idempotencyKey: string): Promise<never> {
    void userId;
    void idempotencyKey;
    return Promise.reject(
      new ConflictException({
        code: 'TRY_RISK_FREE_HOSTED_CHECKOUT_REQUIRED',
        message: 'Create a one-card order and start hosted checkout to authorize Try Risk-Free.',
      }),
    );
  }

  async getTryRiskFree(userId: string, authorizationId: string) {
    return {
      authorization: CardEntitlementsRepository.tryRiskFreeToApi(
        await this.repository.getTryRiskFree(userId, authorizationId),
      ),
    };
  }

  private hash(input: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }
}
