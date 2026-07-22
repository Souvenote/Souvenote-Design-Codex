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
}
