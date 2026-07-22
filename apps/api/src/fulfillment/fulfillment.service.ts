import { ConflictException, Injectable } from '@nestjs/common';
import { FulfillmentRepository } from './fulfillment.repository';

@Injectable()
export class FulfillmentService {
  constructor(private readonly repository: FulfillmentRepository) {}

  async submit(userId: string, orderId: string, idempotencyKey: string) {
    void idempotencyKey;
    await this.repository.requireOwnedPaidOrder(userId, orderId);
    throw new ConflictException({
      code: 'FULFILLMENT_NOT_ENABLED',
      message: 'Fulfillment remains disabled until the approved Section 5 Scribeless sandbox integration is active.',
    });
  }

  async get(userId: string, jobId: string) {
    return { fulfillmentJob: FulfillmentRepository.toApi(await this.repository.get(userId, jobId)) };
  }
}
