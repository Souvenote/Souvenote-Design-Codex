-- A card-bank entitlement represents one fully paid printed-and-delivered card.
-- Prepaid delivery orders reserve that entitlement at order creation and never
-- create a second customer charge.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS funding_source VARCHAR(50) NOT NULL DEFAULT 'checkout',
    ADD COLUMN IF NOT EXISTS card_entitlements_reserved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS card_entitlements_released_at TIMESTAMPTZ;

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_amount_cents_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_funding_source_check'
          AND conrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_funding_source_check
            CHECK (funding_source IN ('checkout', 'card_bank'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_funding_amount_check'
          AND conrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_funding_amount_check
            CHECK (
                (funding_source = 'checkout' AND amount_cents > 0)
                OR
                (funding_source = 'card_bank' AND amount_cents = 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_card_reservation_check'
          AND conrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_card_reservation_check
            CHECK (
                funding_source <> 'card_bank'
                OR card_entitlements_reserved_at IS NOT NULL
            );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_orders_card_bank_reservation
    ON orders(user_id, card_entitlements_released_at, created_at DESC)
    WHERE funding_source = 'card_bank';
