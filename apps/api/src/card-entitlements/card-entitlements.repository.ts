import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type EntitlementRow = {
  id: string;
  source_type: string;
  status: string;
  quantity_total: number;
  quantity_reserved: number;
  quantity_consumed: number;
  expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

@Injectable()
export class CardEntitlementsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string, limit: number, cursor?: string): Promise<EntitlementRow[]> {
    const result = await this.database.query<EntitlementRow>(
      `SELECT id, source_type, status, quantity_total, quantity_reserved,
              quantity_consumed, expires_at, created_at, updated_at
       FROM card_entitlements
       WHERE user_id = $1
         AND ($2::uuid IS NULL OR (created_at, id) < (
           SELECT created_at, id FROM card_entitlements WHERE id = $2 AND user_id = $1
         ))
       ORDER BY created_at DESC, id DESC LIMIT $3;`,
      [userId, cursor ?? null, limit],
    );
    return result.rows;
  }

  static toApi(row: EntitlementRow) {
    return {
      id: row.id,
      sourceType: row.source_type,
      status: row.status,
      quantityTotal: row.quantity_total,
      quantityReserved: row.quantity_reserved,
      quantityConsumed: row.quantity_consumed,
      quantityAvailable: row.quantity_total - row.quantity_reserved - row.quantity_consumed,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
