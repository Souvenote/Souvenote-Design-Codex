-- Canada-first pricing and durable standalone credit-pack purchases.

ALTER TABLE pricing_catalog
    ALTER COLUMN currency SET DEFAULT 'cad';

ALTER TABLE orders
    ALTER COLUMN currency SET DEFAULT 'cad';

ALTER TABLE payments
    ALTER COLUMN currency SET DEFAULT 'cad';

UPDATE pricing_catalog
SET
    currency = 'cad',
    card_count_min = CASE
        WHEN offer_code = 'try_risk_free_one_card' THEN 1
        WHEN offer_code = 'big_sender_2_10' THEN 2
        ELSE card_count_min
    END,
    card_count_max = CASE
        WHEN offer_code = 'try_risk_free_one_card' THEN 1
        ELSE card_count_max
    END,
    metadata = CASE
        WHEN offer_code = 'try_risk_free_one_card' THEN
            COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                'hold_days', 5,
                'decision_window_starts_at', 'payment_authorized',
                'no_action_result', 'charge_no_send_fee',
                'no_send_fee_cents', 200
            )
        ELSE COALESCE(metadata, '{}'::jsonb)
    END,
    updated_at = NOW()
WHERE offer_code IN (
    'try_risk_free_one_card',
    'big_sender_2_10',
    'big_sender_11_20',
    'big_sender_21_30'
);

INSERT INTO pricing_catalog (
    offer_code,
    name,
    offer_type,
    price_cents,
    currency,
    card_count_min,
    card_count_max,
    credits_per_card,
    shipping_included,
    metadata
)
VALUES
(
    'credit_pack_starter_10',
    'Starter Credits',
    'credit_pack',
    200,
    'cad',
    0,
    0,
    10,
    FALSE,
    '{"credit_amount": 10, "blurb": "Top off a short session.", "accent": "platinum"}'::jsonb
),
(
    'credit_pack_creator_80',
    'Creator Credits',
    'credit_pack',
    1000,
    'cad',
    0,
    0,
    80,
    FALSE,
    '{"credit_amount": 80, "blurb": "A full evening of iteration.", "accent": "gold", "featured": true, "badge": "Most popular"}'::jsonb
),
(
    'credit_pack_power_250',
    'Power Credits',
    'credit_pack',
    2500,
    'cad',
    0,
    0,
    250,
    FALSE,
    '{"credit_amount": 250, "blurb": "For repeat senders and remixers.", "accent": "rose"}'::jsonb
)
ON CONFLICT (offer_code) DO UPDATE
SET
    name = EXCLUDED.name,
    offer_type = EXCLUDED.offer_type,
    price_cents = EXCLUDED.price_cents,
    currency = EXCLUDED.currency,
    card_count_min = EXCLUDED.card_count_min,
    card_count_max = EXCLUDED.card_count_max,
    credits_per_card = EXCLUDED.credits_per_card,
    shipping_included = EXCLUDED.shipping_included,
    metadata = EXCLUDED.metadata,
    is_active = TRUE,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS credit_pack_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pricing_catalog_id UUID NOT NULL REFERENCES pricing_catalog(id),
    offer_code VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    credit_amount INTEGER NOT NULL,
    pricing_snapshot JSONB NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    checkout_session_id VARCHAR(255),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT credit_pack_purchases_status_check CHECK (
        status IN (
            'pending',
            'checkout_started',
            'paid',
            'payment_failed',
            'payment_canceled',
            'checkout_expired'
        )
    ),
    CONSTRAINT credit_pack_purchases_amount_check CHECK (amount_cents > 0),
    CONSTRAINT credit_pack_purchases_credit_amount_check CHECK (credit_amount > 0),
    CONSTRAINT credit_pack_purchases_idempotency_check CHECK (
        char_length(trim(idempotency_key)) BETWEEN 8 AND 255
    ),
    CONSTRAINT credit_pack_purchases_user_idempotency_unique UNIQUE (
        user_id,
        idempotency_key
    )
);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS credit_pack_purchase_id UUID
        REFERENCES credit_pack_purchases(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS decision_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS finalization_claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credit_pack_purchases_user_created
    ON credit_pack_purchases(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_pack_purchases_status_updated
    ON credit_pack_purchases(status, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_pack_purchases_checkout_session
    ON credit_pack_purchases(checkout_session_id)
    WHERE checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_credit_pack_attempt
    ON payments(credit_pack_purchase_id, attempt_number)
    WHERE credit_pack_purchase_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_active_credit_pack
    ON payments(credit_pack_purchase_id)
    WHERE credit_pack_purchase_id IS NOT NULL
      AND status IN ('creating', 'checkout_started');

CREATE INDEX IF NOT EXISTS idx_payments_due_authorizations
    ON payments(decision_due_at, finalization_claimed_at)
    WHERE capture_method = 'manual'
      AND status = 'authorized'
      AND decision_due_at IS NOT NULL;
