\set ON_ERROR_STOP on

BEGIN;

CREATE FUNCTION pg_temp.assert_true(condition BOOLEAN, message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF condition IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'assertion failed: %', message;
    END IF;
END;
$$;

SELECT pg_temp.assert_true(
    (SELECT count(*) = 1 FROM schema_migrations WHERE version = '0003'),
    'the runner journals the standalone credit-pack correction exactly once'
);

SELECT pg_temp.assert_true(
    (
        SELECT count(*) = 3
           AND bool_and(book.currency = 'CAD')
           AND bool_and(book.market_country = 'CA')
           AND bool_and(offer.catalog_visible)
           AND bool_and(NOT offer.checkout_enabled)
        FROM credit_pack_offers offer
        JOIN price_books book ON book.id = offer.price_book_id
        WHERE book.code = 'CA-CAD-MVP-2026'
    ),
    'all three standalone packs are public CAD offers with production checkout disabled'
);

SELECT pg_temp.assert_true(
    (
        SELECT array_agg(
            ARRAY[credit_quantity, unit_amount_minor]
            ORDER BY credit_quantity
        ) = ARRAY[
            ARRAY[10, 200],
            ARRAY[80, 1000],
            ARRAY[250, 2500]
        ]
        FROM credit_pack_offers offer
        JOIN price_books book ON book.id = offer.price_book_id
        WHERE book.code = 'CA-CAD-MVP-2026'
    ),
    'standalone pack quantities and CAD minor-unit prices are exact'
);

DO $$
DECLARE
    account_id UUID;
    offer_id UUID;
    purchase_one UUID;
    purchase_two UUID;
    ledger_applied BOOLEAN;
BEGIN
    INSERT INTO users (email)
    VALUES ('standalone-credit-pack@example.test')
    RETURNING id INTO account_id;

    SELECT id INTO offer_id
    FROM credit_pack_offers
    WHERE offer_code = 'credit_pack_10';

    INSERT INTO credit_pack_purchases (
        user_id,
        credit_pack_offer_id,
        provider,
        currency,
        amount_minor,
        credit_quantity,
        request_hash,
        idempotency_key
    )
    VALUES (
        account_id,
        offer_id,
        'mock',
        'USD',
        1,
        999,
        repeat('a', 64),
        'standalone-pack-purchase-one'
    )
    RETURNING id INTO purchase_one;

    UPDATE credit_pack_purchases
    SET status = 'captured',
        captured_at = clock_timestamp()
    WHERE id = purchase_one;

    SELECT applied INTO ledger_applied
    FROM apply_credit_ledger_entry(
        account_id,
        'purchase_grant',
        10,
        'credit_pack_purchase',
        purchase_one,
        'standalone-pack-ledger-one'
    );

    PERFORM pg_temp.assert_true(ledger_applied, 'the first captured purchase grants its credits');

    SELECT applied INTO ledger_applied
    FROM apply_credit_ledger_entry(
        account_id,
        'purchase_grant',
        10,
        'credit_pack_purchase',
        purchase_one,
        'standalone-pack-ledger-one'
    );

    PERFORM pg_temp.assert_true(
        NOT ledger_applied
        AND (SELECT balance = 10 FROM credit_accounts WHERE user_id = account_id),
        'retrying one captured purchase does not grant its credits twice'
    );

    INSERT INTO credit_pack_purchases (
        user_id,
        credit_pack_offer_id,
        provider,
        currency,
        amount_minor,
        credit_quantity,
        request_hash,
        idempotency_key
    )
    VALUES (
        account_id,
        offer_id,
        'mock',
        'CAD',
        200,
        10,
        repeat('b', 64),
        'standalone-pack-purchase-two'
    )
    RETURNING id INTO purchase_two;

    UPDATE credit_pack_purchases
    SET status = 'captured',
        captured_at = clock_timestamp()
    WHERE id = purchase_two;

    PERFORM apply_credit_ledger_entry(
        account_id,
        'purchase_grant',
        10,
        'credit_pack_purchase',
        purchase_two,
        'standalone-pack-ledger-two'
    );

    PERFORM pg_temp.assert_true(
        (SELECT balance = 20 FROM credit_accounts WHERE user_id = account_id)
        AND (
            SELECT count(*) = 2
               AND bool_and(currency = 'CAD')
               AND bool_and(amount_minor = 200)
               AND bool_and(credit_quantity = 10)
            FROM credit_pack_purchases
            WHERE user_id = account_id
              AND status = 'captured'
        ),
        'a user can buy repeatedly while the database snapshots server-owned offer terms'
    );
END;
$$;

ROLLBACK;
