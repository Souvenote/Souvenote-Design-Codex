-- Section 3 correction: approved standalone CAD credit packs and deterministic
-- local/test purchase state. Real Stripe collection remains a Section 5 gate.

CREATE TABLE credit_pack_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_book_id UUID NOT NULL REFERENCES price_books(id) ON DELETE RESTRICT,
    offer_code VARCHAR(80) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    credit_quantity INTEGER NOT NULL CHECK (credit_quantity > 0),
    unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor > 0),
    checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    catalog_visible BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (price_book_id, offer_code, version),
    CONSTRAINT credit_pack_offers_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX credit_pack_offers_book_catalog_idx
    ON credit_pack_offers (price_book_id, catalog_visible, credit_quantity);

CREATE TRIGGER credit_pack_offers_set_updated_at
BEFORE UPDATE ON credit_pack_offers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE credit_pack_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credit_pack_offer_id UUID NOT NULL REFERENCES credit_pack_offers(id) ON DELETE RESTRICT,
    provider VARCHAR(40) NOT NULL,
    provider_payment_id VARCHAR(255),
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    currency CHAR(3) NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    credit_quantity INTEGER NOT NULL CHECK (credit_quantity > 0),
    request_hash CHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    captured_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    CONSTRAINT credit_pack_purchases_provider CHECK (provider IN ('mock', 'stripe')),
    CONSTRAINT credit_pack_purchases_status CHECK (
        status IN ('pending', 'captured', 'failed', 'canceled')
    ),
    CONSTRAINT credit_pack_purchases_currency CHECK (currency = 'CAD'),
    CONSTRAINT credit_pack_purchases_request_hash CHECK (
        request_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT credit_pack_purchases_capture_state CHECK (
        (status = 'captured' AND captured_at IS NOT NULL)
        OR (status <> 'captured' AND captured_at IS NULL)
    )
);

CREATE UNIQUE INDEX credit_pack_purchases_provider_payment_unique
    ON credit_pack_purchases (provider, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

CREATE INDEX credit_pack_purchases_user_created_idx
    ON credit_pack_purchases (user_id, created_at DESC, id DESC);

CREATE FUNCTION snapshot_credit_pack_purchase_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT
        book.currency,
        offer.unit_amount_minor,
        offer.credit_quantity
    INTO
        NEW.currency,
        NEW.amount_minor,
        NEW.credit_quantity
    FROM credit_pack_offers offer
    JOIN price_books book ON book.id = offer.price_book_id
    WHERE offer.id = NEW.credit_pack_offer_id
      AND offer.catalog_visible = TRUE
      AND book.status = 'active'
      AND book.market_country = 'CA'
      AND book.currency = 'CAD'
      AND (book.effective_from IS NULL OR book.effective_from <= clock_timestamp())
      AND (book.effective_until IS NULL OR book.effective_until > clock_timestamp());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'active standalone CAD credit-pack offer does not exist'
            USING ERRCODE = '23503';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER credit_pack_purchases_offer_snapshot
BEFORE INSERT ON credit_pack_purchases
FOR EACH ROW EXECUTE FUNCTION snapshot_credit_pack_purchase_offer();

INSERT INTO lifecycle_state_transitions (entity_type, from_state, to_state)
VALUES
    ('credit_pack_purchase', 'pending', 'captured'),
    ('credit_pack_purchase', 'pending', 'failed'),
    ('credit_pack_purchase', 'pending', 'canceled');

CREATE TRIGGER credit_pack_purchases_initial_state
BEFORE INSERT ON credit_pack_purchases
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('credit_pack_purchase', 'status', 'pending');

CREATE TRIGGER credit_pack_purchases_state_transition
BEFORE UPDATE OF status ON credit_pack_purchases
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('credit_pack_purchase', 'status');

CREATE TRIGGER credit_pack_purchases_set_updated_at
BEFORE UPDATE ON credit_pack_purchases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO credit_pack_offers (
    id,
    price_book_id,
    offer_code,
    credit_quantity,
    unit_amount_minor,
    checkout_enabled,
    catalog_visible,
    metadata
)
VALUES
    (
        '33000000-0000-4000-8000-000000000001',
        '31000000-0000-4000-8000-000000000001',
        'credit_pack_10',
        10,
        200,
        FALSE,
        TRUE,
        '{"display_name":"Starter","featured":false}'::jsonb
    ),
    (
        '33000000-0000-4000-8000-000000000002',
        '31000000-0000-4000-8000-000000000001',
        'credit_pack_80',
        80,
        1000,
        FALSE,
        TRUE,
        '{"display_name":"Studio","featured":true}'::jsonb
    ),
    (
        '33000000-0000-4000-8000-000000000003',
        '31000000-0000-4000-8000-000000000001',
        'credit_pack_250',
        250,
        2500,
        FALSE,
        TRUE,
        '{"display_name":"Atelier","featured":false}'::jsonb
    );

INSERT INTO feature_flags (flag_key, environment, enabled, configuration)
VALUES (
    'payments.credit_packs.production',
    'production',
    FALSE,
    '{"approval_required":"section_5_stripe_checkout"}'::jsonb
);
