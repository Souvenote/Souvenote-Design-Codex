import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CreditsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findBalance(userId: string): Promise<number> {
    const result = await this.database.query<{ balance: number | string }>(
      `SELECT balance FROM credit_accounts WHERE user_id = $1;`,
      [userId],
    );
    return Number(result.rows[0]?.balance ?? 0);
  }

  async applyFixedEntry(
    userId: string,
    eventType: 'generation_reservation' | 'generation_refund',
    amount: -2 | 2,
    source: 'initial_generation' | 'initial_generation_failure',
    relatedId: string | null,
    idempotencyKey: string,
  ): Promise<void> {
    await this.database.query(`SELECT * FROM apply_credit_ledger_entry($1, $2, $3, $4, $5::uuid, $6, '{}'::jsonb);`, [
      userId,
      eventType,
      amount,
      source,
      relatedId,
      idempotencyKey,
    ]);
  }
}
