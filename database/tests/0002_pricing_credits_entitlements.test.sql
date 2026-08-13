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
    (SELECT count(*) = 1 FROM schema_migrations WHERE version = '0002'),
    'the runner journals Section 3 exactly once'
);

SELECT pg_temp.assert_true(
    (
        SELECT count(*) = 4
           AND bool_and(book.currency = 'CAD')
           AND bool_and(book.market_country = 'CA')
           AND bool_and(offer.shipping_included)
           AND bool_and(offer.credits_per_card = 10)
           AND bool_and(offer.catalog_visible)
           AND bool_and(offer.checkout_enabled)
        FROM price_offers offer
        JOIN price_books book ON book.id = offer.price_book_id
        WHERE book.code = 'CA-CAD-MVP-2026'
    ),
    'the approved catalog is visible in CAD with the Section 5 checkout contract active'
);

SELECT pg_temp.assert_true(
    (
        SELECT array_agg(
            ARRAY[minimum_quantity::integer, maximum_quantity::integer, unit_amount_minor]
            ORDER BY minimum_quantity
        ) = ARRAY[
            ARRAY[1, 1, 999],
            ARRAY[2, 10, 899],
            ARRAY[11, 20, 799],
            ARRAY[21, 30, 699]
        ]
        FROM price_offers offer
        JOIN price_books book ON book.id = offer.price_book_id
        WHERE book.code = 'CA-CAD-MVP-2026'
    ),
    'the approved quantity tiers and minor-unit prices are exact'
);

SELECT pg_temp.assert_true(
    (
        SELECT authorization_amount_minor = 999
           AND no_send_fee_minor = 200
           AND authorization_days = 5
        FROM price_offers offer
        JOIN price_books book ON book.id = offer.price_book_id
        WHERE book.code = 'CA-CAD-MVP-2026'
          AND offer.offer_code = 'try_risk_free_one_card'
    ),
    'Try Risk-Free locks the five-day 999/200 CAD terms'
);

DO $$
DECLARE
    account_one UUID;
    account_two UUID;
    account_three UUID;
    account_four UUID;
    offer_id UUID;
    entitlement_one UUID;
    entitlement_two UUID;
    entitlement_three UUID;
    entitlement_four UUID;
    authorization_one UUID;
    authorization_two UUID;
    authorization_three UUID;
    authorization_four UUID;
    authorization_time TIMESTAMPTZ := clock_timestamp() - INTERVAL '6 days';
    authorization_two_time TIMESTAMPTZ := clock_timestamp();
BEGIN
    INSERT INTO users (email) VALUES ('section-three-one@example.test') RETURNING id INTO account_one;
    INSERT INTO users (email) VALUES ('section-three-two@example.test') RETURNING id INTO account_two;
    INSERT INTO users (email) VALUES ('section-three-three@example.test') RETURNING id INTO account_three;
    INSERT INTO users (email) VALUES ('section-three-four@example.test') RETURNING id INTO account_four;

    SELECT offer.id INTO offer_id
    FROM price_offers offer
    JOIN price_books book ON book.id = offer.price_book_id
    WHERE book.code = 'CA-CAD-MVP-2026'
      AND offer.offer_code = 'try_risk_free_one_card';

    INSERT INTO card_entitlements (
        user_id,
        price_offer_id,
        source_type,
        source_id,
        quantity_total,
        idempotency_key
    )
    VALUES (account_one, offer_id, 'try_risk_free', gen_random_uuid(), 1, 'section-three-entitlement-one')
    RETURNING id INTO entitlement_one;

    INSERT INTO try_risk_free_authorizations (
        user_id,
        price_offer_id,
        entitlement_id,
        currency,
        authorized_amount_minor,
        credits_granted,
        request_hash,
        idempotency_key,
        authorized_at,
        authorization_expires_at
    )
    VALUES (
        account_one,
        offer_id,
        entitlement_one,
        'CAD',
        999,
        10,
        repeat('a', 64),
        'section-three-authorization-one',
        authorization_time,
        authorization_time + INTERVAL '5 days'
    )
    RETURNING id INTO authorization_one;

    PERFORM resolve_due_try_risk_free_authorizations(clock_timestamp(), 100);
    PERFORM resolve_due_try_risk_free_authorizations(clock_timestamp(), 100);

    PERFORM pg_temp.assert_true(
        (
            SELECT status = 'captured_no_send'
               AND captured_amount_minor = 200
               AND released_amount_minor = 799
               AND resolved_at IS NOT NULL
            FROM try_risk_free_authorizations
            WHERE id = authorization_one
        ),
        'the deadline resolver applies the fixed 200 capture and 799 release exactly once'
    );

    INSERT INTO card_entitlements (
        user_id,
        price_offer_id,
        source_type,
        source_id,
        quantity_total,
        idempotency_key
    )
    VALUES (account_two, offer_id, 'try_risk_free', gen_random_uuid(), 1, 'section-three-entitlement-two')
    RETURNING id INTO entitlement_two;

    INSERT INTO try_risk_free_authorizations (
        user_id,
        price_offer_id,
        entitlement_id,
        currency,
        authorized_amount_minor,
        credits_granted,
        request_hash,
        idempotency_key,
        authorized_at,
        authorization_expires_at
    )
    VALUES (
        account_two,
        offer_id,
        entitlement_two,
        'CAD',
        999,
        10,
        repeat('b', 64),
        'section-three-authorization-two',
        authorization_two_time,
        authorization_two_time + INTERVAL '5 days'
    )
    RETURNING id INTO authorization_two;

    PERFORM resolve_try_risk_free_for_fulfillment(authorization_two, account_two, clock_timestamp());
    PERFORM resolve_try_risk_free_for_fulfillment(authorization_two, account_two, clock_timestamp());

    PERFORM pg_temp.assert_true(
        (
            SELECT status = 'captured_full'
               AND captured_amount_minor = 999
               AND released_amount_minor = 0
               AND fulfillment_started_at IS NOT NULL
            FROM try_risk_free_authorizations
            WHERE id = authorization_two
        ),
        'fulfillment captures the full authorization exactly once'
    );

    INSERT INTO card_entitlements (
        user_id,
        price_offer_id,
        source_type,
        source_id,
        quantity_total,
        idempotency_key
    )
    VALUES (account_three, offer_id, 'try_risk_free', gen_random_uuid(), 1, 'section-three-entitlement-three')
    RETURNING id INTO entitlement_three;

    INSERT INTO card_entitlements (
        user_id,
        price_offer_id,
        source_type,
        source_id,
        quantity_total,
        idempotency_key
    )
    VALUES (account_four, offer_id, 'try_risk_free', gen_random_uuid(), 1, 'section-three-entitlement-four')
    RETURNING id INTO entitlement_four;

    INSERT INTO try_risk_free_authorizations (
        user_id,
        price_offer_id,
        entitlement_id,
        currency,
        authorized_amount_minor,
        credits_granted,
        request_hash,
        idempotency_key,
        authorized_at,
        authorization_expires_at
    )
    VALUES
        (
            account_three,
            offer_id,
            entitlement_three,
            'CAD',
            999,
            10,
            repeat('c', 64),
            'section-three-authorization-three',
            authorization_time,
            authorization_time + INTERVAL '5 days'
        ),
        (
            account_four,
            offer_id,
            entitlement_four,
            'CAD',
            999,
            10,
            repeat('d', 64),
            'section-three-authorization-four',
            authorization_time,
            authorization_time + INTERVAL '5 days'
        );

    SELECT id INTO authorization_three
    FROM try_risk_free_authorizations
    WHERE user_id = account_three;

    SELECT id INTO authorization_four
    FROM try_risk_free_authorizations
    WHERE user_id = account_four;

    PERFORM resolve_try_risk_free_for_fulfillment(authorization_three, account_three, clock_timestamp());
    PERFORM pg_temp.assert_true(
        (SELECT status = 'authorized' FROM try_risk_free_authorizations WHERE id = authorization_three),
        'fulfillment cannot capture a Try Risk-Free authorization after its deadline'
    );

    PERFORM resolve_due_try_risk_free_authorizations(clock_timestamp(), 1);
    PERFORM pg_temp.assert_true(
        (
            SELECT count(*) = 1
            FROM try_risk_free_authorizations
            WHERE id IN (authorization_three, authorization_four)
              AND status = 'captured_no_send'
        ),
        'the deadline resolver enforces its requested batch limit'
    );

    PERFORM resolve_due_try_risk_free_authorizations(clock_timestamp(), 1);
    PERFORM pg_temp.assert_true(
        (
            SELECT count(*) = 2
            FROM try_risk_free_authorizations
            WHERE id IN (authorization_three, authorization_four)
              AND status = 'captured_no_send'
        ),
        'a later deadline batch resolves the remaining authorization'
    );

    BEGIN
        INSERT INTO card_entitlement_reservations (
            user_id,
            price_offer_id,
            quantity,
            unit_amount_minor,
            total_amount_minor,
            currency,
            request_hash,
            idempotency_key,
            expires_at
        )
        VALUES (
            account_one,
            offer_id,
            1,
            899,
            899,
            'CAD',
            repeat('e', 64),
            'invalid-one-card-reservation',
            clock_timestamp() + INTERVAL '15 minutes'
        );
        RAISE EXCEPTION 'a one-card Big Sender reservation was accepted';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;
END;
$$;

ROLLBACK;
