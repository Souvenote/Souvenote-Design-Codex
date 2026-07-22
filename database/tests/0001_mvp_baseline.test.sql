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
    (SELECT count(*) = 1 FROM schema_migrations WHERE version = '0001'),
    'the runner journals the baseline exactly once'
);

SELECT pg_temp.assert_true(
    NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
              'gifts',
              'trust_circles',
              'chatbot_memory',
              'calendar_events',
              'community_catalog',
              'harte_hanks_jobs'
          )
    ),
    'unapproved future-feature tables are absent'
);

DO $$
DECLARE
    owner_one UUID;
    owner_two UUID;
    draft_one UUID;
    revision_one UUID;
    upload_one UUID;
    job_one UUID;
    attempt_one UUID;
    print_asset UUID;
    book_one UUID;
    offer_one UUID;
    entitlement_one UUID;
    order_one UUID;
    payment_one UUID;
    fulfillment_one UUID;
    applied_now BOOLEAN;
    balance_now INTEGER;
BEGIN
    INSERT INTO users (email)
    VALUES ('owner-one@example.test')
    RETURNING id INTO owner_one;

    INSERT INTO users (email)
    VALUES ('owner-two@example.test')
    RETURNING id INTO owner_two;

    PERFORM pg_temp.assert_true(
        (SELECT count(*) = 2 FROM credit_accounts WHERE user_id IN (owner_one, owner_two)),
        'user provisioning creates one credit account per user'
    );

    INSERT INTO auth_identities (
        user_id,
        issuer,
        subject,
        client_id,
        email_verified
    )
    VALUES (
        owner_one,
        'https://cognito-idp.ca-central-1.amazonaws.com/ca-test',
        'subject-one',
        'client-test',
        TRUE
    );

    SELECT resulting_balance, applied
    INTO balance_now, applied_now
    FROM apply_credit_ledger_entry(
        owner_one,
        'signup_grant',
        2,
        'user_provisioning',
        NULL,
        'provision-owner-one',
        '{}'::jsonb
    );

    PERFORM pg_temp.assert_true(
        balance_now = 2 AND applied_now,
        'the first starter grant applies atomically'
    );

    SELECT resulting_balance, applied
    INTO balance_now, applied_now
    FROM apply_credit_ledger_entry(
        owner_one,
        'signup_grant',
        2,
        'user_provisioning',
        NULL,
        'provision-owner-one',
        '{}'::jsonb
    );

    PERFORM pg_temp.assert_true(
        balance_now = 2 AND NOT applied_now,
        'an identical credit retry is an idempotent no-op'
    );

    BEGIN
        PERFORM apply_credit_ledger_entry(
            owner_one,
            'signup_grant',
            3,
            'user_provisioning',
            NULL,
            'provision-owner-one',
            '{}'::jsonb
        );
        RAISE EXCEPTION 'reused idempotency key accepted different credit input';
    EXCEPTION
        WHEN unique_violation THEN NULL;
    END;

    BEGIN
        PERFORM apply_credit_ledger_entry(
            owner_one,
            'generation_reservation',
            -3,
            'generation_job',
            gen_random_uuid(),
            'overdraw-owner-one',
            '{}'::jsonb
        );
        RAISE EXCEPTION 'credit balance was allowed below zero';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;

    PERFORM apply_credit_ledger_entry(
        owner_one,
        'generation_reservation',
        -1,
        'generation_job',
        gen_random_uuid(),
        'reserve-owner-one',
        '{}'::jsonb
    );

    PERFORM pg_temp.assert_true(
        (SELECT balance = 1 AND version = 2 FROM credit_accounts WHERE user_id = owner_one),
        'the account and append-only ledger advance together'
    );

    BEGIN
        UPDATE credit_ledger
        SET amount = 100
        WHERE user_id = owner_one;
        RAISE EXCEPTION 'credit ledger mutation was accepted';
    EXCEPTION
        WHEN object_not_in_prerequisite_state THEN NULL;
    END;

    INSERT INTO price_books (code, market_country, currency)
    VALUES ('CA_MVP_TEST', 'CA', 'CAD')
    RETURNING id INTO book_one;

    INSERT INTO price_offers (
        price_book_id,
        offer_code,
        offer_type,
        unit_amount_minor,
        minimum_quantity,
        maximum_quantity,
        checkout_enabled
    )
    VALUES (
        book_one,
        'big_sender_test',
        'big_sender',
        899,
        2,
        10,
        FALSE
    )
    RETURNING id INTO offer_one;

    INSERT INTO card_entitlements (
        user_id,
        price_offer_id,
        source_type,
        status,
        quantity_total,
        idempotency_key
    )
    VALUES (
        owner_one,
        offer_one,
        'big_sender',
        'available',
        2,
        'entitlement-owner-one'
    )
    RETURNING id INTO entitlement_one;

    INSERT INTO card_drafts (user_id, creation_route)
    VALUES (owner_one, 'build_my_card')
    RETURNING id INTO draft_one;

    INSERT INTO card_draft_revisions (
        draft_id,
        user_id,
        revision_number,
        occasion,
        relationship,
        creative_brief
    )
    VALUES (
        draft_one,
        owner_one,
        1,
        'birthday',
        'friend',
        '{"tone":"warm"}'::jsonb
    )
    RETURNING id INTO revision_one;

    UPDATE card_drafts
    SET current_revision_id = revision_one
    WHERE id = draft_one;

    BEGIN
        INSERT INTO uploads (
            user_id,
            card_draft_id,
            revision_id,
            original_filename,
            media_type,
            size_bytes,
            content_sha256,
            request_sha256,
            idempotency_key,
            storage_key
        )
        VALUES (
            owner_two,
            draft_one,
            revision_one,
            'cross-owner.jpg',
            'image/jpeg',
            128,
            repeat('a', 64),
            repeat('9', 64),
            'cross-owner-upload',
            'private/cross-owner.jpg'
        );
        RAISE EXCEPTION 'cross-owner upload association was accepted';
    EXCEPTION
        WHEN foreign_key_violation THEN NULL;
    END;

    INSERT INTO uploads (
        user_id,
        card_draft_id,
        revision_id,
        original_filename,
        media_type,
        size_bytes,
        width_pixels,
        height_pixels,
        content_sha256,
        request_sha256,
        idempotency_key,
        storage_key
    )
    VALUES (
        owner_one,
        draft_one,
        revision_one,
        'photo.jpg',
        'image/jpeg',
        1024,
        1500,
        2100,
        repeat('b', 64),
        repeat('8', 64),
        'upload-owner-one',
        'private/owner-one/photo.jpg'
    )
    RETURNING id INTO upload_one;

    PERFORM pg_temp.assert_true(
        (
            SELECT expires_at <= created_at + INTERVAL '24 hours'
              AND expires_at > created_at
            FROM uploads
            WHERE id = upload_one
        ),
        'uncommitted upload expiry is bounded to 24 hours'
    );

    BEGIN
        UPDATE uploads
        SET status = 'committed', committed_at = clock_timestamp()
        WHERE id = upload_one;
        RAISE EXCEPTION 'invalid upload lifecycle transition was accepted';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;

    UPDATE uploads SET status = 'upload_done' WHERE id = upload_one;
    UPDATE uploads SET status = 'attestation_required' WHERE id = upload_one;
    UPDATE uploads
    SET status = 'attestation_done', rights_attested_at = clock_timestamp()
    WHERE id = upload_one;
    UPDATE uploads SET status = 'moderation_pending' WHERE id = upload_one;
    UPDATE uploads
    SET status = 'moderation_passed', moderation_result = '{"decision":"passed"}'::jsonb
    WHERE id = upload_one;
    UPDATE uploads
    SET status = 'committed', committed_at = clock_timestamp()
    WHERE id = upload_one;

    INSERT INTO generation_jobs (
        user_id,
        card_draft_id,
        revision_id,
        request_hash,
        idempotency_key,
        action_type,
        credits_reserved
    )
    VALUES (
        owner_one,
        draft_one,
        revision_one,
        repeat('c', 64),
        'generation-owner-one',
        'regenerate_image',
        1
    )
    RETURNING id INTO job_one;

    INSERT INTO provider_attempts (
        user_id,
        generation_job_id,
        asset_type,
        provider,
        model,
        attempt_number,
        input_hash
    )
    VALUES (
        owner_one,
        job_one,
        'image',
        'mock',
        'deterministic-image',
        1,
        repeat('d', 64)
    )
    RETURNING id INTO attempt_one;

    UPDATE provider_attempts SET status = 'running', started_at = clock_timestamp()
    WHERE id = attempt_one;
    UPDATE provider_attempts
    SET status = 'succeeded', completed_at = clock_timestamp()
    WHERE id = attempt_one;

    INSERT INTO assets (
        user_id,
        card_draft_id,
        revision_id,
        generation_job_id,
        provider_attempt_id,
        asset_type,
        generation_status,
        storage_key,
        media_type,
        content_sha256,
        byte_size,
        moderation_status
    )
    VALUES (
        owner_one,
        draft_one,
        revision_one,
        job_one,
        attempt_one,
        'print',
        'pending',
        'generated/owner-one/print.pdf',
        'application/pdf',
        repeat('e', 64),
        4096,
        'passed'
    )
    RETURNING id INTO print_asset;

    UPDATE assets SET generation_status = 'generating' WHERE id = print_asset;
    UPDATE assets SET generation_status = 'ready' WHERE id = print_asset;

    INSERT INTO orders (
        user_id,
        order_number,
        currency,
        subtotal_minor,
        shipping_minor,
        tax_minor,
        total_minor,
        idempotency_key,
        request_sha256
    )
    VALUES (
        owner_one,
        'ORDER-TEST-0001',
        'CAD',
        899,
        0,
        0,
        899,
        'order-owner-one',
        repeat('7', 64)
    )
    RETURNING id INTO order_one;

    INSERT INTO order_items (
        user_id,
        order_id,
        card_draft_id,
        card_entitlement_id,
        price_offer_id,
        print_asset_id,
        quantity,
        unit_amount_minor,
        total_amount_minor,
        currency
    )
    VALUES (
        owner_one,
        order_one,
        draft_one,
        entitlement_one,
        offer_one,
        print_asset,
        1,
        899,
        899,
        'CAD'
    );

    INSERT INTO payments (
        user_id,
        order_id,
        provider,
        status,
        currency,
        authorized_amount_minor,
        idempotency_key
    )
    VALUES (
        owner_one,
        order_one,
        'mock',
        'pending',
        'CAD',
        899,
        'payment-owner-one'
    )
    RETURNING id INTO payment_one;

    UPDATE payments SET status = 'authorized' WHERE id = payment_one;

    INSERT INTO webhook_events (
        provider,
        provider_event_id,
        event_type,
        payload_sha256,
        signature_verified_at
    )
    VALUES (
        'stripe',
        'evt_test_unique',
        'payment_intent.amount_capturable_updated',
        repeat('f', 64),
        clock_timestamp()
    );

    BEGIN
        INSERT INTO webhook_events (
            provider,
            provider_event_id,
            event_type,
            payload_sha256,
            signature_verified_at
        )
        VALUES (
            'stripe',
            'evt_test_unique',
            'duplicate',
            repeat('f', 64),
            clock_timestamp()
        );
        RAISE EXCEPTION 'duplicate provider webhook event was accepted';
    EXCEPTION
        WHEN unique_violation THEN NULL;
    END;

    INSERT INTO fulfillment_jobs (
        user_id,
        order_id,
        provider,
        request_payload_sha256,
        idempotency_key
    )
    VALUES (
        owner_one,
        order_one,
        'mock',
        repeat('1', 64),
        'fulfillment-owner-one'
    )
    RETURNING id INTO fulfillment_one;

    INSERT INTO shipments (
        user_id,
        order_id,
        fulfillment_job_id,
        provider,
        status
    )
    VALUES (
        owner_one,
        order_one,
        fulfillment_one,
        'mock',
        'label_created'
    );

    INSERT INTO notifications (
        user_id,
        order_id,
        channel,
        template_key,
        idempotency_key
    )
    VALUES (
        owner_one,
        order_one,
        'in_app',
        'order_received',
        'notify-owner-one'
    );

    INSERT INTO audit_events (
        actor_user_id,
        subject_user_id,
        action,
        entity_type,
        entity_id,
        outcome
    )
    VALUES (
        owner_one,
        owner_one,
        'order.created',
        'order',
        order_one,
        'succeeded'
    );

    INSERT INTO feature_flags (flag_key, environment)
    VALUES ('providers.image.live', 'test');

    PERFORM pg_temp.assert_true(
        (SELECT NOT enabled FROM feature_flags WHERE flag_key = 'providers.image.live'),
        'feature flags fail closed by default'
    );
END;
$$;

ROLLBACK;
