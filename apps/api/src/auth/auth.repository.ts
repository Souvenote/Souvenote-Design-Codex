import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

export type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birthday: string | Date | null;
  country: string;
  currency: string;
  language: string;
  marketing_opt_in: boolean;
  preferences: Record<string, unknown> | null;
  provisioned_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ProvisionIdentityInput = {
  provider: 'cognito' | 'local';
  issuer: string;
  subject: string;
  clientId: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
};

export type UpdateProfileRecord = {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  phone: string | null | undefined;
  birthday: string | null | undefined;
  language: string | undefined;
  marketingOptIn: boolean | undefined;
  preferences: Record<string, unknown> | undefined;
};

const USER_COLUMNS = `
  id, email, first_name, last_name, phone, birthday, country, currency,
  language, marketing_opt_in, preferences, provisioned_at, created_at, updated_at
`;

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  async provisionIdentity(input: ProvisionIdentityInput) {
    return this.database.transaction(async (client) => {
      const lockKey = `${input.issuer.length}:${input.issuer}${input.subject}`;
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0));', [lockKey]);

      let user = await this.findByIdentity(client, input.issuer, input.subject);
      if (!user) {
        const emailOwner = await client.query<{ id: string }>(
          `SELECT id FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1;`,
          [input.email],
        );
        if (emailOwner.rows.length > 0) {
          throw new ConflictException('This email is already linked to another sign-in identity.');
        }

        const inserted = await client.query<UserRow>(
          `INSERT INTO users (email, first_name, last_name, country, currency)
           VALUES ($1, $2, $3, 'CA', 'CAD')
           RETURNING ${USER_COLUMNS};`,
          [input.email, input.firstName, input.lastName],
        );
        user = inserted.rows[0];
        if (!user) throw new Error('User provisioning returned no user.');
        await client.query(
          `INSERT INTO auth_identities
             (user_id, provider, issuer, subject, client_id, email_verified, last_authenticated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
          [user.id, input.provider, input.issuer, input.subject, input.clientId, input.emailVerified],
        );
      } else {
        await client.query(
          `UPDATE auth_identities
           SET client_id = $3, email_verified = $4, last_authenticated_at = NOW(), updated_at = NOW()
           WHERE issuer = $1 AND subject = $2;`,
          [input.issuer, input.subject, input.clientId, input.emailVerified],
        );
      }

      if (!user) throw new Error('Identity provisioning returned no user.');
      const existingStarterGrant = await client.query<{ id: string }>(
        `SELECT id FROM credit_ledger
         WHERE user_id = $1 AND event_type = 'signup_grant'
         LIMIT 1;`,
        [user.id],
      );
      const starterIdempotencyKey = `starter:${input.issuer}:${input.subject}`;
      await client.query(
        `SELECT * FROM apply_credit_ledger_entry(
           $1, 'signup_grant', 2, 'user_provisioning', NULL, $2, '{}'::jsonb
         );`,
        [user.id, starterIdempotencyKey],
      );
      const balance = await client.query<{ balance: number | string }>(
        `SELECT balance FROM credit_accounts WHERE user_id = $1;`,
        [user.id],
      );

      return {
        user,
        starterCreditsGranted: existingStarterGrant.rows.length === 0,
        creditBalance: Number(balance.rows[0]?.balance ?? 0),
      };
    });
  }

  async findUser(userId: string): Promise<UserRow> {
    const result = await this.database.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL;`,
      [userId],
    );
    const user = result.rows[0];
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async updateProfile(userId: string, update: UpdateProfileRecord): Promise<UserRow> {
    const result = await this.database.query<UserRow>(
      `UPDATE users
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           phone = COALESCE($4, phone),
           birthday = COALESCE($5::date, birthday),
           language = COALESCE($6, language),
           marketing_opt_in = COALESCE($7, marketing_opt_in),
           preferences = COALESCE($8::jsonb, preferences),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING ${USER_COLUMNS};`,
      [
        userId,
        update.firstName,
        update.lastName,
        update.phone,
        update.birthday,
        update.language,
        update.marketingOptIn,
        update.preferences === undefined ? undefined : JSON.stringify(update.preferences),
      ],
    );
    const user = result.rows[0];
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async findByIdentity(client: PoolClient, issuer: string, subject: string): Promise<UserRow | undefined> {
    const result = await client.query<UserRow>(
      `SELECT ${USER_COLUMNS.split(',')
        .map((column) => `u.${column.trim()}`)
        .join(', ')}
       FROM auth_identities identity
       JOIN users u ON u.id = identity.user_id
       WHERE identity.issuer = $1 AND identity.subject = $2 AND u.deleted_at IS NULL
       LIMIT 1;`,
      [issuer, subject],
    );
    return result.rows[0];
  }
}
