-- Durable Stripe checkout attempts, authorization lifecycle, and webhook dedupe.

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    ADD COLUMN IF NOT EXISTS capture_method VARCHAR(30) NOT NULL DEFAULT 'automatic_async',
    ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS amount_captured_cents INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS finalization_action VARCHAR(30),
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE payments payment
SET currency = order_record.currency
FROM orders order_record
WHERE payment.order_id = order_record.id
  AND payment.currency = 'usd'
  AND order_record.currency <> 'usd';

UPDATE payments
SET capture_method = CASE
    WHEN offer_code = 'try_risk_free_one_card' THEN 'manual'
    ELSE 'automatic_async'
END
WHERE capture_method = 'automatic_async';

UPDATE payments
SET idempotency_key = 'legacy:' || id::text
WHERE idempotency_key IS NULL;

ALTER TABLE payments
    ALTER COLUMN idempotency_key SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payments_provider_mode_check'
          AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_provider_mode_check
            CHECK (provider_mode IN ('mock', 'stripe'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payments_capture_method_check'
          AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_capture_method_check
            CHECK (capture_method IN ('manual', 'automatic_async'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payments_attempt_number_check'
          AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_attempt_number_check
            CHECK (attempt_number > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payments_amount_captured_check'
          AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_amount_captured_check
            CHECK (
                amount_captured_cents >= 0
                AND amount_captured_cents <= amount_cents
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payments_finalization_action_check'
          AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_finalization_action_check
            CHECK (
                finalization_action IS NULL
                OR finalization_action IN ('send', 'not_send')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'orders_status_check'
          AND conrelid = 'orders'::regclass
    ) THEN
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
                'fulfilled_mock',
                'failed_mock'
            ));
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_attempt
    ON payments(order_id, attempt_number)
    WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
    ON payments(idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_checkout_session_unique
    ON payments(checkout_session_id)
    WHERE checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_intent_unique
    ON payments(stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_active_order
    ON payments(order_id)
    WHERE order_id IS NOT NULL
      AND status IN ('creating', 'checkout_started', 'authorized');

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    object_id VARCHAR(255),
    livemode BOOLEAN NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    attempt_count INTEGER NOT NULL DEFAULT 1,
    event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stripe_webhook_events_status_check CHECK (
        status IN ('processing', 'processed', 'ignored')
    ),
    CONSTRAINT stripe_webhook_events_attempt_check CHECK (attempt_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_created
    ON stripe_webhook_events(event_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_unique
    ON users(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
