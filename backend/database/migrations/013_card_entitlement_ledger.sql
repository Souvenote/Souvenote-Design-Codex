-- Server-authoritative physical-card entitlements.
-- Positive entries are granted only by trusted backend settlement flows;
-- negative entries reserve or consume cards for owner-scoped orders.

CREATE TABLE IF NOT EXISTS card_entitlement_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    source VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT card_entitlement_ledger_amount_check CHECK (amount <> 0),
    CONSTRAINT card_entitlement_ledger_source_check CHECK (
        char_length(trim(source)) BETWEEN 1 AND 255
    ),
    CONSTRAINT card_entitlement_ledger_idempotency_check CHECK (
        char_length(trim(idempotency_key)) BETWEEN 8 AND 255
    )
);

CREATE INDEX IF NOT EXISTS idx_card_entitlement_ledger_user_created
    ON card_entitlement_ledger(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_entitlement_ledger_user_event
    ON card_entitlement_ledger(user_id, event_type, created_at DESC);
