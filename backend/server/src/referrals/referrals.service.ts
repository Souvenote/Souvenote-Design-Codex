import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { CreditsService } from '../credits/credits.service';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';

type ReferralRow = {
  id: string;
  referrer_user_id: string;
  invited_email: string | null;
  status: 'invited' | 'claimed' | 'rewarded' | 'canceled';
  delivery_status: string;
  referred_user_id: string | null;
  invitee_credit_amount: number;
  referrer_credit_amount: number;
  idempotency_key: string;
  claimed_at: Date | string | null;
  rewarded_at: Date | string | null;
  qualifying_order_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type UserRow = {
  id: string;
  email: string;
  first_name: string | null;
  created_at: Date | string;
};

const INVITEE_STARTER_TOTAL = 10;
const INVITEE_BONUS = 8;
const REFERRER_REWARD = 10;

@Injectable()
export class ReferralsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly creditsService: CreditsService,
  ) {}

  async dashboard(userId: string) {
    const result = await this.databaseService.query<ReferralRow>(
      `
        SELECT ${this.referralColumns}
        FROM referral_invites
        WHERE referrer_user_id = $1
        ORDER BY created_at DESC
        LIMIT 100;
      `,
      [userId],
    );
    const earnedCredits = result.rows.reduce(
      (sum, invite) =>
        sum +
        (invite.status === 'rewarded' ? invite.referrer_credit_amount : 0),
      0,
    );
    const token = this.referrerToken(userId);
    return {
      program: this.programRules(),
      referral: {
        token,
        path: `/r/${encodeURIComponent(token)}`,
      },
      invites: result.rows.map((invite) => this.toInvite(invite)),
      earnedCredits,
    };
  }

  async createInvite(
    userId: string,
    input: { email: string; idempotencyKey: string },
  ) {
    const email = this.normalizeEmail(input.email);
    const idempotencyKey = input.idempotencyKey.trim();
    return this.databaseService.withTransaction(async (transaction) => {
      const referrer = await this.findUser(transaction, userId, true);
      if (referrer.email.toLowerCase() === email) {
        throw new ConflictException('You cannot refer your own email address.');
      }
      const keyed = await transaction.query<ReferralRow>(
        `
          SELECT ${this.referralColumns}
          FROM referral_invites
          WHERE referrer_user_id = $1
            AND idempotency_key = $2
          FOR UPDATE;
        `,
        [userId, idempotencyKey],
      );
      if (keyed.rows[0]) {
        if (keyed.rows[0].invited_email !== email) {
          throw new ConflictException(
            'The referral idempotency key is already used for another email.',
          );
        }
        return { invite: this.toInvite(keyed.rows[0]), idempotentReplay: true };
      }
      const duplicate = await transaction.query<ReferralRow>(
        `
          SELECT ${this.referralColumns}
          FROM referral_invites
          WHERE referrer_user_id = $1
            AND lower(invited_email) = $2
            AND status <> 'canceled'
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE;
        `,
        [userId, email],
      );
      if (duplicate.rows[0]) {
        return {
          invite: this.toInvite(duplicate.rows[0]),
          idempotentReplay: true,
        };
      }
      const inserted = await transaction.query<ReferralRow>(
        `
          INSERT INTO referral_invites (
            referrer_user_id,
            invited_email,
            delivery_status,
            idempotency_key
          )
          VALUES ($1, $2, 'mock_delivered', $3)
          RETURNING ${this.referralColumns};
        `,
        [userId, email, idempotencyKey],
      );
      const invite = inserted.rows[0];
      await this.writeAudit(
        transaction,
        userId,
        'referral_invite_created',
        invite.id,
        {
          deliveryStatus: invite.delivery_status,
        },
      );
      return { invite: this.toInvite(invite), idempotentReplay: false };
    });
  }

  async preview(token: string) {
    const parsed = this.parseToken(token);
    if (parsed.kind === 'user') {
      const result = await this.databaseService.query<UserRow>(
        `
          SELECT id, email, first_name, created_at
          FROM users
          WHERE id = $1 AND deleted_at IS NULL
          LIMIT 1;
        `,
        [parsed.id],
      );
      const user = result.rows[0];
      if (!user) throw new NotFoundException('This referral is unavailable.');
      return {
        referral: {
          senderName: user.first_name?.trim() || 'A friend',
          program: this.programRules(),
        },
      };
    }
    const result = await this.databaseService.query<
      ReferralRow & { referrer_first_name: string | null }
    >(
      `
        SELECT ${this.referralColumnsFor('invite')},
          referrer.first_name AS referrer_first_name
        FROM referral_invites invite
        INNER JOIN users referrer ON referrer.id = invite.referrer_user_id
        WHERE invite.id = $1
          AND invite.status <> 'canceled'
        LIMIT 1;
      `,
      [parsed.id],
    );
    const invite = result.rows[0];
    if (!invite) throw new NotFoundException('This referral is unavailable.');
    return {
      referral: {
        senderName: invite.referrer_first_name?.trim() || 'A friend',
        program: this.programRules(),
      },
    };
  }

  async claim(userId: string, token: string) {
    const parsed = this.parseToken(token);
    return this.databaseService.withTransaction(async (transaction) => {
      const referredUser = await this.findUser(transaction, userId, true);
      const existingForUser = await transaction.query<ReferralRow>(
        `
          SELECT ${this.referralColumns}
          FROM referral_invites
          WHERE referred_user_id = $1
          FOR UPDATE;
        `,
        [userId],
      );
      if (existingForUser.rows[0]) {
        const existing = existingForUser.rows[0];
        if (
          (parsed.kind === 'user' && existing.referrer_user_id !== parsed.id) ||
          (parsed.kind === 'invite' && existing.id !== parsed.id)
        ) {
          throw new ConflictException(
            'This account has already claimed another referral.',
          );
        }
        return {
          referral: this.toInvite(existing),
          idempotentReplay: true,
          creditBalance: await this.creditsService.findBalance(userId),
        };
      }
      const eligible = await transaction.query<{ eligible: boolean }>(
        `
          SELECT
            users.created_at >= NOW() - INTERVAL '7 days'
            AND NOT EXISTS (
              SELECT 1
              FROM fulfillment_jobs
              WHERE fulfillment_jobs.user_id = users.id
                AND fulfillment_jobs.status IN (
                  'submitted', 'printing', 'shipped', 'delivered', 'fulfilled_mock'
                )
            ) AS eligible
          FROM users
          WHERE users.id = $1;
        `,
        [userId],
      );
      if (!eligible.rows[0]?.eligible) {
        throw new ConflictException(
          'Referral credits are available only to new accounts before their first send.',
        );
      }

      let invite: ReferralRow;
      if (parsed.kind === 'invite') {
        const result = await transaction.query<ReferralRow>(
          `
            SELECT ${this.referralColumns}
            FROM referral_invites
            WHERE id = $1
            FOR UPDATE;
          `,
          [parsed.id],
        );
        invite = result.rows[0];
        if (!invite || invite.status !== 'invited') {
          throw new ConflictException(
            'This referral invite is no longer available.',
          );
        }
        if (
          invite.invited_email &&
          invite.invited_email.toLowerCase() !==
            referredUser.email.toLowerCase()
        ) {
          throw new ConflictException(
            'Log in with the email address this referral was sent to.',
          );
        }
      } else {
        if (parsed.id === userId) {
          throw new ConflictException('You cannot claim your own referral.');
        }
        await this.findUser(transaction, parsed.id, true);
        const inserted = await transaction.query<ReferralRow>(
          `
            INSERT INTO referral_invites (
              referrer_user_id,
              status,
              delivery_status,
              referred_user_id,
              idempotency_key,
              claimed_at
            )
            VALUES ($1, 'claimed', 'not_applicable', $2, $3, NOW())
            RETURNING ${this.referralColumns};
          `,
          [parsed.id, userId, `generic-claim:${parsed.id}:${userId}`],
        );
        invite = inserted.rows[0];
      }
      if (invite.referrer_user_id === userId) {
        throw new ConflictException('You cannot claim your own referral.');
      }
      if (parsed.kind === 'invite') {
        const updated = await transaction.query<ReferralRow>(
          `
            UPDATE referral_invites
            SET
              status = 'claimed',
              referred_user_id = $2,
              claimed_at = NOW(),
              updated_at = NOW()
            WHERE id = $1 AND status = 'invited'
            RETURNING ${this.referralColumns};
          `,
          [invite.id, userId],
        );
        invite = updated.rows[0];
        if (!invite) {
          throw new ConflictException(
            'This referral changed while it was being claimed.',
          );
        }
      }
      const credits = await this.creditsService.grantOnceInTransaction(
        transaction,
        userId,
        INVITEE_BONUS,
        `referral:${invite.id}`,
        `referral-invitee:${invite.id}`,
        'referral_invitee_bonus',
      );
      await this.writeAudit(
        transaction,
        userId,
        'referral_claimed',
        invite.id,
        {
          referrerUserId: invite.referrer_user_id,
          inviteeBonusCredits: INVITEE_BONUS,
          starterCreditsTotal: INVITEE_STARTER_TOTAL,
        },
      );
      return {
        referral: this.toInvite(invite),
        idempotentReplay: false,
        creditBalance: credits.balance,
      };
    });
  }

  async rewardReferrerForFirstSend(
    transaction: DatabaseTransaction,
    referredUserId: string,
    qualifyingOrderId: string,
  ) {
    const result = await transaction.query<ReferralRow>(
      `
        SELECT ${this.referralColumns}
        FROM referral_invites
        WHERE referred_user_id = $1
          AND status = 'claimed'
        LIMIT 1
        FOR UPDATE;
      `,
      [referredUserId],
    );
    const referral = result.rows[0];
    if (!referral) return null;
    await this.creditsService.grantOnceInTransaction(
      transaction,
      referral.referrer_user_id,
      REFERRER_REWARD,
      `referral:${referral.id}`,
      `referral-referrer:${referral.id}`,
      'referral_first_send_reward',
    );
    const updated = await transaction.query<ReferralRow>(
      `
        UPDATE referral_invites
        SET
          status = 'rewarded',
          rewarded_at = NOW(),
          qualifying_order_id = $2,
          updated_at = NOW()
        WHERE id = $1
          AND status = 'claimed'
        RETURNING ${this.referralColumns};
      `,
      [referral.id, qualifyingOrderId],
    );
    if (!updated.rows[0]) return null;
    await this.writeAudit(
      transaction,
      referral.referrer_user_id,
      'referral_first_send_rewarded',
      referral.id,
      { referredUserId, qualifyingOrderId, rewardCredits: REFERRER_REWARD },
    );
    return this.toInvite(updated.rows[0]);
  }

  private programRules() {
    return {
      inviteeStarterCreditsTotal: INVITEE_STARTER_TOTAL,
      inviteeReferralBonusCredits: INVITEE_BONUS,
      referrerRewardCredits: REFERRER_REWARD,
      referrerQualification: 'first_physical_send',
    };
  }

  private toInvite(invite: ReferralRow) {
    const token = this.inviteToken(invite.id);
    return {
      id: invite.id,
      invitedEmail: invite.invited_email,
      status: invite.status,
      deliveryStatus: invite.delivery_status,
      inviteeStarterCreditsTotal: INVITEE_STARTER_TOTAL,
      referrerRewardCredits: invite.referrer_credit_amount,
      token,
      path: `/r/${encodeURIComponent(token)}`,
      claimedAt: this.toIso(invite.claimed_at),
      rewardedAt: this.toIso(invite.rewarded_at),
      createdAt: this.toIso(invite.created_at),
    };
  }

  private referrerToken(userId: string) {
    return this.token('u', userId);
  }

  private inviteToken(inviteId: string) {
    return this.token('i', inviteId);
  }

  private token(kind: 'u' | 'i', id: string) {
    return `${kind}.${id}.${this.sign(`referral:${kind}:${id}`)}`;
  }

  private parseToken(token: string) {
    const match = token
      .trim()
      .match(
        /^([ui])\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9a-f]{64})$/i,
      );
    if (!match) throw new NotFoundException('This referral link is invalid.');
    const kind = match[1].toLowerCase() as 'u' | 'i';
    const expected = this.sign(`referral:${kind}:${match[2]}`);
    const suppliedBuffer = Buffer.from(match[3], 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      throw new NotFoundException('This referral link is invalid.');
    }
    return {
      kind: kind === 'u' ? ('user' as const) : ('invite' as const),
      id: match[2],
    };
  }

  private sign(value: string) {
    return createHmac('sha256', this.tokenSecret()).update(value).digest('hex');
  }

  private tokenSecret() {
    const configured =
      this.configService.get<string>('GIFT_REFERRAL_HMAC_SECRET')?.trim() ||
      this.configService.get<string>('PUBLIC_LINK_HMAC_SECRET')?.trim();
    if (configured) {
      if (Buffer.byteLength(configured, 'utf8') < 32) {
        throw new InternalServerErrorException(
          'GIFT_REFERRAL_HMAC_SECRET must contain at least 32 bytes.',
        );
      }
      return configured;
    }
    if (
      this.configService.get<string>('NODE_ENV')?.trim().toLowerCase() !==
      'production'
    ) {
      return 'souvenote-local-gift-referral-secret-change-before-production';
    }
    throw new InternalServerErrorException(
      'GIFT_REFERRAL_HMAC_SECRET is required in production.',
    );
  }

  private async findUser(
    transaction: DatabaseTransaction,
    userId: string,
    forUpdate: boolean,
  ) {
    const result = await transaction.query<UserRow>(
      `
        SELECT id, email, first_name, created_at
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        ${forUpdate ? 'FOR UPDATE' : ''};
      `,
      [userId],
    );
    const user = result.rows[0];
    if (!user) throw new BadRequestException('Referral user was not found.');
    return user;
  }

  private normalizeEmail(value: string) {
    const email = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      throw new BadRequestException('Referral email is invalid.');
    }
    return email;
  }

  private async writeAudit(
    transaction: DatabaseTransaction,
    userId: string,
    action: string,
    referralId: string,
    metadata: Record<string, unknown>,
  ) {
    await transaction.query(
      `
        INSERT INTO audit_logs (
          user_id, action, entity_type, entity_id, metadata
        )
        VALUES ($1, $2, 'referral_invite', $3, $4::jsonb);
      `,
      [userId, action, referralId, JSON.stringify(metadata)],
    );
  }

  private toIso(value: Date | string | null) {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
  }

  private get referralColumns() {
    return this.referralColumnsFor('referral_invites');
  }

  private referralColumnsFor(alias: string) {
    return `
      ${alias}.id,
      ${alias}.referrer_user_id,
      ${alias}.invited_email,
      ${alias}.status,
      ${alias}.delivery_status,
      ${alias}.referred_user_id,
      ${alias}.invitee_credit_amount,
      ${alias}.referrer_credit_amount,
      ${alias}.idempotency_key,
      ${alias}.claimed_at,
      ${alias}.rewarded_at,
      ${alias}.qualifying_order_id,
      ${alias}.created_at,
      ${alias}.updated_at
    `;
  }
}
