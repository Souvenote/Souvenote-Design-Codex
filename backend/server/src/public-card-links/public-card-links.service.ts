import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { UploadStorageService } from '../uploads/upload-storage.service';

type PublicLinkRow = {
  token_hash: string;
  status: string;
};

type PublicOrderRow = {
  order_id: string;
  user_id: string;
  card_draft_id: string;
  selected_asset_id: string;
  occasion: string | null;
};

type PublicAssetRow = {
  id: string;
  asset_type: string;
  s3_key: string | null;
  qr_metadata: Record<string, unknown> | null;
};

@Injectable()
export class PublicCardLinksService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly uploadStorageService: UploadStorageService,
  ) {}

  async getOrCreateToken(orderId: string) {
    const token = this.deriveToken(orderId);
    const tokenHash = this.hashToken(token);
    await this.databaseService.query(
      `
        INSERT INTO public_card_links (order_id, token_hash)
        VALUES ($1, $2)
        ON CONFLICT (order_id) DO NOTHING;
      `,
      [orderId, tokenHash],
    );
    const existing = await this.databaseService.query<PublicLinkRow>(
      `
        SELECT token_hash, status
        FROM public_card_links
        WHERE order_id = $1;
      `,
      [orderId],
    );
    const link = existing.rows[0];
    if (!link) {
      throw new InternalServerErrorException(
        'The public Souvenote link could not be registered.',
      );
    }
    if (link.status !== 'active') {
      throw new ConflictException('The public Souvenote link is revoked.');
    }
    if (link.token_hash !== tokenHash) {
      throw new ConflictException(
        'PUBLIC_LINK_HMAC_SECRET does not match the existing printed-link configuration.',
      );
    }
    return token;
  }

  async getPublicSouvenote(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException('Souvenote not found.');
    }
    const orderResult = await this.databaseService.query<PublicOrderRow>(
      `
        UPDATE public_card_links link
        SET
          access_count = access_count + 1,
          last_accessed_at = NOW(),
          updated_at = NOW()
        FROM orders order_record
        INNER JOIN card_drafts draft
          ON draft.id = order_record.card_draft_id
        WHERE link.token_hash = $1
          AND link.status = 'active'
          AND order_record.id = link.order_id
          AND order_record.status IN (
            'fulfillment_started',
            'fulfillment_submitted',
            'printing',
            'shipped',
            'delivered',
            'fulfillment_on_hold'
          )
        RETURNING
          order_record.id AS order_id,
          order_record.user_id,
          order_record.card_draft_id,
          order_record.selected_asset_id,
          draft.occasion;
      `,
      [this.hashToken(token)],
    );
    const order = orderResult.rows[0];
    if (!order) {
      throw new NotFoundException('Souvenote not found.');
    }

    const assetsResult = await this.databaseService.query<PublicAssetRow>(
      `
        WITH selected AS (
          SELECT generation_job_id
          FROM assets
          WHERE id = $1
            AND user_id = $2
            AND card_draft_id = $3
            AND asset_type = 'image'
            AND approved_at IS NOT NULL
            AND moderation_state IN ('approved', 'approved_mock')
        )
        SELECT asset.id, asset.asset_type, asset.s3_key, asset.qr_metadata
        FROM assets asset
        INNER JOIN selected
          ON selected.generation_job_id = asset.generation_job_id
        WHERE asset.user_id = $2
          AND asset.card_draft_id = $3
          AND asset.asset_type IN ('image', 'song', 'message')
          AND asset.approved_at IS NOT NULL
          AND asset.moderation_state IN ('approved', 'approved_mock')
          AND (asset.asset_type <> 'image' OR asset.id = $1)
        ORDER BY asset.created_at ASC;
      `,
      [order.selected_asset_id, order.user_id, order.card_draft_id],
    );
    const image = assetsResult.rows.find(
      (asset) => asset.asset_type === 'image',
    );
    const song = assetsResult.rows.find((asset) => asset.asset_type === 'song');
    const message = assetsResult.rows.find(
      (asset) => asset.asset_type === 'message',
    );
    if (!image?.s3_key || !song?.s3_key) {
      throw new NotFoundException('Souvenote not found.');
    }
    const [imageUrl, songUrl] = await Promise.all([
      this.uploadStorageService.createReadUrl(image.s3_key, {
        expiresInSetting: 'PUBLIC_ASSET_URL_EXPIRES_SECONDS',
        defaultExpiresIn: 300,
      }),
      this.uploadStorageService.createReadUrl(song.s3_key, {
        expiresInSetting: 'PUBLIC_ASSET_URL_EXPIRES_SECONDS',
        defaultExpiresIn: 300,
      }),
    ]);
    if (!imageUrl || !songUrl) {
      throw new NotFoundException('Souvenote not found.');
    }
    const insideMessage =
      typeof message?.qr_metadata?.text === 'string'
        ? message.qr_metadata.text.trim()
        : null;
    return {
      occasion: order.occasion,
      imageUrl,
      songUrl,
      insideMessage,
      assetUrlExpiresInSeconds: this.readExpiry(),
    };
  }

  private deriveToken(orderId: string) {
    const secret = this.configService
      .get<string>('PUBLIC_LINK_HMAC_SECRET')
      ?.trim()
      .toLowerCase();
    if (!secret || !/^[0-9a-f]{64}$/.test(secret)) {
      throw new InternalServerErrorException(
        'PUBLIC_LINK_HMAC_SECRET must be a 64-character hexadecimal secret.',
      );
    }
    return createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(`souvenote-public-link:v1:${orderId}`)
      .digest('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private readExpiry() {
    const configured = this.configService.get<string>(
      'PUBLIC_ASSET_URL_EXPIRES_SECONDS',
    );
    if (!configured) return 300;
    const value = Number(configured);
    if (!Number.isInteger(value) || value < 60 || value > 3600) {
      throw new InternalServerErrorException(
        'PUBLIC_ASSET_URL_EXPIRES_SECONDS must be an integer between 60 and 3600.',
      );
    }
    return value;
  }
}
