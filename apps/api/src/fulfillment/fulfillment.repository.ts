import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type FulfillmentRow = {
  id: string;
  order_id: string;
  provider: string;
  status: string;
  attempt_count: number;
  submitted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

@Injectable()
export class FulfillmentRepository {
  constructor(private readonly database: DatabaseService) {}

  async requireOwnedPaidOrder(userId: string, orderId: string): Promise<void> {
    const result = await this.database.query(
      `SELECT id FROM orders WHERE id = $1 AND user_id = $2 AND status IN ('paid', 'fulfillment_pending');`,
      [orderId, userId],
    );
    if (!result.rows[0]) throw new NotFoundException('Order not found.');
  }

  async get(userId: string, jobId: string): Promise<FulfillmentRow> {
    const result = await this.database.query<FulfillmentRow>(
      `SELECT id, order_id, provider, status, attempt_count, submitted_at, created_at, updated_at
       FROM fulfillment_jobs WHERE id = $1 AND user_id = $2;`,
      [jobId, userId],
    );
    const job = result.rows[0];
    if (!job) throw new NotFoundException('Fulfillment job not found.');
    return job;
  }

  static toApi(row: FulfillmentRow) {
    return {
      id: row.id,
      orderId: row.order_id,
      provider: row.provider,
      status: row.status,
      attemptCount: row.attempt_count,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
