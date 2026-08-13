import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { CardEntitlementsService } from '../card-entitlements/card-entitlements.service';
import { CreditsService } from '../credits/credits.service';
import {
  DatabaseService,
  type DatabaseTransaction,
} from '../database/database.service';

export type GiftCheckoutInput = {
  recipientName?: string;
  recipientContact?: string;
  deliveryMethod?: 'email' | 'text';
  personalMessage?: string;
};

type GiftRow = {
  id: string;
  purchaser_user_id: string;
  card_pack_purchase_id: string;
  status: 'awaiting_payment' | 'ready' | 'redeemed' | 'canceled';
  delivery_method: 'email' | 'text';
  recipient_name: string;
  recipient_contact: string;
  personal_message: string | null;
  card_amount: number;
  credit_amount: number;
  printing_included: boolean;
  standard_delivery_included: boolean;
  delivery_status: string;
  redeemed_by_user_id: string | null;
  ready_at: Date | string | null;
  delivered_at: Date | string | null;
  redeemed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type GiftPreviewRow = GiftRow & {
  purchaser_first_name: string | null;
};

const GIFT_CARD_AMOUNT = 1;
const GIFT_CREDIT_AMOUNT = 10;

@Injectable()
export class GiftsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly cardEntitlementsService: CardEntitlementsService,
    private readonly creditsService: CreditsService,
  ) {}

  async ensureGiftForCardPack(
    transaction: DatabaseTransaction,
    purchaserUserId: string,
    cardPackPurchaseId: string,
    offerType: string,
    input: GiftCheckoutInput,
  ) {
    const hasGiftInput = Boolean(
      input.recipientName ||
      input.recipientContact ||
      input.deliveryMethod ||
      input.personalMessage,
    );
    if (offerType !== 'gift') {
      if (hasGiftInput) {
        throw new BadRequestException(
          'Gift recipient details can only be used with a gift offer.',
        );
      }
      return null;
    }

    const normalized = this.normalizeGiftInput(input);
    const existingResult = await transaction.query<GiftRow>(
      `
        SELECT ${this.giftColumns}
        FROM gift_purchases
        WHERE card_pack_purchase_id = $1
        FOR UPDATE;
      `,
      [cardPackPurchaseId],
    );
    let gift = existingResult.rows[0];
    if (gift) {
      if (
        gift.purchaser_user_id !== purchaserUserId ||
        gift.recipient_name !== normalized.recipientName ||
        gift.recipient_contact !== normalized.recipientContact ||
        gift.delivery_method !== normalized.deliveryMethod ||
        (gift.personal_message ?? '') !== normalized.personalMessage
      ) {
        throw new ConflictException(
          'The checkout idempotency key is already used for different gift details.',
        );
      }
    } else {
      const inserted = await transaction.query<GiftRow>(
        `
          INSERT INTO gift_purchases (
            purchaser_user_id,
            card_pack_purchase_id,
            delivery_method,
            recipient_name,
            recipient_contact,
            personal_message
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING ${this.giftColumns};
        `,
        [
          purchaserUserId,
          cardPackPurchaseId,
          normalized.deliveryMethod,
          normalized.recipientName,
          normalized.recipientContact,
          normalized.personalMessage || null,
        ],
      );
      gift = inserted.rows[0];
    }

    await transaction.query(
      `
        UPDATE card_pack_purchases
        SET gift_purchase_id = $2, updated_at = NOW()
        WHERE id = $1
          AND (gift_purchase_id IS NULL OR gift_purchase_id = $2);
      `,
      [cardPackPurchaseId, gift.id],
    );
    return gift;
  }

  async reservePaidGiftInTransaction(
    transaction: DatabaseTransaction,
    giftPurchaseId: string,
    purchase: {
      id: string;
      user_id: string;
      card_amount: number;
      credit_amount: number;
    },
  ) {
    const result = await transaction.query<GiftRow>(
      `
        SELECT ${this.giftColumns}
        FROM gift_purchases
        WHERE id = $1
          AND card_pack_purchase_id = $2
          AND purchaser_user_id = $3
        FOR UPDATE;
      `,
      [giftPurchaseId, purchase.id, purchase.user_id],
    );
    const gift = result.rows[0];
    if (!gift) {
      throw new ConflictException('The paid gift purchase could not be found.');
    }
    if (
      purchase.card_amount !== GIFT_CARD_AMOUNT ||
      purchase.credit_amount !== GIFT_CREDIT_AMOUNT
    ) {
      throw new ConflictException('The paid gift entitlement is invalid.');
    }
    if (gift.status === 'canceled') {
      throw new ConflictException('A canceled gift cannot be funded.');
    }

    const source = `gift-purchase:${gift.id}`;
    const cardReservation =
      await this.cardEntitlementsService.reserveGiftInTransaction(
        transaction,
        purchase.user_id,
        gift.card_amount,
        source,
        `${source}:card-reservation`,
      );
    const creditReservation =
      await this.creditsService.reserveGiftInTransaction(
        transaction,
        purchase.user_id,
        gift.credit_amount,
        source,
        `${source}:credit-reservation`,
      );
    const updated = await transaction.query<GiftRow>(
      `
        UPDATE gift_purchases
        SET
          status = CASE WHEN status = 'redeemed' THEN status ELSE 'ready' END,
          delivery_status = CASE
            WHEN status = 'redeemed' THEN delivery_status
            ELSE 'mock_delivered'
          END,
          ready_at = COALESCE(ready_at, NOW()),
          delivered_at = COALESCE(delivered_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${this.giftColumns};
      `,
      [gift.id],
    );
    return {
      gift: this.toGiftResponse(updated.rows[0]),
      cardBalance: cardReservation.balance,
      creditBalance: creditReservation.balance,
    };
  }

  async listOwnedGifts(userId: string) {
    const result = await this.databaseService.query<GiftRow>(
      `
        SELECT ${this.giftColumns}
        FROM gift_purchases
        WHERE purchaser_user_id = $1
        ORDER BY created_at DESC
        LIMIT 100;
      `,
      [userId],
    );
    return { gifts: result.rows.map((gift) => this.toGiftResponse(gift)) };
  }

  async preview(token: string) {
    const giftId = this.parseToken(token);
    const result = await this.databaseService.query<GiftPreviewRow>(
      `
        SELECT
          ${this.giftColumnsFor('gift')},
          purchaser.first_name AS purchaser_first_name
        FROM gift_purchases gift
        INNER JOIN users purchaser ON purchaser.id = gift.purchaser_user_id
        WHERE gift.id = $1
          AND gift.status IN ('ready', 'redeemed')
        LIMIT 1;
      `,
      [giftId],
    );
    const gift = result.rows[0];
    if (!gift) throw new NotFoundException('This gift is not available.');
    return {
      gift: {
        ...this.toPublicGiftResponse(gift),
        senderName: gift.purchaser_first_name?.trim() || 'A friend',
      },
    };
  }

  async redeem(userId: string, token: string) {
    const giftId = this.parseToken(token);
    return this.databaseService.withTransaction(async (transaction) => {
      const result = await transaction.query<GiftRow>(
        `
          SELECT ${this.giftColumns}
          FROM gift_purchases
          WHERE id = $1
          FOR UPDATE;
        `,
        [giftId],
      );
      const gift = result.rows[0];
      if (!gift || !['ready', 'redeemed'].includes(gift.status)) {
        throw new NotFoundException('This gift is not available.');
      }
      if (gift.purchaser_user_id === userId) {
        throw new ConflictException('You cannot redeem your own gift.');
      }
      if (gift.status === 'redeemed') {
        if (gift.redeemed_by_user_id !== userId) {
          throw new ConflictException('This gift has already been redeemed.');
        }
        return this.redemptionResponse(gift, userId, true);
      }
      if (gift.delivery_method === 'email') {
        const userResult = await transaction.query<{ email: string }>(
          'SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL;',
          [userId],
        );
        const email = userResult.rows[0]?.email?.trim().toLowerCase();
        if (!email || email !== gift.recipient_contact.toLowerCase()) {
          throw new ConflictException(
            'Log in with the email address this gift was sent to.',
          );
        }
      }

      const source = `gift-redemption:${gift.id}`;
      const cardResult =
        await this.cardEntitlementsService.grantOnceInTransaction(
          transaction,
          userId,
          gift.card_amount,
          source,
          `${source}:card`,
          'gift_redemption',
        );
      const creditResult = await this.creditsService.grantOnceInTransaction(
        transaction,
        userId,
        gift.credit_amount,
        source,
        `${source}:credits`,
        'gift_redemption',
      );
      const updated = await transaction.query<GiftRow>(
        `
          UPDATE gift_purchases
          SET
            status = 'redeemed',
            redeemed_by_user_id = $2,
            redeemed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
            AND status = 'ready'
          RETURNING ${this.giftColumns};
        `,
        [gift.id, userId],
      );
      if (!updated.rows[0]) {
        throw new ConflictException('This gift changed while being redeemed.');
      }
      await transaction.query(
        `
          INSERT INTO audit_logs (
            user_id, action, entity_type, entity_id, metadata
          )
          VALUES ($1, 'gift_redeemed', 'gift_purchase', $2, $3::jsonb);
        `,
        [
          userId,
          gift.id,
          JSON.stringify({
            purchaserUserId: gift.purchaser_user_id,
            cardAmount: gift.card_amount,
            creditAmount: gift.credit_amount,
            standardDeliveryIncluded: gift.standard_delivery_included,
          }),
        ],
      );
      return {
        ...this.redemptionResponse(updated.rows[0], userId, false),
        cardBalance: cardResult.balance,
        creditBalance: creditResult.balance,
      };
    });
  }

  claimToken(giftPurchaseId: string) {
    const signature = this.sign(`gift:${giftPurchaseId}`);
    return `g.${giftPurchaseId}.${signature}`;
  }

  toCheckoutGift(giftPurchaseId: string) {
    const token = this.claimToken(giftPurchaseId);
    return {
      id: giftPurchaseId,
      claimToken: token,
      redemptionPath: `/gift/redeem?token=${encodeURIComponent(token)}`,
      cardAmount: GIFT_CARD_AMOUNT,
      creditAmount: GIFT_CREDIT_AMOUNT,
      printingIncluded: true,
      standardDeliveryIncluded: true,
    };
  }

  private redemptionResponse(gift: GiftRow, userId: string, replay: boolean) {
    return {
      gift: this.toPublicGiftResponse(gift),
      redeemedByUserId: userId,
      idempotentReplay: replay,
    };
  }

  private normalizeGiftInput(input: GiftCheckoutInput) {
    const recipientName = input.recipientName?.trim().slice(0, 120) || '';
    const deliveryMethod = input.deliveryMethod;
    let recipientContact = input.recipientContact?.trim() || '';
    const personalMessage = input.personalMessage?.trim().slice(0, 500) || '';
    if (!recipientName || !deliveryMethod || !recipientContact) {
      throw new BadRequestException(
        'Recipient name, delivery method, and contact are required for a gift.',
      );
    }
    if (deliveryMethod === 'email') {
      recipientContact = recipientContact.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientContact)) {
        throw new BadRequestException('Gift recipient email is invalid.');
      }
    } else {
      recipientContact = recipientContact.replace(/[\s().-]/g, '');
      if (!/^\+?[0-9]{7,20}$/.test(recipientContact)) {
        throw new BadRequestException(
          'Gift recipient mobile number is invalid.',
        );
      }
    }
    return {
      recipientName,
      recipientContact: recipientContact.slice(0, 320),
      deliveryMethod,
      personalMessage,
    };
  }

  private parseToken(token: string) {
    const match = token
      .trim()
      .match(
        /^g\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([0-9a-f]{64})$/i,
      );
    if (!match) throw new NotFoundException('This gift link is invalid.');
    const expected = this.sign(`gift:${match[1]}`);
    const suppliedBuffer = Buffer.from(match[2], 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      throw new NotFoundException('This gift link is invalid.');
    }
    return match[1];
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

  private toPublicGiftResponse(gift: GiftRow) {
    return {
      id: gift.id,
      status: gift.status,
      recipientName: gift.recipient_name,
      personalMessage: gift.personal_message,
      cardAmount: gift.card_amount,
      creditAmount: gift.credit_amount,
      printingIncluded: gift.printing_included,
      standardDeliveryIncluded: gift.standard_delivery_included,
      redeemedAt: this.toIso(gift.redeemed_at),
    };
  }

  private toGiftResponse(gift: GiftRow) {
    return {
      ...this.toPublicGiftResponse(gift),
      cardPackPurchaseId: gift.card_pack_purchase_id,
      deliveryMethod: gift.delivery_method,
      recipientContact: gift.recipient_contact,
      deliveryStatus: gift.delivery_status,
      claimToken: this.claimToken(gift.id),
      redemptionPath: `/gift/redeem?token=${encodeURIComponent(this.claimToken(gift.id))}`,
      readyAt: this.toIso(gift.ready_at),
      deliveredAt: this.toIso(gift.delivered_at),
      createdAt: this.toIso(gift.created_at),
      updatedAt: this.toIso(gift.updated_at),
    };
  }

  private toIso(value: Date | string | null) {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
  }

  private get giftColumns() {
    return this.giftColumnsFor('gift_purchases');
  }

  private giftColumnsFor(alias: string) {
    return `
      ${alias}.id,
      ${alias}.purchaser_user_id,
      ${alias}.card_pack_purchase_id,
      ${alias}.status,
      ${alias}.delivery_method,
      ${alias}.recipient_name,
      ${alias}.recipient_contact,
      ${alias}.personal_message,
      ${alias}.card_amount,
      ${alias}.credit_amount,
      ${alias}.printing_included,
      ${alias}.standard_delivery_included,
      ${alias}.delivery_status,
      ${alias}.redeemed_by_user_id,
      ${alias}.ready_at,
      ${alias}.delivered_at,
      ${alias}.redeemed_at,
      ${alias}.created_at,
      ${alias}.updated_at
    `;
  }
}
