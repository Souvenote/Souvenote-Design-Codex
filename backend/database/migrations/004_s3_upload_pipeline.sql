-- Provider-aware direct upload tracking for mock and private Amazon S3 assets.

ALTER TABLE uploads
    ALTER COLUMN mock_url DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS provider_mode VARCHAR(20) NOT NULL DEFAULT 'mock',
    ADD COLUMN IF NOT EXISTS upload_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS etag VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uploads_provider_mode_check'
          AND conrelid = 'uploads'::regclass
    ) THEN
        ALTER TABLE uploads
            ADD CONSTRAINT uploads_provider_mode_check
            CHECK (provider_mode IN ('mock', 's3'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_uploads_status
    ON uploads(status);

CREATE INDEX IF NOT EXISTS idx_uploads_uncommitted
    ON uploads(created_at)
    WHERE status = 'requested';
