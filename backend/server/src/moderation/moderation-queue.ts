import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DatabaseTransaction } from '../database/database.service';

export type ModerationProviderMode = 'manual';

type ModeratableAsset = {
  id: string;
  user_id: string;
  moderation_state: string | null;
};

export function resolveModerationProviderMode(
  configService: ConfigService,
): ModerationProviderMode {
  const configured =
    configService
      .get<string>('MODERATION_PROVIDER_MODE')
      ?.trim()
      .toLowerCase() || 'manual';

  if (configured !== 'manual') {
    throw new InternalServerErrorException(
      'MODERATION_PROVIDER_MODE must be manual until another moderation provider is configured.',
    );
  }

  return configured;
}

export async function enqueuePendingModerationJob(
  transaction: DatabaseTransaction,
  asset: ModeratableAsset,
  providerMode: ModerationProviderMode,
) {
  if (asset.moderation_state !== 'pending') {
    return null;
  }

  const result = await transaction.query<{ id: string }>(
    `
      INSERT INTO asset_moderation_jobs (
        asset_id,
        user_id,
        provider_mode,
        status,
        attempt_number
      )
      VALUES ($1, $2, $3, 'pending', 1)
      ON CONFLICT (asset_id, attempt_number) DO NOTHING
      RETURNING id;
    `,
    [asset.id, asset.user_id, providerMode],
  );

  return result.rows[0]?.id ?? null;
}
