import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CheckoutRepository {
  constructor(private readonly database: DatabaseService) {}

  async requireOwnedPendingOrder(userId: string, orderId: string): Promise<void> {
    const result = await this.database.query(
      `SELECT id FROM orders WHERE id = $1 AND user_id = $2 AND status = 'pending_payment';`,
      [orderId, userId],
    );
    if (!result.rows[0]) throw new NotFoundException('Order not found.');
  }
}
