import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreditsService } from '../credits/credits.service';
import { DatabaseService } from '../database/database.service';
import { StartGenerationDto } from './generation.controller';

@Injectable()
export class GenerationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly creditsService: CreditsService,
  ) {}

  async startGeneration(dto: StartGenerationDto) {
    const generationCost = 2;

    if (dto.cardDraftId) {
      await this.ensureCardDraftExists(dto.userId, dto.cardDraftId);
    }

    const deduction = await this.creditsService.deduct(
      dto.userId,
      generationCost,
      'mock_generation',
      `${dto.idempotencyKey}-deduct`,
    );

    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO generation_jobs (
            user_id,
            card_draft_id,
            image_status,
            song_status,
            message_status,
            provider_mode,
            credits_charged
          )
          VALUES ($1, $2, 'ready', 'ready', 'ready', 'mock', $3)
          RETURNING
            id,
            user_id,
            card_draft_id,
            image_status,
            song_status,
            message_status,
            provider_mode,
            credits_charged,
            created_at,
            updated_at;
        `,
        [dto.userId, dto.cardDraftId ?? null, generationCost],
      );

      const generationJob = result.rows[0];

      // TODO(Phase 2): replace these mock records with fal.ai image/music
      // outputs and provider-backed generated asset references.
      const assetsResult = await this.databaseService.query(
        `
          INSERT INTO assets (
            user_id,
            card_draft_id,
            generation_job_id,
            asset_type,
            s3_key,
            moderation_state,
            qr_metadata
          )
          VALUES
            ($1, $2, $3, 'image', 'mock/card-image.png', 'approved_mock', '{}'::jsonb),
            ($1, $2, $3, 'song', 'mock/song.mp3', 'approved_mock', '{}'::jsonb),
            ($1, $2, $3, 'message', 'mock/inside-message.txt', 'approved_mock', '{}'::jsonb)
          RETURNING
            id,
            user_id,
            card_draft_id,
            generation_job_id,
            asset_type,
            s3_key,
            moderation_state,
            approved_at,
            print_asset_key,
            qr_metadata,
            created_at;
        `,
        [dto.userId, dto.cardDraftId ?? null, generationJob.id],
      );

      const updatedBalance = await this.creditsService.findBalance(dto.userId);

      return {
        generationJob,
        savedAssets: assetsResult.rows,
        mockAssets: {
          image: {
            status: 'ready',
            mockUrl: 'mock://souvenote/card-image.png',
          },
          song: {
            status: 'ready',
            mockUrl: 'mock://souvenote/song.mp3',
          },
          message: {
            status: 'ready',
            text: 'Happy birthday! This Souvenote message was generated in mock mode.',
          },
        },
        creditDeduction: deduction.ledgerEntry,
        balance: updatedBalance,
      };
    } catch {
      await this.creditsService.refund(
        dto.userId,
        generationCost,
        'mock_generation_failed',
        `${dto.idempotencyKey}-refund`,
      );

      throw new BadRequestException(
        'Generation failed after credits were deducted. Credits were refunded.',
      );
    }
  }

  private async ensureCardDraftExists(userId: string, cardDraftId: string) {
    const result = await this.databaseService.query(
      `
        SELECT id
        FROM card_drafts
        WHERE id = $1
          AND user_id = $2
          AND deleted_at IS NULL;
      `,
      [cardDraftId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Card draft not found.');
    }
  }
}
