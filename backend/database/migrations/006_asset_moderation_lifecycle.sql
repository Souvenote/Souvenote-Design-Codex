-- Durable moderation work for uploaded and generated media.

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS moderation_reason_code VARCHAR(100);

UPDATE assets
SET moderation_state = CASE
    WHEN moderation_state IN (
        'pending', 'approved', 'approved_mock', 'rejected', 'failed'
    ) THEN moderation_state
    ELSE 'pending'
END;

UPDATE assets
SET moderated_at = COALESCE(moderated_at, created_at)
WHERE moderation_state IN ('approved', 'approved_mock', 'rejected');

ALTER TABLE assets
    ALTER COLUMN moderation_state SET DEFAULT 'pending',
    ALTER COLUMN moderation_state SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'assets_moderation_state_check'
          AND conrelid = 'assets'::regclass
    ) THEN
        ALTER TABLE assets
            ADD CONSTRAINT assets_moderation_state_check
            CHECK (moderation_state IN (
                'pending', 'approved', 'approved_mock', 'rejected', 'failed'
            ));
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS asset_moderation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_mode VARCHAR(50) NOT NULL DEFAULT 'manual',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    attempt_number INTEGER NOT NULL DEFAULT 1,
    provider_job_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT asset_moderation_jobs_status_check CHECK (
        status IN ('pending', 'running', 'approved', 'rejected', 'failed')
    ),
    CONSTRAINT asset_moderation_jobs_attempt_check CHECK (attempt_number > 0),
    CONSTRAINT asset_moderation_jobs_asset_attempt_unique UNIQUE (
        asset_id, attempt_number
    )
);

INSERT INTO asset_moderation_jobs (
    asset_id,
    user_id,
    provider_mode,
    status,
    attempt_number
)
SELECT
    asset.id,
    asset.user_id,
    'manual',
    'pending',
    1
FROM assets asset
WHERE asset.moderation_state = 'pending'
  AND asset.asset_type IN ('upload', 'image', 'song')
ON CONFLICT (asset_id, attempt_number) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_moderation_jobs_active_asset
    ON asset_moderation_jobs(asset_id)
    WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_asset_moderation_jobs_queue
    ON asset_moderation_jobs(status, created_at);

CREATE INDEX IF NOT EXISTS idx_assets_moderation_queue
    ON assets(moderation_state, created_at)
    WHERE moderation_state IN ('pending', 'failed');
