-- Durable, idempotent generation jobs with provider-neutral lifecycle metadata.

ALTER TABLE generation_jobs
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS overall_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS requested_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS provider_job_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS result_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

UPDATE generation_jobs
SET
    idempotency_key = COALESCE(idempotency_key, 'legacy-' || id::text),
    overall_status = CASE
        WHEN image_status = 'ready'
          AND song_status = 'ready'
          AND message_status = 'ready'
        THEN 'ready'
        WHEN image_status = 'failed'
          OR song_status = 'failed'
          OR message_status = 'failed'
        THEN 'failed'
        ELSE overall_status
    END,
    requested_assets = CASE
        WHEN requested_assets = '[]'::jsonb
        THEN '["image", "song", "message"]'::jsonb
        ELSE requested_assets
    END,
    started_at = COALESCE(started_at, created_at),
    completed_at = CASE
        WHEN image_status = 'ready'
          AND song_status = 'ready'
          AND message_status = 'ready'
        THEN COALESCE(completed_at, updated_at)
        ELSE completed_at
    END
WHERE idempotency_key IS NULL
   OR requested_assets = '[]'::jsonb;

ALTER TABLE generation_jobs
    ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_jobs_user_idempotency
    ON generation_jobs(user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_overall_status
    ON generation_jobs(overall_status, updated_at);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'generation_jobs_overall_status_check'
          AND conrelid = 'generation_jobs'::regclass
    ) THEN
        ALTER TABLE generation_jobs
            ADD CONSTRAINT generation_jobs_overall_status_check
            CHECK (overall_status IN (
                'pending', 'running', 'ready', 'failed', 'refunded', 'canceled'
            ));
    END IF;
END
$$;
