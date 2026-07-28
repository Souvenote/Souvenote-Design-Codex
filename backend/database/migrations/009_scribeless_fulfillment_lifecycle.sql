-- Durable provider-neutral fulfillment attempts and Scribeless recipient polling.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS recipient_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS fulfillment_status_updated_at TIMESTAMPTZ;

UPDATE orders order_record
SET recipient_addresses = COALESCE(
    (
        SELECT jsonb_agg(COALESCE(order_record.recipient_address, '{}'::jsonb) ORDER BY copy_number)
        FROM generate_series(1, order_record.quantity) AS copy_number
    ),
    '[]'::jsonb
)
WHERE jsonb_array_length(order_record.recipient_addresses) = 0;

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_recipient_addresses_check;

ALTER TABLE orders
    ADD CONSTRAINT orders_recipient_addresses_check
    CHECK (
        jsonb_typeof(recipient_addresses) = 'array'
        AND jsonb_array_length(recipient_addresses) = quantity
    );

ALTER TABLE fulfillment_jobs
    ALTER COLUMN mock_fulfillment_id DROP NOT NULL,
    ALTER COLUMN estimated_delivery DROP NOT NULL,
    ALTER COLUMN submitted_at DROP NOT NULL,
    ALTER COLUMN submitted_at DROP DEFAULT,
    ADD COLUMN IF NOT EXISTS provider_fulfillment_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_recipient_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS provider_campaign_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_status VARCHAR(100),
    ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS status_reason TEXT,
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

UPDATE fulfillment_jobs
SET
    provider_fulfillment_id = COALESCE(provider_fulfillment_id, mock_fulfillment_id),
    provider_recipient_ids = CASE
        WHEN jsonb_array_length(provider_recipient_ids) = 0
             AND mock_fulfillment_id IS NOT NULL
            THEN jsonb_build_array(mock_fulfillment_id)
        ELSE provider_recipient_ids
    END,
    provider_status = COALESCE(provider_status, status),
    idempotency_key = COALESCE(idempotency_key, 'legacy:' || id::text),
    completed_at = CASE
        WHEN status = 'fulfilled_mock' THEN COALESCE(completed_at, updated_at)
        ELSE completed_at
    END,
    last_synced_at = COALESCE(last_synced_at, updated_at);

ALTER TABLE fulfillment_jobs
    ALTER COLUMN idempotency_key SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fulfillment_jobs_provider_mode_check'
          AND conrelid = 'fulfillment_jobs'::regclass
    ) THEN
        ALTER TABLE fulfillment_jobs
            ADD CONSTRAINT fulfillment_jobs_provider_mode_check
            CHECK (provider_mode IN ('mock', 'scribeless'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fulfillment_jobs_attempt_number_check'
          AND conrelid = 'fulfillment_jobs'::regclass
    ) THEN
        ALTER TABLE fulfillment_jobs
            ADD CONSTRAINT fulfillment_jobs_attempt_number_check
            CHECK (attempt_number > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fulfillment_jobs_recipient_ids_check'
          AND conrelid = 'fulfillment_jobs'::regclass
    ) THEN
        ALTER TABLE fulfillment_jobs
            ADD CONSTRAINT fulfillment_jobs_recipient_ids_check
            CHECK (jsonb_typeof(provider_recipient_ids) = 'array');
    END IF;
END
$$;

ALTER TABLE fulfillment_jobs
    DROP CONSTRAINT IF EXISTS fulfillment_jobs_status_check;

ALTER TABLE fulfillment_jobs
    ADD CONSTRAINT fulfillment_jobs_status_check
    CHECK (status IN (
        'creating',
        'submitting',
        'submitted',
        'printing',
        'shipped',
        'delivered',
        'on_hold',
        'failed',
        'submission_unknown',
        'fulfilled_mock'
    ));

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'pending',
        'checkout_started',
        'payment_authorized',
        'paid',
        'paid_mock',
        'closed_no_send',
        'payment_failed',
        'payment_canceled',
        'checkout_expired',
        'fulfillment_started',
        'fulfillment_submitted',
        'printing',
        'shipped',
        'delivered',
        'fulfillment_on_hold',
        'fulfillment_failed',
        'fulfilled_mock',
        'failed_mock'
    ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillment_jobs_idempotency_key
    ON fulfillment_jobs(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillment_jobs_provider_id
    ON fulfillment_jobs(provider_mode, provider_fulfillment_id)
    WHERE provider_fulfillment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillment_jobs_order_attempt
    ON fulfillment_jobs(order_id, attempt_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fulfillment_jobs_active_order
    ON fulfillment_jobs(order_id)
    WHERE status IN (
        'creating',
        'submitting',
        'submitted',
        'printing',
        'shipped',
        'delivered',
        'on_hold',
        'submission_unknown',
        'fulfilled_mock'
    );

CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_sync_due
    ON fulfillment_jobs(provider_mode, status, last_synced_at)
    WHERE provider_mode = 'scribeless'
      AND status IN ('submitted', 'printing', 'on_hold');
