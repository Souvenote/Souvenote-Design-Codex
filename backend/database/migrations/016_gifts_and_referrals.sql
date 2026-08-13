-- Durable one-card gifts and referral attribution.
-- A gift is a paid one-card pack held in escrow until its intended recipient
-- redeems it. The card entitlement includes printing and standard delivery.

ALTER TABLE card_pack_purchases
    DROP CONSTRAINT IF EXISTS card_pack_purchases_card_amount_check;

ALTER TABLE card_pack_purchases
    ADD CONSTRAINT card_pack_purchases_card_amount_check CHECK (
        card_amount BETWEEN 1 AND 30
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
VALUES (
    'gift_souvenote_one_card',
    'Gift a Souvenote',
    'gift',
    699,
    'cad',
    1,
    1,
    10,
    TRUE,
    '{"card_amount": 1, "credit_amount": 10, "printing_included": true, "standard_delivery_included": true}'::jsonb
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

CREATE TABLE IF NOT EXISTS gift_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchaser_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_pack_purchase_id UUID NOT NULL UNIQUE
        REFERENCES card_pack_purchases(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'awaiting_payment',
    delivery_method VARCHAR(20) NOT NULL,
    recipient_name VARCHAR(120) NOT NULL,
    recipient_contact VARCHAR(320) NOT NULL,
    personal_message VARCHAR(500),
    card_amount INTEGER NOT NULL DEFAULT 1,
    credit_amount INTEGER NOT NULL DEFAULT 10,
    printing_included BOOLEAN NOT NULL DEFAULT TRUE,
    standard_delivery_included BOOLEAN NOT NULL DEFAULT TRUE,
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    redeemed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ready_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gift_purchases_status_check CHECK (
        status IN ('awaiting_payment', 'ready', 'redeemed', 'canceled')
    ),
    CONSTRAINT gift_purchases_delivery_method_check CHECK (
        delivery_method IN ('email', 'text')
    ),
    CONSTRAINT gift_purchases_delivery_status_check CHECK (
        delivery_status IN ('pending', 'mock_delivered', 'delivered', 'failed')
    ),
    CONSTRAINT gift_purchases_name_check CHECK (
        char_length(trim(recipient_name)) BETWEEN 1 AND 120
    ),
    CONSTRAINT gift_purchases_contact_check CHECK (
        char_length(trim(recipient_contact)) BETWEEN 3 AND 320
    ),
    CONSTRAINT gift_purchases_amounts_check CHECK (
        card_amount = 1 AND credit_amount = 10
    ),
    CONSTRAINT gift_purchases_delivery_included_check CHECK (
        printing_included AND standard_delivery_included
    )
);

ALTER TABLE card_pack_purchases
    ADD COLUMN IF NOT EXISTS gift_purchase_id UUID
        REFERENCES gift_purchases(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_card_pack_purchases_gift
    ON card_pack_purchases(gift_purchase_id)
    WHERE gift_purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gift_purchases_purchaser_created
    ON gift_purchases(purchaser_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gift_purchases_status_updated
    ON gift_purchases(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_gift_purchases_redeemer_created
    ON gift_purchases(redeemed_by_user_id, redeemed_at DESC)
    WHERE redeemed_by_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS referral_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_email VARCHAR(320),
    status VARCHAR(30) NOT NULL DEFAULT 'invited',
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    referred_user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    invitee_credit_amount INTEGER NOT NULL DEFAULT 8,
    referrer_credit_amount INTEGER NOT NULL DEFAULT 10,
    idempotency_key VARCHAR(255) NOT NULL,
    claimed_at TIMESTAMPTZ,
    rewarded_at TIMESTAMPTZ,
    qualifying_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT referral_invites_status_check CHECK (
        status IN ('invited', 'claimed', 'rewarded', 'canceled')
    ),
    CONSTRAINT referral_invites_delivery_status_check CHECK (
        delivery_status IN ('pending', 'mock_delivered', 'delivered', 'failed', 'not_applicable')
    ),
    CONSTRAINT referral_invites_email_check CHECK (
        invited_email IS NULL OR
        char_length(trim(invited_email)) BETWEEN 3 AND 320
    ),
    CONSTRAINT referral_invites_credit_amounts_check CHECK (
        invitee_credit_amount = 8 AND referrer_credit_amount = 10
    ),
    CONSTRAINT referral_invites_not_self_check CHECK (
        referred_user_id IS NULL OR referred_user_id <> referrer_user_id
    ),
    CONSTRAINT referral_invites_idempotency_check CHECK (
        char_length(trim(idempotency_key)) BETWEEN 8 AND 255
    ),
    CONSTRAINT referral_invites_referrer_idempotency_unique UNIQUE (
        referrer_user_id,
        idempotency_key
    )
);

CREATE INDEX IF NOT EXISTS idx_referral_invites_referrer_created
    ON referral_invites(referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_invites_referred_status
    ON referral_invites(referred_user_id, status)
    WHERE referred_user_id IS NOT NULL;
