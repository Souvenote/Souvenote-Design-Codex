import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { OrdersRepository } from './orders.repository';

export type PostalAddressInput = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: 'CA';
};

export type CreateOrderInput = {
  cardDraftId: string;
  selectedAssetId: string;
  offerId: string;
  quantity: number;
  recipientAddress: PostalAddressInput;
  senderAddress: PostalAddressInput;
};

@Injectable()
export class OrdersService {
  constructor(private readonly repository: OrdersRepository) {}

  async create(userId: string, idempotencyKey: string, input: CreateOrderInput) {
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return { order: OrdersRepository.toApi(await this.repository.create(userId, idempotencyKey, requestHash, input)) };
  }

  async list(userId: string, limit: number, cursor?: string) {
    const rows = await this.repository.list(userId, limit, cursor);
    return {
      data: rows.map((row) => OrdersRepository.toApi(row)),
      nextCursor: rows.length === limit ? (rows.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, orderId: string) {
    return { order: OrdersRepository.toApi(await this.repository.get(userId, orderId)) };
  }
}
