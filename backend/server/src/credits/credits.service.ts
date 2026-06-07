import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CreditsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findBalance(userId: string) {
    const result = await this.databaseService.query(
      `
        SELECT COALESCE(SUM(amount), 0) AS balance
        FROM credit_ledger
        WHERE user_id = $1;
      `,
      [userId],
    );

    const balance = Number(result.rows[0]?.balance ?? 0);

    return {
      userId,
      balance,
    };
  }

  async grant(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Grant amount must be greater than 0.');
    }

    const result = await this.databaseService.query(
      `
        INSERT INTO credit_ledger (
          user_id,
          event_type,
          amount,
          source,
          idempotency_key,
          metadata
        )
        VALUES ($1, 'manual_grant', $2, $3, $4, $5)
        RETURNING id, user_id, event_type, amount, source, idempotency_key, created_at;
      `,
      [userId, amount, source, idempotencyKey, null],
    );

    const updatedBalance = await this.findBalance(userId);

    return {
      ledgerEntry: result.rows[0],
      balance: updatedBalance,
    };
  }

  async deduct(
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Deduction amount must be greater than 0.');
    }

    const currentBalance = await this.findBalance(userId);

    if (currentBalance.balance < amount) {
      throw new BadRequestException('Insufficient credits.');
    }

    const result = await this.databaseService.query(
      `
        INSERT INTO credit_ledger (
          user_id,
          event_type,
          amount,
          source,
          idempotency_key,
          metadata
        )
        VALUES ($1, 'generation_deduction', $2, $3, $4, $5)
        RETURNING id, user_id, event_type, amount, source, idempotency_key, created_at;
      `,
      [userId, -amount, source, idempotencyKey, null],
    );

    const updatedBalance = await this.findBalance(userId);

    return {
      ledgerEntry: result.rows[0],
      balance: updatedBalance,
    };
  }

  async refund (
    userId: string,
    amount: number,
    source: string,
    idempotencyKey: string,
  ) {

    const refundAmount = await this.databaseService.query(
        `
        INSERT INTO credit_ledger (
        user_id,
        event_type,
        amount,
        source,
        idempotency_key,
        metadata
      )
      VALUES ($1, 'generation_refund', $2, $3, $4, $5)
      RETURNING id, user_id, event_type, amount, source, idempotency_key, created_at;
        `,
        [userId, amount, source, idempotencyKey, null],
    );
    const updatedBalance = await this.findBalance(userId);

    return {
      ledgerEntry: refundAmount.rows[0],
      balance: updatedBalance,
    };
  }
}
// test UUID: ad2c7c0f-797f-4bc2-b103-91a1fc61ddef
