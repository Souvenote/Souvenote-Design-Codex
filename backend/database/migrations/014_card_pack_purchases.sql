-- Durable standalone Big Sender card-pack purchases.
-- Settlement grants both physical-card entitlements and the included AI credits.

CREATE TABLE IF NOT EXISTS card_pack_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pricing_catalog_id UUID NOT NULL REFERENCES pricing_catalog(id),
    offer_code VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    card_amount INTEGER NOT NULL,
    credit_amount INTEGER NOT NULL,
    pricing_snapshot JSONB NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    checkout_session_id VARCHAR(255),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT card_pack_purchases_status_check CHECK (
        status IN (
            'pending',
            'checkout_started',
            'paid',
            'payment_failed',
            'payment_canceled',
            'checkout_expired'
        )
    ),
    CONSTRAINT card_pack_purchases_amount_check CHECK (amount_cents > 0),
    CONSTRAINT card_pack_purchases_card_amount_check CHECK (
        card_amount BETWEEN 2 AND 30
    ),
    CONSTRAINT card_pack_purchases_credit_amount_check CHECK (credit_amount > 0),
    CONSTRAINT card_pack_purchases_idempotency_check CHECK (
        char_length(trim(idempotency_key)) BETWEEN 8 AND 255
    ),
    CONSTRAINT card_pack_purchases_user_idempotency_unique UNIQUE (
        user_id,
        idempotency_key
    )
);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS card_pack_purchase_id UUID
        REFERENCES card_pack_purchases(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_card_pack_purchases_user_created
    ON card_pack_purchases(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_pack_purchases_status_updated
    ON card_pack_purchases(status, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_card_pack_purchases_checkout_session
    ON card_pack_purchases(checkout_session_id)
    WHERE checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_card_pack_attempt
    ON payments(card_pack_purchase_id, attempt_number)
    WHERE card_pack_purchase_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_active_card_pack
    ON payments(card_pack_purchase_id)
    WHERE card_pack_purchase_id IS NOT NULL
      AND status IN ('creating', 'checkout_started');
