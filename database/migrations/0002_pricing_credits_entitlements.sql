-- Section 3: authoritative Canada/CAD pricing, credit action costs,
-- physical-card reservations, and deterministic mock Try Risk-Free state.
-- The published 0001 baseline remains immutable.

ALTER TABLE price_offers
    ADD COLUMN catalog_visible BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO price_books (
    id,
    code,
    market_country,
    currency,
    status,
    effective_from
)
VALUES (
    '31000000-0000-4000-8000-000000000001',
    'CA-CAD-MVP-2026',
    'CA',
    'CAD',
    'active',
    clock_timestamp()
);

INSERT INTO price_offers (
    id,
    price_book_id,
    offer_code,
    offer_type,
    unit_amount_minor,
    authorization_amount_minor,
    no_send_fee_minor,
    authorization_days,
    minimum_quantity,
    maximum_quantity,
    credits_per_card,
    shipping_included,
    checkout_enabled,
    catalog_visible,
    metadata
)
VALUES
    (
        '32000000-0000-4000-8000-000000000001',
        '31000000-0000-4000-8000-000000000001',
        'try_risk_free_one_card',
        'try_risk_free',
        999,
        999,
        200,
        5,
        1,
        1,
        10,
        TRUE,
        FALSE,
        TRUE,
        '{"display_name":"Try Risk-Free","production_enabled":false,"activation_gate":"stripe_and_legal_review"}'::jsonb
    ),
    (
        '32000000-0000-4000-8000-000000000002',
        '31000000-0000-4000-8000-000000000001',
        'big_sender_2_10',
        'big_sender',
        899,
        NULL,
        NULL,
        NULL,
        2,
        10,
        10,
        TRUE,
        FALSE,
        TRUE,
        '{"display_name":"Big Sender","production_enabled":false,"entitlement_months":12}'::jsonb
    ),
    (
        '32000000-0000-4000-8000-000000000003',
        '31000000-0000-4000-8000-000000000001',
        'big_sender_11_20',
        'big_sender',
        799,
        NULL,
        NULL,
        NULL,
        11,
        20,
        10,
        TRUE,
        FALSE,
        TRUE,
        '{"display_name":"Big Sender","production_enabled":false,"entitlement_months":12}'::jsonb
    ),
    (
        '32000000-0000-4000-8000-000000000004',
        '31000000-0000-4000-8000-000000000001',
        'big_sender_21_30',
        'big_sender',
        699,
        NULL,
        NULL,
        NULL,
        21,
        30,
        10,
        TRUE,
        FALSE,
        TRUE,
        '{"display_name":"Big Sender","production_enabled":false,"entitlement_months":12}'::jsonb
    );

INSERT INTO feature_flags (flag_key, environment, enabled, configuration)
VALUES
    (
        'payments.try_risk_free.production',
        'production',
        FALSE,
        '{"approval_required":"stripe_and_legal_review"}'::jsonb
    ),
    (
        'payments.mock.section_3',
        'local',
        TRUE,
        '{"provider":"deterministic_mock","external_calls":false}'::jsonb
    ),
    (
        'payments.mock.section_3',
        'test',
        TRUE,
        '{"provider":"deterministic_mock","external_calls":false}'::jsonb
    );

ALTER TABLE generation_jobs
    ADD COLUMN action_type VARCHAR(40),
    ADD COLUMN failure_category VARCHAR(40);

UPDATE generation_jobs
SET action_type = CASE credits_reserved
    WHEN 2 THEN 'initial_image_song'
    WHEN 1 THEN 'regenerate_image'
    ELSE 'inside_message'
END;

ALTER TABLE generation_jobs
    ALTER COLUMN action_type SET NOT NULL,
    ALTER COLUMN action_type SET DEFAULT 'initial_image_song',
    ADD CONSTRAINT generation_jobs_action_type CHECK (
        action_type IN ('initial_image_song', 'regenerate_image', 'regenerate_song', 'inside_message')
    ),
    ADD CONSTRAINT generation_jobs_action_cost CHECK (
        (action_type = 'initial_image_song' AND credits_reserved = 2)
        OR (action_type IN ('regenerate_image', 'regenerate_song') AND credits_reserved = 1)
        OR (action_type = 'inside_message' AND credits_reserved = 0)
    ),
    ADD CONSTRAINT generation_jobs_failure_category CHECK (
        failure_category IS NULL
        OR failure_category IN ('provider_failed', 'timed_out', 'policy_blocked', 'invalid_result')
    );

CREATE TABLE card_entitlement_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    price_offer_id UUID NOT NULL REFERENCES price_offers(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved',
    quantity SMALLINT NOT NULL CHECK (quantity BETWEEN 2 AND 30),
    unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor > 0),
    total_amount_minor INTEGER NOT NULL CHECK (total_amount_minor > 0),
    currency CHAR(3) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    release_idempotency_key VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    CONSTRAINT card_entitlement_reservations_status
        CHECK (status IN ('reserved', 'released', 'converted', 'expired')),
    CONSTRAINT card_entitlement_reservations_currency CHECK (currency = 'CAD'),
    CONSTRAINT card_entitlement_reservations_total_math
        CHECK (total_amount_minor = unit_amount_minor * quantity),
    CONSTRAINT card_entitlement_reservations_request_hash
        CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT card_entitlement_reservations_expiry CHECK (expires_at > created_at),
    CONSTRAINT card_entitlement_reservations_release_state CHECK (
        (status = 'reserved' AND release_idempotency_key IS NULL AND released_at IS NULL)
        OR (status = 'released' AND release_idempotency_key IS NOT NULL AND released_at IS NOT NULL)
        OR status IN ('converted', 'expired')
    )
);

CREATE UNIQUE INDEX card_entitlement_reservations_release_key_unique
    ON card_entitlement_reservations (user_id, release_idempotency_key)
    WHERE release_idempotency_key IS NOT NULL;

CREATE INDEX card_entitlement_reservations_user_status_idx
    ON card_entitlement_reservations (user_id, status, created_at DESC);

CREATE TABLE try_risk_free_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    price_offer_id UUID NOT NULL REFERENCES price_offers(id) ON DELETE RESTRICT,
    entitlement_id UUID,
    status VARCHAR(40) NOT NULL DEFAULT 'authorized',
    currency CHAR(3) NOT NULL,
    authorized_amount_minor INTEGER NOT NULL,
    captured_amount_minor INTEGER NOT NULL DEFAULT 0,
    released_amount_minor INTEGER NOT NULL DEFAULT 0,
    credits_granted SMALLINT NOT NULL,
    request_hash CHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    authorized_at TIMESTAMPTZ NOT NULL,
    authorization_expires_at TIMESTAMPTZ NOT NULL,
    fulfillment_started_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    FOREIGN KEY (entitlement_id, user_id)
        REFERENCES card_entitlements(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT try_risk_free_authorizations_status CHECK (
        status IN ('authorized', 'captured_full', 'captured_no_send', 'canceled')
    ),
    CONSTRAINT try_risk_free_authorizations_currency CHECK (currency = 'CAD'),
    CONSTRAINT try_risk_free_authorizations_terms CHECK (
        authorized_amount_minor = 999 AND credits_granted = 10
    ),
    CONSTRAINT try_risk_free_authorizations_request_hash
        CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT try_risk_free_authorizations_deadline CHECK (
        authorization_expires_at = authorized_at + INTERVAL '5 days'
    ),
    CONSTRAINT try_risk_free_authorizations_state_accounting CHECK (
        (
            status = 'authorized'
            AND captured_amount_minor = 0
            AND released_amount_minor = 0
            AND fulfillment_started_at IS NULL
            AND resolved_at IS NULL
        )
        OR (
            status = 'captured_full'
            AND captured_amount_minor = 999
            AND released_amount_minor = 0
            AND fulfillment_started_at IS NOT NULL
            AND resolved_at IS NOT NULL
        )
        OR (
            status = 'captured_no_send'
            AND captured_amount_minor = 200
            AND released_amount_minor = 799
            AND fulfillment_started_at IS NULL
            AND resolved_at IS NOT NULL
        )
        OR (
            status = 'canceled'
            AND captured_amount_minor = 0
            AND released_amount_minor = 999
            AND resolved_at IS NOT NULL
        )
    )
);

CREATE INDEX try_risk_free_authorizations_due_idx
    ON try_risk_free_authorizations (authorization_expires_at, id)
    WHERE status = 'authorized';

INSERT INTO lifecycle_state_transitions (entity_type, from_state, to_state)
VALUES
    ('card_entitlement', 'available', 'consumed'),
    ('card_entitlement_reservation', 'reserved', 'released'),
    ('card_entitlement_reservation', 'reserved', 'converted'),
    ('card_entitlement_reservation', 'reserved', 'expired'),
    ('generation_job', 'queued', 'failed'),
    ('try_risk_free_authorization', 'authorized', 'captured_full'),
    ('try_risk_free_authorization', 'authorized', 'captured_no_send'),
    ('try_risk_free_authorization', 'authorized', 'canceled');

CREATE TRIGGER card_entitlement_reservations_initial_state
BEFORE INSERT ON card_entitlement_reservations
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('card_entitlement_reservation', 'status', 'reserved');

CREATE TRIGGER card_entitlement_reservations_state_transition
BEFORE UPDATE OF status ON card_entitlement_reservations
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('card_entitlement_reservation', 'status');

CREATE TRIGGER try_risk_free_authorizations_initial_state
BEFORE INSERT ON try_risk_free_authorizations
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('try_risk_free_authorization', 'status', 'authorized');

CREATE TRIGGER try_risk_free_authorizations_state_transition
BEFORE UPDATE OF status ON try_risk_free_authorizations
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('try_risk_free_authorization', 'status');

CREATE TRIGGER card_entitlement_reservations_updated_at
BEFORE UPDATE ON card_entitlement_reservations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER try_risk_free_authorizations_updated_at
BEFORE UPDATE ON try_risk_free_authorizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION synchronize_try_risk_free_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = OLD.status OR NEW.entitlement_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'captured_full' THEN
        UPDATE card_entitlements
        SET status = 'consumed',
            quantity_reserved = 0,
            quantity_consumed = quantity_total,
            updated_at = clock_timestamp()
        WHERE id = NEW.entitlement_id
          AND user_id = NEW.user_id
          AND status IN ('available', 'reserved');
    ELSIF NEW.status IN ('captured_no_send', 'canceled') THEN
        UPDATE card_entitlements
        SET status = 'canceled',
            quantity_reserved = 0,
            updated_at = clock_timestamp()
        WHERE id = NEW.entitlement_id
          AND user_id = NEW.user_id
          AND status IN ('available', 'reserved');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER synchronize_try_risk_free_entitlement_after_resolution
AFTER UPDATE OF status ON try_risk_free_authorizations
FOR EACH ROW EXECUTE FUNCTION synchronize_try_risk_free_entitlement();

CREATE FUNCTION resolve_try_risk_free_for_fulfillment(
    p_authorization_id UUID,
    p_user_id UUID,
    p_now TIMESTAMPTZ
)
RETURNS TABLE (authorization_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    authorization_row try_risk_free_authorizations%ROWTYPE;
BEGIN
    IF p_now IS NULL THEN
        RAISE EXCEPTION 'resolution time is required' USING ERRCODE = '22004';
    END IF;

    SELECT * INTO authorization_row
    FROM try_risk_free_authorizations
    WHERE id = p_authorization_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND
       OR authorization_row.status <> 'authorized'
       OR p_now >= authorization_row.authorization_expires_at THEN
        RETURN;
    END IF;

    UPDATE try_risk_free_authorizations
    SET status = 'captured_full',
        captured_amount_minor = 999,
        released_amount_minor = 0,
        fulfillment_started_at = p_now,
        resolved_at = p_now
    WHERE id = authorization_row.id;

    INSERT INTO audit_events (
        actor_user_id,
        subject_user_id,
        action,
        entity_type,
        entity_id,
        outcome,
        metadata
    )
    VALUES (
        p_user_id,
        p_user_id,
        'try_risk_free.captured_full',
        'try_risk_free_authorization',
        authorization_row.id,
        'succeeded',
        '{"provider":"mock","captured_amount_minor":999,"currency":"CAD"}'::jsonb
    );

    RETURN QUERY SELECT authorization_row.id;
END;
$$;

CREATE FUNCTION resolve_due_try_risk_free_authorizations(
    p_now TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (authorization_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    candidate_id UUID;
    processed_count INTEGER := 0;
BEGIN
    IF p_now IS NULL THEN
        RAISE EXCEPTION 'resolution time is required' USING ERRCODE = '22004';
    END IF;

    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
        RAISE EXCEPTION 'resolution limit must be between 1 and 500' USING ERRCODE = '22023';
    END IF;

    LOOP
        EXIT WHEN processed_count >= p_limit;

        SELECT id INTO candidate_id
        FROM try_risk_free_authorizations
        WHERE status = 'authorized'
          AND authorization_expires_at <= p_now
        ORDER BY authorization_expires_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        EXIT WHEN candidate_id IS NULL;

        UPDATE try_risk_free_authorizations
        SET status = 'captured_no_send',
            captured_amount_minor = 200,
            released_amount_minor = 799,
            resolved_at = p_now
        WHERE id = candidate_id;

        INSERT INTO audit_events (
            subject_user_id,
            action,
            entity_type,
            entity_id,
            outcome,
            metadata
        )
        SELECT
            user_id,
            'try_risk_free.captured_no_send',
            'try_risk_free_authorization',
            id,
            'succeeded',
            '{"provider":"mock","captured_amount_minor":200,"released_amount_minor":799,"currency":"CAD"}'::jsonb
        FROM try_risk_free_authorizations
        WHERE id = candidate_id;

        authorization_id := candidate_id;
        processed_count := processed_count + 1;
        RETURN NEXT;
        candidate_id := NULL;
    END LOOP;
END;
$$;
