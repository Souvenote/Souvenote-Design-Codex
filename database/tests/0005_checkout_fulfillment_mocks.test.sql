BEGIN;

CREATE FUNCTION pg_temp.assert_true(condition BOOLEAN, message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT condition THEN
        RAISE EXCEPTION 'assertion failed: %', message;
    END IF;
END;
$$;

SELECT pg_temp.assert_true(
    (SELECT count(*) = 1 FROM schema_migrations WHERE version = '0005'),
    'the runner journals Section 5 exactly once'
);

SELECT pg_temp.assert_true(
    (
        SELECT count(*) = 3 AND bool_and(NOT enabled)
        FROM feature_flags
        WHERE environment = 'production'
          AND flag_key IN (
              'payments.hosted_checkout',
              'fulfillment.scribeless',
              'fulfillment.blank_card_handoff'
          )
    ),
    'all Section 5 production provider and blank-card gates remain disabled'
);

DO $$
DECLARE
    account_id UUID;
    failed_account_id UUID;
    offer_id UUID;
    purchase_id UUID;
    failed_purchase_id UUID;
    session_id UUID;
    failed_session_id UUID;
    now_value TIMESTAMPTZ := clock_timestamp();
BEGIN
    INSERT INTO users (email) VALUES ('section-five-capture@example.test') RETURNING id INTO account_id;
    INSERT INTO users (email) VALUES ('section-five-failure@example.test') RETURNING id INTO failed_account_id;

    SELECT id INTO offer_id FROM credit_pack_offers WHERE offer_code = 'credit_pack_80';

    INSERT INTO credit_pack_purchases (
        user_id, credit_pack_offer_id, provider, currency, amount_minor,
        credit_quantity, request_hash, idempotency_key
    )
    VALUES (
        account_id, offer_id, 'mock', 'CAD', 1000, 80,
        repeat('a', 64), 'section-five-purchase'
    )
    RETURNING id INTO purchase_id;

    INSERT INTO checkout_sessions (
        user_id, credit_pack_purchase_id, provider, purpose, collection_mode,
        currency, amount_minor, request_sha256, idempotency_key, expires_at
    )
    VALUES (
        account_id, purchase_id, 'mock', 'credit_pack', 'automatic',
        'CAD', 1000, repeat('b', 64), 'section-five-session', now_value + INTERVAL '30 minutes'
    )
    RETURNING id INTO session_id;

    UPDATE checkout_sessions
    SET status = 'open', provider_session_id = 'mock_session_capture'
    WHERE id = session_id;

    PERFORM complete_checkout_session(session_id, 'mock_payment_capture', now_value);
    PERFORM complete_checkout_session(session_id, 'mock_payment_capture', now_value);

    PERFORM pg_temp.assert_true(
        (SELECT status = 'completed' AND completed_at = now_value FROM checkout_sessions WHERE id = session_id)
        AND (
            SELECT status = 'captured'
               AND provider_payment_id = 'mock_payment_capture'
               AND captured_at = now_value
            FROM credit_pack_purchases
            WHERE id = purchase_id
        )
        AND (SELECT balance = 80 FROM credit_accounts WHERE user_id = account_id)
        AND (
            SELECT count(*) = 1
            FROM credit_ledger
            WHERE user_id = account_id
              AND source_type = 'credit_pack_purchase'
              AND source_id = purchase_id
        ),
        'duplicate checkout completion captures and grants the exact credit pack once'
    );

    INSERT INTO credit_pack_purchases (
        user_id, credit_pack_offer_id, provider, currency, amount_minor,
        credit_quantity, request_hash, idempotency_key
    )
    VALUES (
        failed_account_id, offer_id, 'mock', 'CAD', 1000, 80,
        repeat('c', 64), 'section-five-failed-purchase'
    )
    RETURNING id INTO failed_purchase_id;

    INSERT INTO checkout_sessions (
        user_id, credit_pack_purchase_id, provider, purpose, collection_mode,
        currency, amount_minor, request_sha256, idempotency_key, expires_at
    )
    VALUES (
        failed_account_id, failed_purchase_id, 'mock', 'credit_pack', 'automatic',
        'CAD', 1000, repeat('d', 64), 'section-five-failed-session', now_value + INTERVAL '30 minutes'
    )
    RETURNING id INTO failed_session_id;

    UPDATE checkout_sessions
    SET status = 'open', provider_session_id = 'mock_session_failure'
    WHERE id = failed_session_id;

    PERFORM fail_checkout_session(failed_session_id, 'test_decline');
    PERFORM fail_checkout_session(failed_session_id, 'test_decline');

    PERFORM pg_temp.assert_true(
        (SELECT status = 'failed' FROM checkout_sessions WHERE id = failed_session_id)
        AND (SELECT status = 'failed' FROM credit_pack_purchases WHERE id = failed_purchase_id)
        AND (SELECT balance = 0 FROM credit_accounts WHERE user_id = failed_account_id),
        'failed checkout reconciliation is retry-safe and grants no credits'
    );
END;
$$;

ROLLBACK;
