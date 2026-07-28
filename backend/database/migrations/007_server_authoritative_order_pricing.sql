-- Server-authoritative order quantities and immutable catalog price snapshots.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE orders
SET pricing_snapshot = jsonb_build_object(
    'offerCode', COALESCE(offer_code, 'try_risk_free_one_card'),
    'unitAmountCents', amount_cents,
    'quantity', quantity,
    'totalAmountCents', amount_cents,
    'currency', currency,
    'source', 'legacy_backfill'
)
WHERE pricing_snapshot = '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_quantity_check'
          AND conrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_quantity_check
            CHECK (quantity BETWEEN 1 AND 30);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_amount_cents_check'
          AND conrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_amount_cents_check
            CHECK (amount_cents > 0);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_orders_offer_code
    ON orders(offer_code, created_at DESC);
