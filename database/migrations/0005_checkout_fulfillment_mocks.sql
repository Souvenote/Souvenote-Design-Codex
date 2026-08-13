-- Section 5 checkout, payment reconciliation, and fulfillment mock foundations.
-- Provider payloads and raw payment-card data are intentionally not persisted.

ALTER TABLE orders
    ADD COLUMN fulfillment_variant VARCHAR(30) NOT NULL DEFAULT 'personalized',
    ADD CONSTRAINT orders_fulfillment_variant
        CHECK (fulfillment_variant IN ('personalized', 'blank_handoff'));

ALTER TABLE fulfillment_jobs
    ADD COLUMN fulfillment_variant VARCHAR(30) NOT NULL DEFAULT 'personalized',
    ADD CONSTRAINT fulfillment_jobs_variant
        CHECK (fulfillment_variant IN ('personalized', 'blank_handoff'));

ALTER TABLE try_risk_free_authorizations
    ADD COLUMN order_id UUID,
    ADD COLUMN payment_id UUID,
    ADD CONSTRAINT try_risk_free_authorizations_order_owner
        FOREIGN KEY (order_id, user_id) REFERENCES orders(id, user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT try_risk_free_authorizations_payment_owner
        FOREIGN KEY (payment_id, user_id) REFERENCES payments(id, user_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX try_risk_free_authorizations_payment_unique
    ON try_risk_free_authorizations (payment_id)
    WHERE payment_id IS NOT NULL;

CREATE TABLE checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID,
    credit_pack_purchase_id UUID,
    payment_id UUID,
    provider VARCHAR(40) NOT NULL,
    provider_session_id VARCHAR(255),
    purpose VARCHAR(40) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'creating',
    collection_mode VARCHAR(20) NOT NULL,
    currency CHAR(3) NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    request_sha256 CHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    FOREIGN KEY (order_id, user_id)
        REFERENCES orders(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (credit_pack_purchase_id, user_id)
        REFERENCES credit_pack_purchases(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (payment_id, user_id)
        REFERENCES payments(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT checkout_sessions_provider CHECK (provider IN ('mock', 'stripe')),
    CONSTRAINT checkout_sessions_purpose CHECK (purpose IN ('physical_order', 'credit_pack')),
    CONSTRAINT checkout_sessions_status CHECK (
        status IN ('creating', 'open', 'completed', 'expired', 'canceled', 'failed')
    ),
    CONSTRAINT checkout_sessions_collection_mode CHECK (collection_mode IN ('automatic', 'manual')),
    CONSTRAINT checkout_sessions_currency CHECK (currency = 'CAD'),
    CONSTRAINT checkout_sessions_request_hash CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT checkout_sessions_exactly_one_target CHECK (
        (purpose = 'physical_order'
         AND order_id IS NOT NULL
         AND payment_id IS NOT NULL
         AND credit_pack_purchase_id IS NULL)
        OR
        (purpose = 'credit_pack'
         AND order_id IS NULL
         AND payment_id IS NULL
         AND credit_pack_purchase_id IS NOT NULL)
    ),
    CONSTRAINT checkout_sessions_completion_time CHECK (
        (status = 'completed' AND completed_at IS NOT NULL)
        OR (status <> 'completed' AND completed_at IS NULL)
    )
);

CREATE UNIQUE INDEX checkout_sessions_provider_session_unique
    ON checkout_sessions (provider, provider_session_id)
    WHERE provider_session_id IS NOT NULL;

CREATE INDEX checkout_sessions_user_created_idx
    ON checkout_sessions (user_id, created_at DESC, id DESC);

CREATE INDEX checkout_sessions_open_expiry_idx
    ON checkout_sessions (expires_at, id)
    WHERE status = 'open';

CREATE UNIQUE INDEX fulfillment_jobs_order_unique
    ON fulfillment_jobs (order_id);

CREATE TABLE blank_card_handoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    entitlement_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'reserved',
    request_sha256 CHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (order_id),
    UNIQUE (entitlement_id),
    UNIQUE (id, user_id),
    FOREIGN KEY (order_id, user_id)
        REFERENCES orders(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (entitlement_id, user_id)
        REFERENCES card_entitlements(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT blank_card_handoffs_status CHECK (status IN ('reserved', 'submitted', 'canceled')),
    CONSTRAINT blank_card_handoffs_request_hash CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT blank_card_handoffs_submission_time CHECK (
        (status = 'submitted' AND submitted_at IS NOT NULL)
        OR (status <> 'submitted' AND submitted_at IS NULL)
    )
);

INSERT INTO lifecycle_state_transitions (entity_type, from_state, to_state)
VALUES
    ('checkout_session', 'creating', 'open'),
    ('checkout_session', 'creating', 'failed'),
    ('checkout_session', 'open', 'completed'),
    ('checkout_session', 'open', 'expired'),
    ('checkout_session', 'open', 'canceled'),
    ('checkout_session', 'open', 'failed'),
    ('blank_card_handoff', 'reserved', 'submitted'),
    ('blank_card_handoff', 'reserved', 'canceled');

CREATE TRIGGER checkout_sessions_initial_state
BEFORE INSERT ON checkout_sessions
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('checkout_session', 'status', 'creating');

CREATE TRIGGER checkout_sessions_state_transition
BEFORE UPDATE OF status ON checkout_sessions
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('checkout_session', 'status');

CREATE TRIGGER checkout_sessions_set_updated_at
BEFORE UPDATE ON checkout_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER blank_card_handoffs_initial_state
BEFORE INSERT ON blank_card_handoffs
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('blank_card_handoff', 'status', 'reserved');

CREATE TRIGGER blank_card_handoffs_state_transition
BEFORE UPDATE OF status ON blank_card_handoffs
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('blank_card_handoff', 'status');

CREATE TRIGGER blank_card_handoffs_set_updated_at
BEFORE UPDATE ON blank_card_handoffs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Both verified Stripe-compatible webhooks and the deterministic local completion
-- endpoint call this row-locked function. A completed session is a no-op, so provider
-- retries cannot duplicate captures, entitlements, or credit grants.
CREATE FUNCTION complete_checkout_session(
    p_checkout_session_id UUID,
    p_provider_payment_id VARCHAR(255),
    p_now TIMESTAMPTZ
)
RETURNS TABLE (checkout_session_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    session_row checkout_sessions%ROWTYPE;
    purchase_row credit_pack_purchases%ROWTYPE;
    order_row orders%ROWTYPE;
    payment_row payments%ROWTYPE;
    offer_type_value VARCHAR(40);
    offer_id_value UUID;
    item_quantity SMALLINT;
    credits_per_card_value SMALLINT;
    authorization_amount_value INTEGER;
    entitlement_id_value UUID;
    authorization_id_value UUID;
BEGIN
    IF p_now IS NULL OR NULLIF(BTRIM(p_provider_payment_id), '') IS NULL THEN
        RAISE EXCEPTION 'checkout completion identity and time are required' USING ERRCODE = '22004';
    END IF;

    SELECT * INTO session_row
    FROM checkout_sessions
    WHERE id = p_checkout_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF session_row.status = 'completed' THEN
        IF session_row.purpose = 'credit_pack' THEN
            SELECT * INTO purchase_row
            FROM credit_pack_purchases
            WHERE id = session_row.credit_pack_purchase_id;
            IF purchase_row.provider_payment_id IS DISTINCT FROM p_provider_payment_id THEN
                RAISE EXCEPTION 'completed checkout payment identity mismatch' USING ERRCODE = '23505';
            END IF;
        ELSE
            SELECT * INTO payment_row
            FROM payments
            WHERE id = session_row.payment_id;
            IF payment_row.provider_payment_id IS DISTINCT FROM p_provider_payment_id THEN
                RAISE EXCEPTION 'completed checkout payment identity mismatch' USING ERRCODE = '23505';
            END IF;
        END IF;
        RETURN QUERY SELECT session_row.id;
        RETURN;
    END IF;

    IF session_row.status <> 'open' OR p_now >= session_row.expires_at THEN
        RAISE EXCEPTION 'checkout session is not open' USING ERRCODE = '23514';
    END IF;

    IF session_row.purpose = 'credit_pack' THEN
        SELECT * INTO purchase_row
        FROM credit_pack_purchases
        WHERE id = session_row.credit_pack_purchase_id
          AND user_id = session_row.user_id
        FOR UPDATE;

        IF NOT FOUND OR purchase_row.amount_minor <> session_row.amount_minor
           OR purchase_row.currency <> session_row.currency THEN
            RAISE EXCEPTION 'credit-pack checkout snapshot mismatch' USING ERRCODE = '23514';
        END IF;

        UPDATE credit_pack_purchases
        SET status = 'captured',
            provider_payment_id = p_provider_payment_id,
            captured_at = p_now
        WHERE id = purchase_row.id
          AND status = 'pending';

        PERFORM * FROM apply_credit_ledger_entry(
            session_row.user_id,
            'purchase_grant',
            purchase_row.credit_quantity,
            'credit_pack_purchase',
            purchase_row.id,
            'credit-pack-credits:' || purchase_row.id::text,
            jsonb_build_object(
                'amount_minor', purchase_row.amount_minor,
                'currency', purchase_row.currency,
                'provider', session_row.provider
            )
        );
    ELSE
        SELECT * INTO order_row
        FROM orders
        WHERE id = session_row.order_id
          AND user_id = session_row.user_id
        FOR UPDATE;

        SELECT * INTO payment_row
        FROM payments
        WHERE id = session_row.payment_id
          AND user_id = session_row.user_id
          AND order_id = session_row.order_id
        FOR UPDATE;

        SELECT item.price_offer_id, item.quantity, offer.offer_type,
               offer.credits_per_card, offer.authorization_amount_minor
        INTO offer_id_value, item_quantity, offer_type_value,
             credits_per_card_value, authorization_amount_value
        FROM order_items item
        JOIN price_offers offer ON offer.id = item.price_offer_id
        WHERE item.order_id = session_row.order_id
          AND item.user_id = session_row.user_id
        ORDER BY item.created_at, item.id
        LIMIT 1;

        IF order_row.id IS NULL OR payment_row.id IS NULL OR offer_type_value IS NULL
           OR order_row.total_minor <> session_row.amount_minor
           OR order_row.currency <> session_row.currency THEN
            RAISE EXCEPTION 'physical checkout snapshot mismatch' USING ERRCODE = '23514';
        END IF;

        IF offer_type_value = 'try_risk_free' THEN
            IF authorization_amount_value <> 999 OR item_quantity <> 1 OR credits_per_card_value <> 10 THEN
                RAISE EXCEPTION 'Try Risk-Free terms do not match the approved contract' USING ERRCODE = '23514';
            END IF;

            INSERT INTO try_risk_free_authorizations (
                user_id, price_offer_id, order_id, payment_id, currency,
                authorized_amount_minor, credits_granted, request_hash,
                idempotency_key, authorized_at, authorization_expires_at
            )
            VALUES (
                session_row.user_id, offer_id_value, order_row.id, payment_row.id,
                session_row.currency, 999, 10, session_row.request_sha256,
                'checkout:' || session_row.id::text, p_now, p_now + INTERVAL '5 days'
            )
            RETURNING id INTO authorization_id_value;

            INSERT INTO card_entitlements (
                user_id, price_offer_id, source_type, source_id, quantity_total,
                expires_at, idempotency_key
            )
            VALUES (
                session_row.user_id, offer_id_value, 'try_risk_free', authorization_id_value,
                1, p_now + INTERVAL '12 months',
                'try-risk-free-entitlement:' || authorization_id_value::text
            )
            RETURNING id INTO entitlement_id_value;

            UPDATE try_risk_free_authorizations
            SET entitlement_id = entitlement_id_value
            WHERE id = authorization_id_value;

            PERFORM * FROM apply_credit_ledger_entry(
                session_row.user_id, 'purchase_grant', 10,
                'try_risk_free_authorization', authorization_id_value,
                'try-risk-free-credits:' || authorization_id_value::text,
                jsonb_build_object('provider', session_row.provider)
            );

            UPDATE payments
            SET provider_payment_id = p_provider_payment_id,
                status = 'authorized',
                authorized_amount_minor = 999,
                captured_amount_minor = 0,
                authorization_expires_at = p_now + INTERVAL '5 days'
            WHERE id = payment_row.id;

            UPDATE orders
            SET status = 'authorized', placed_at = p_now
            WHERE id = order_row.id;
        ELSIF offer_type_value = 'big_sender' THEN
            INSERT INTO card_entitlements (
                user_id, price_offer_id, source_type, source_id, quantity_total,
                expires_at, idempotency_key
            )
            VALUES (
                session_row.user_id, offer_id_value, 'big_sender', order_row.id,
                item_quantity, p_now + INTERVAL '12 months',
                'big-sender-entitlement:' || order_row.id::text
            )
            RETURNING id INTO entitlement_id_value;

            PERFORM * FROM apply_credit_ledger_entry(
                session_row.user_id, 'purchase_grant', credits_per_card_value * item_quantity,
                'order', order_row.id,
                'big-sender-credits:' || order_row.id::text,
                jsonb_build_object(
                    'quantity', item_quantity,
                    'amount_minor', session_row.amount_minor,
                    'currency', session_row.currency,
                    'provider', session_row.provider
                )
            );

            UPDATE payments
            SET provider_payment_id = p_provider_payment_id,
                status = 'captured',
                authorized_amount_minor = session_row.amount_minor,
                captured_amount_minor = session_row.amount_minor
            WHERE id = payment_row.id;

            UPDATE orders
            SET status = 'paid', placed_at = p_now
            WHERE id = order_row.id;
        ELSE
            RAISE EXCEPTION 'physical checkout offer type is unsupported' USING ERRCODE = '23514';
        END IF;
    END IF;

    UPDATE checkout_sessions
    SET status = 'completed', completed_at = p_now
    WHERE id = session_row.id;

    INSERT INTO audit_events (
        actor_user_id, subject_user_id, action, entity_type, entity_id,
        idempotency_key, outcome, metadata
    )
    VALUES (
        session_row.user_id, session_row.user_id, 'checkout.completed',
        'checkout_session', session_row.id, 'checkout-complete:' || session_row.id::text,
        'succeeded', jsonb_build_object(
            'purpose', session_row.purpose,
            'amount_minor', session_row.amount_minor,
            'currency', session_row.currency,
            'provider', session_row.provider
        )
    );

    RETURN QUERY SELECT session_row.id;
END;
$$;

CREATE FUNCTION fail_checkout_session(
    p_checkout_session_id UUID,
    p_error_category VARCHAR(80)
)
RETURNS TABLE (checkout_session_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
    session_row checkout_sessions%ROWTYPE;
BEGIN
    SELECT * INTO session_row
    FROM checkout_sessions
    WHERE id = p_checkout_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;
    IF session_row.status = 'failed' THEN
        RETURN QUERY SELECT session_row.id;
        RETURN;
    END IF;
    IF session_row.status <> 'open' THEN
        RAISE EXCEPTION 'checkout session is not open' USING ERRCODE = '23514';
    END IF;

    IF session_row.purpose = 'credit_pack' THEN
        UPDATE credit_pack_purchases
        SET status = 'failed'
        WHERE id = session_row.credit_pack_purchase_id
          AND user_id = session_row.user_id
          AND status = 'pending';
    ELSE
        UPDATE payments
        SET status = 'failed'
        WHERE id = session_row.payment_id
          AND user_id = session_row.user_id
          AND status IN ('pending', 'requires_action');
        UPDATE orders
        SET status = 'payment_failed'
        WHERE id = session_row.order_id
          AND user_id = session_row.user_id
          AND status = 'pending_payment';
    END IF;

    UPDATE checkout_sessions SET status = 'failed' WHERE id = session_row.id;

    INSERT INTO audit_events (
        subject_user_id, action, entity_type, entity_id, outcome, metadata
    )
    VALUES (
        session_row.user_id, 'checkout.failed', 'checkout_session', session_row.id,
        'failed', jsonb_build_object(
            'purpose', session_row.purpose,
            'provider', session_row.provider,
            'error_category', LEFT(COALESCE(NULLIF(p_error_category, ''), 'provider_declined'), 80)
        )
    );

    RETURN QUERY SELECT session_row.id;
END;
$$;

-- Keep the payment row synchronized when either the worker deadline resolver or
-- fulfillment resolves Try Risk-Free. This preserves one database-owned schedule.
CREATE FUNCTION synchronize_try_risk_free_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = OLD.status OR NEW.payment_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.status IN ('captured_full', 'captured_no_send') THEN
        UPDATE payments
        SET status = 'captured',
            captured_amount_minor = NEW.captured_amount_minor
        WHERE id = NEW.payment_id
          AND user_id = NEW.user_id
          AND status = 'authorized';
    ELSIF NEW.status = 'canceled' THEN
        UPDATE payments
        SET status = 'canceled'
        WHERE id = NEW.payment_id
          AND user_id = NEW.user_id
          AND status = 'authorized';
    END IF;

    IF NEW.order_id IS NOT NULL AND NEW.status IN ('captured_no_send', 'canceled') THEN
        UPDATE orders
        SET status = 'canceled'
        WHERE id = NEW.order_id
          AND user_id = NEW.user_id
          AND status = 'authorized';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER synchronize_try_risk_free_payment_after_resolution
AFTER UPDATE OF status ON try_risk_free_authorizations
FOR EACH ROW EXECUTE FUNCTION synchronize_try_risk_free_payment();

-- These columns indicate that the approved products now have a checkout contract.
-- Runtime provider modes and production feature flags still fail closed.
UPDATE price_offers
SET checkout_enabled = TRUE
WHERE offer_type IN ('try_risk_free', 'big_sender')
  AND catalog_visible = TRUE;

UPDATE credit_pack_offers
SET checkout_enabled = TRUE
WHERE catalog_visible = TRUE;

INSERT INTO feature_flags (flag_key, environment, enabled, configuration)
VALUES
    ('payments.hosted_checkout', 'production', FALSE, '{"approval_required":"section_7_stripe_activation"}'::jsonb),
    ('fulfillment.scribeless', 'production', FALSE, '{"approval_required":"section_7_scribeless_activation"}'::jsonb),
    ('fulfillment.blank_card_handoff', 'production', FALSE, '{"approval_required":"final_blank_payload_contract"}'::jsonb);
