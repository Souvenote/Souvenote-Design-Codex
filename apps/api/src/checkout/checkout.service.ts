import { ConflictException, Injectable } from '@nestjs/common';
import { CheckoutRepository } from './checkout.repository';

@Injectable()
export class CheckoutService {
  constructor(private readonly repository: CheckoutRepository) {}

  async start(userId: string, orderId: string, idempotencyKey: string) {
    void idempotencyKey;
    await this.repository.requireOwnedPendingOrder(userId, orderId);
    throw new ConflictException({
      code: 'CHECKOUT_NOT_ENABLED',
      message: 'Checkout remains disabled until the approved Section 5 Stripe test integration is active.',
    });
  }
}
