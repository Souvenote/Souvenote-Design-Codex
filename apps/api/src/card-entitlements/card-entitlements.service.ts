import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { runtimeEnvironment, readString, type ConfigurationReader } from '../config/runtime-config';
import { CardEntitlementsRepository } from './card-entitlements.repository';

@Injectable()
export class CardEntitlementsService {
  constructor(
    private readonly repository: CardEntitlementsRepository,
    @Inject(ConfigService) private readonly configuration: ConfigurationReader,
  ) {}

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

  async authorizeTryRiskFree(userId: string, idempotencyKey: string) {
    this.requireMockPaymentMode();
    const requestHash = this.hash({ offer: 'try_risk_free_one_card', provider: 'mock' });
    const result = await this.repository.authorizeTryRiskFree(userId, idempotencyKey, requestHash);
    return {
      authorization: CardEntitlementsRepository.tryRiskFreeToApi(result.authorization),
      balance: result.balance,
    };
  }

  async getTryRiskFree(userId: string, authorizationId: string) {
    return {
      authorization: CardEntitlementsRepository.tryRiskFreeToApi(
        await this.repository.getTryRiskFree(userId, authorizationId),
      ),
    };
  }

  private requireMockPaymentMode(): void {
    const environment = runtimeEnvironment(this.configuration);
    const paymentMode = readString(this.configuration, 'PAYMENT_PROVIDER_MODE')?.toLowerCase();
    if (!['development', 'test'].includes(environment) || paymentMode !== 'mock') {
      throw new ConflictException({
        code: 'MOCK_PAYMENT_MODE_REQUIRED',
        message: 'Try Risk-Free authorization is disabled outside deterministic local mock mode.',
      });
    }
  }

  private hash(input: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(input)).digest('hex');
  }
}
