-- Souvenote pre-launch MVP baseline.
--
-- This is a clean-database baseline, not an upgrade from the unverified draft
-- migrations that preceded Section 2. Apply it only through database/migrate.mjs.
-- The migration runner verifies the source checksum and records it in
-- schema_migrations before any later migration may run.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(20) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    checksum_sha256 CHAR(64) NOT NULL,
    execution_ms INTEGER NOT NULL CHECK (execution_ms >= 0),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    applied_by NAME NOT NULL DEFAULT current_user,
    CONSTRAINT schema_migrations_checksum_format
        CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

CREATE FUNCTION reject_immutable_row_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME
        USING ERRCODE = '55000';
END;
$$;

CREATE TABLE lifecycle_state_transitions (
    entity_type VARCHAR(80) NOT NULL,
    from_state VARCHAR(80) NOT NULL,
    to_state VARCHAR(80) NOT NULL,
    PRIMARY KEY (entity_type, from_state, to_state),
    CONSTRAINT lifecycle_transition_changes_state CHECK (from_state <> to_state)
);

CREATE FUNCTION enforce_lifecycle_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    old_state TEXT;
    new_state TEXT;
BEGIN
    old_state := to_jsonb(OLD) ->> TG_ARGV[1];
    new_state := to_jsonb(NEW) ->> TG_ARGV[1];

    IF old_state IS DISTINCT FROM new_state
       AND NOT EXISTS (
           SELECT 1
           FROM lifecycle_state_transitions
           WHERE entity_type = TG_ARGV[0]
             AND from_state = old_state
             AND to_state = new_state
       ) THEN
        RAISE EXCEPTION 'invalid % transition: % -> %', TG_ARGV[0], old_state, new_state
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION enforce_initial_lifecycle_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    initial_state TEXT;
BEGIN
    initial_state := to_jsonb(NEW) ->> TG_ARGV[1];
    IF initial_state IS DISTINCT FROM TG_ARGV[2] THEN
        RAISE EXCEPTION 'invalid initial % state: % (expected %)',
            TG_ARGV[0], initial_state, TG_ARGV[2]
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

INSERT INTO lifecycle_state_transitions (entity_type, from_state, to_state)
VALUES
    ('asset', 'pending', 'generating'),
    ('asset', 'generating', 'ready'),
    ('asset', 'generating', 'failed'),
    ('asset', 'failed', 'generating'),
    ('card_draft', 'draft', 'generating'),
    ('card_draft', 'draft', 'archived'),
    ('card_draft', 'generating', 'draft'),
    ('card_draft', 'generating', 'review'),
    ('card_draft', 'review', 'draft'),
    ('card_draft', 'review', 'generating'),
    ('card_draft', 'review', 'approved'),
    ('card_draft', 'approved', 'ordered'),
    ('card_draft', 'approved', 'archived'),
    ('card_draft', 'ordered', 'sent'),
    ('card_entitlement', 'available', 'reserved'),
    ('card_entitlement', 'available', 'expired'),
    ('card_entitlement', 'available', 'canceled'),
    ('card_entitlement', 'reserved', 'available'),
    ('card_entitlement', 'reserved', 'consumed'),
    ('card_entitlement', 'reserved', 'expired'),
    ('card_entitlement', 'reserved', 'canceled'),
    ('fulfillment_job', 'queued', 'submitting'),
    ('fulfillment_job', 'queued', 'canceled'),
    ('fulfillment_job', 'submitting', 'submitted'),
    ('fulfillment_job', 'submitting', 'retryable_failed'),
    ('fulfillment_job', 'submitting', 'permanent_failed'),
    ('fulfillment_job', 'submitted', 'accepted'),
    ('fulfillment_job', 'submitted', 'retryable_failed'),
    ('fulfillment_job', 'submitted', 'permanent_failed'),
    ('fulfillment_job', 'accepted', 'printing'),
    ('fulfillment_job', 'accepted', 'retryable_failed'),
    ('fulfillment_job', 'accepted', 'permanent_failed'),
    ('fulfillment_job', 'printing', 'mailed'),
    ('fulfillment_job', 'printing', 'retryable_failed'),
    ('fulfillment_job', 'printing', 'permanent_failed'),
    ('fulfillment_job', 'mailed', 'delivered'),
    ('fulfillment_job', 'retryable_failed', 'queued'),
    ('fulfillment_job', 'retryable_failed', 'permanent_failed'),
    ('fulfillment_job', 'retryable_failed', 'canceled'),
    ('generation_job', 'queued', 'running'),
    ('generation_job', 'queued', 'canceled'),
    ('generation_job', 'running', 'succeeded'),
    ('generation_job', 'running', 'partially_failed'),
    ('generation_job', 'running', 'failed'),
    ('generation_job', 'running', 'canceled'),
    ('generation_job', 'partially_failed', 'refunded'),
    ('generation_job', 'failed', 'refunded'),
    ('generation_job', 'succeeded', 'approved'),
    ('notification', 'queued', 'sending'),
    ('notification', 'queued', 'canceled'),
    ('notification', 'sending', 'sent'),
    ('notification', 'sending', 'failed'),
    ('notification', 'failed', 'queued'),
    ('notification', 'failed', 'canceled'),
    ('order', 'pending_payment', 'authorized'),
    ('order', 'pending_payment', 'paid'),
    ('order', 'pending_payment', 'payment_failed'),
    ('order', 'pending_payment', 'canceled'),
    ('order', 'authorized', 'paid'),
    ('order', 'authorized', 'fulfillment_pending'),
    ('order', 'authorized', 'payment_failed'),
    ('order', 'authorized', 'canceled'),
    ('order', 'paid', 'fulfillment_pending'),
    ('order', 'paid', 'refunded'),
    ('order', 'fulfillment_pending', 'submitted'),
    ('order', 'fulfillment_pending', 'fulfillment_failed'),
    ('order', 'fulfillment_pending', 'canceled'),
    ('order', 'submitted', 'in_fulfillment'),
    ('order', 'submitted', 'fulfillment_failed'),
    ('order', 'in_fulfillment', 'shipped'),
    ('order', 'in_fulfillment', 'fulfillment_failed'),
    ('order', 'shipped', 'delivered'),
    ('payment', 'pending', 'requires_action'),
    ('payment', 'pending', 'authorized'),
    ('payment', 'pending', 'captured'),
    ('payment', 'pending', 'failed'),
    ('payment', 'pending', 'canceled'),
    ('payment', 'requires_action', 'authorized'),
    ('payment', 'requires_action', 'captured'),
    ('payment', 'requires_action', 'failed'),
    ('payment', 'requires_action', 'canceled'),
    ('payment', 'authorized', 'captured'),
    ('payment', 'authorized', 'failed'),
    ('payment', 'authorized', 'canceled'),
    ('payment', 'captured', 'partially_refunded'),
    ('payment', 'captured', 'refunded'),
    ('payment', 'partially_refunded', 'refunded'),
    ('provider_attempt', 'pending', 'running'),
    ('provider_attempt', 'running', 'succeeded'),
    ('provider_attempt', 'running', 'failed'),
    ('provider_attempt', 'running', 'timed_out'),
    ('shipment', 'label_created', 'in_transit'),
    ('shipment', 'label_created', 'canceled'),
    ('shipment', 'in_transit', 'delivered'),
    ('shipment', 'in_transit', 'exception'),
    ('shipment', 'in_transit', 'returned'),
    ('shipment', 'exception', 'in_transit'),
    ('shipment', 'exception', 'returned'),
    ('upload', 'upload_pending', 'upload_done'),
    ('upload', 'upload_done', 'moderation_pending'),
    ('upload', 'upload_done', 'attestation_required'),
    ('upload', 'moderation_pending', 'moderation_passed'),
    ('upload', 'moderation_pending', 'moderation_failed'),
    ('upload', 'moderation_passed', 'attestation_required'),
    ('upload', 'moderation_passed', 'committed'),
    ('upload', 'attestation_required', 'attestation_done'),
    ('upload', 'attestation_done', 'moderation_pending'),
    ('upload', 'attestation_done', 'committed'),
    ('webhook_event', 'received', 'processing'),
    ('webhook_event', 'received', 'ignored'),
    ('webhook_event', 'processing', 'processed'),
    ('webhook_event', 'processing', 'failed'),
    ('webhook_event', 'processing', 'ignored'),
    ('webhook_event', 'failed', 'processing');

CREATE TRIGGER schema_migrations_are_immutable
BEFORE UPDATE OR DELETE ON schema_migrations
FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

CREATE TRIGGER lifecycle_transitions_are_immutable
BEFORE UPDATE OR DELETE ON lifecycle_state_transitions
FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

-- Users, identities, and application sessions.

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL,
    first_name VARCHAR(120),
    last_name VARCHAR(120),
    phone VARCHAR(40),
    birthday DATE,
    country CHAR(2) NOT NULL DEFAULT 'CA',
    currency CHAR(3) NOT NULL DEFAULT 'CAD',
    language VARCHAR(35) NOT NULL DEFAULT 'en-CA',
    marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    provisioned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT users_email_shape CHECK (position('@' IN email) > 1),
    CONSTRAINT users_country_format CHECK (country ~ '^[A-Z]{2}$'),
    CONSTRAINT users_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT users_preferences_object CHECK (jsonb_typeof(preferences) = 'object')
);

CREATE UNIQUE INDEX users_email_active_unique
    ON users (lower(email))
    WHERE deleted_at IS NULL;

CREATE TABLE auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(40) NOT NULL DEFAULT 'cognito',
    issuer VARCHAR(500) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_authenticated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (issuer, subject),
    UNIQUE (id, user_id),
    CONSTRAINT auth_identities_provider CHECK (provider IN ('cognito', 'local'))
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    auth_identity_id UUID NOT NULL,
    session_token_hash CHAR(64) NOT NULL UNIQUE,
    csrf_secret_hash CHAR(64) NOT NULL,
    encrypted_refresh_token BYTEA,
    scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (auth_identity_id, user_id)
        REFERENCES auth_identities(id, user_id) ON DELETE CASCADE,
    CONSTRAINT user_sessions_token_hash_format
        CHECK (session_token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT user_sessions_csrf_hash_format
        CHECK (csrf_secret_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT user_sessions_expiry CHECK (expires_at > created_at)
);

CREATE TABLE idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scope_type VARCHAR(20) NOT NULL,
    scope_id VARCHAR(255) NOT NULL,
    operation VARCHAR(120) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'processing',
    resource_type VARCHAR(80),
    resource_id UUID,
    response_code INTEGER,
    response_body JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (scope_type, scope_id, operation, idempotency_key),
    CONSTRAINT idempotency_scope_type CHECK (scope_type IN ('user', 'system', 'webhook')),
    CONSTRAINT idempotency_user_scope CHECK (
        (scope_type = 'user' AND user_id IS NOT NULL AND scope_id = user_id::text)
        OR (scope_type <> 'user' AND user_id IS NULL)
    ),
    CONSTRAINT idempotency_request_hash_format
        CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT idempotency_state
        CHECK (state IN ('processing', 'completed', 'failed')),
    CONSTRAINT idempotency_response_code
        CHECK (response_code IS NULL OR response_code BETWEEN 100 AND 599),
    CONSTRAINT idempotency_response_body_object
        CHECK (response_body IS NULL OR jsonb_typeof(response_body) = 'object'),
    CONSTRAINT idempotency_expiry CHECK (expires_at > created_at)
);

-- Price books and product-neutral physical-card offers. Section 3 activates the
-- approved CAD catalog; the baseline deliberately creates no active offers.

CREATE TABLE price_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    market_country CHAR(2) NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    effective_from TIMESTAMPTZ,
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT price_books_market_format CHECK (market_country ~ '^[A-Z]{2}$'),
    CONSTRAINT price_books_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT price_books_status CHECK (status IN ('draft', 'active', 'retired')),
    CONSTRAINT price_books_effective_range
        CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until > effective_from)
);

CREATE TABLE price_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_book_id UUID NOT NULL REFERENCES price_books(id) ON DELETE RESTRICT,
    offer_code VARCHAR(80) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    product_type VARCHAR(40) NOT NULL DEFAULT 'physical_card',
    offer_type VARCHAR(40) NOT NULL,
    unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
    authorization_amount_minor INTEGER CHECK (authorization_amount_minor >= 0),
    no_send_fee_minor INTEGER CHECK (no_send_fee_minor >= 0),
    authorization_days SMALLINT CHECK (authorization_days > 0),
    minimum_quantity SMALLINT NOT NULL CHECK (minimum_quantity > 0),
    maximum_quantity SMALLINT NOT NULL CHECK (maximum_quantity > 0),
    credits_per_card SMALLINT NOT NULL DEFAULT 10 CHECK (credits_per_card >= 0),
    shipping_included BOOLEAN NOT NULL DEFAULT TRUE,
    checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (price_book_id, offer_code, version),
    CONSTRAINT price_offers_product_type CHECK (product_type = 'physical_card'),
    CONSTRAINT price_offers_offer_type CHECK (offer_type IN ('try_risk_free', 'big_sender')),
    CONSTRAINT price_offers_quantity_range CHECK (maximum_quantity >= minimum_quantity),
    CONSTRAINT price_offers_no_send_fee
        CHECK (no_send_fee_minor IS NULL OR authorization_amount_minor IS NOT NULL),
    CONSTRAINT price_offers_no_send_not_above_authorization
        CHECK (no_send_fee_minor IS NULL OR no_send_fee_minor <= authorization_amount_minor),
    CONSTRAINT price_offers_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- Atomic, append-only credits.

CREATE TABLE credit_accounts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    amount INTEGER NOT NULL CHECK (amount <> 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    source_type VARCHAR(80) NOT NULL,
    source_id UUID,
    idempotency_key VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    CONSTRAINT credit_ledger_event_type CHECK (
        event_type IN (
            'signup_grant',
            'purchase_grant',
            'generation_reservation',
            'generation_refund',
            'expiration',
            'correction'
        )
    ),
    CONSTRAINT credit_ledger_event_sign CHECK (
        (event_type IN ('signup_grant', 'purchase_grant', 'generation_refund') AND amount > 0)
        OR (event_type IN ('generation_reservation', 'expiration') AND amount < 0)
        OR event_type = 'correction'
    ),
    CONSTRAINT credit_ledger_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX credit_ledger_one_signup_grant
    ON credit_ledger (user_id)
    WHERE event_type = 'signup_grant';

CREATE FUNCTION provision_credit_account()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO credit_accounts (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER provision_user_credit_account
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION provision_credit_account();

CREATE FUNCTION apply_credit_ledger_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    SELECT balance INTO STRICT current_balance
    FROM credit_accounts
    WHERE user_id = NEW.user_id
    FOR UPDATE;

    NEW.balance_after := current_balance + NEW.amount;
    IF NEW.balance_after < 0 THEN
        RAISE EXCEPTION 'insufficient credits'
            USING ERRCODE = '23514';
    END IF;

    UPDATE credit_accounts
    SET balance = NEW.balance_after,
        version = version + 1,
        updated_at = clock_timestamp()
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER credit_ledger_insert_is_atomic
BEFORE INSERT ON credit_ledger
FOR EACH ROW EXECUTE FUNCTION apply_credit_ledger_insert();

CREATE FUNCTION apply_credit_ledger_entry(
    p_user_id UUID,
    p_event_type VARCHAR,
    p_amount INTEGER,
    p_source_type VARCHAR,
    p_source_id UUID,
    p_idempotency_key VARCHAR,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (ledger_entry_id UUID, resulting_balance INTEGER, applied BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
    existing_entry credit_ledger%ROWTYPE;
    new_entry_id UUID;
    new_balance INTEGER;
BEGIN
    PERFORM 1
    FROM credit_accounts
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'credit account does not exist'
            USING ERRCODE = '23503';
    END IF;

    SELECT * INTO existing_entry
      FROM credit_ledger
     WHERE user_id = p_user_id
       AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF existing_entry.event_type <> p_event_type
           OR existing_entry.amount <> p_amount
           OR existing_entry.source_type <> p_source_type
           OR existing_entry.source_id IS DISTINCT FROM p_source_id THEN
            RAISE EXCEPTION 'idempotency key was reused with different credit input'
                USING ERRCODE = '23505';
        END IF;

        RETURN QUERY
        SELECT existing_entry.id, existing_entry.balance_after, FALSE;
        RETURN;
    END IF;

    INSERT INTO credit_ledger (
        user_id,
        event_type,
        amount,
        source_type,
        source_id,
        idempotency_key,
        metadata
    )
    VALUES (
        p_user_id,
        p_event_type,
        p_amount,
        p_source_type,
        p_source_id,
        p_idempotency_key,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id, balance_after INTO new_entry_id, new_balance;

    RETURN QUERY SELECT new_entry_id, new_balance, TRUE;
END;
$$;

CREATE TRIGGER credit_ledger_is_immutable
BEFORE UPDATE OR DELETE ON credit_ledger
FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

-- Physical-card entitlements.

CREATE TABLE card_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    price_offer_id UUID REFERENCES price_offers(id) ON DELETE RESTRICT,
    source_type VARCHAR(40) NOT NULL,
    source_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    quantity_total SMALLINT NOT NULL CHECK (quantity_total > 0),
    quantity_reserved SMALLINT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    quantity_consumed SMALLINT NOT NULL DEFAULT 0 CHECK (quantity_consumed >= 0),
    expires_at TIMESTAMPTZ,
    idempotency_key VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    CONSTRAINT card_entitlements_source_type
        CHECK (source_type IN ('try_risk_free', 'big_sender', 'administrative')),
    CONSTRAINT card_entitlements_status
        CHECK (status IN ('available', 'reserved', 'consumed', 'expired', 'canceled')),
    CONSTRAINT card_entitlements_quantity_accounting
        CHECK (quantity_reserved + quantity_consumed <= quantity_total),
    CONSTRAINT card_entitlements_status_quantity CHECK (
        (status = 'available' AND quantity_reserved = 0 AND quantity_consumed < quantity_total)
        OR (status = 'reserved' AND quantity_reserved > 0)
        OR (status = 'consumed' AND quantity_reserved = 0 AND quantity_consumed = quantity_total)
        OR status IN ('expired', 'canceled')
    ),
    CONSTRAINT card_entitlements_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- Drafts and append-only revisions.

CREATE TABLE card_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creation_route VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    current_revision_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (id, user_id),
    CONSTRAINT card_drafts_creation_route
        CHECK (creation_route IN ('personalize_template', 'build_my_card')),
    CONSTRAINT card_drafts_status
        CHECK (status IN ('draft', 'generating', 'review', 'approved', 'ordered', 'sent', 'archived'))
);

CREATE TABLE card_draft_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL,
    user_id UUID NOT NULL,
    revision_number INTEGER NOT NULL CHECK (revision_number > 0),
    occasion VARCHAR(160),
    relationship VARCHAR(160),
    creative_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
    template_key VARCHAR(255),
    inside_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (draft_id, revision_number),
    UNIQUE (id, user_id),
    FOREIGN KEY (draft_id, user_id)
        REFERENCES card_drafts(id, user_id) ON DELETE CASCADE,
    CONSTRAINT card_draft_revisions_brief_object CHECK (jsonb_typeof(creative_brief) = 'object')
);

ALTER TABLE card_drafts
    ADD CONSTRAINT card_drafts_current_revision_owner
    FOREIGN KEY (current_revision_id, user_id)
    REFERENCES card_draft_revisions(id, user_id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TRIGGER card_draft_revisions_are_immutable
BEFORE UPDATE OR DELETE ON card_draft_revisions
FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

-- Private upload lifecycle.

CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    card_draft_id UUID NOT NULL,
    revision_id UUID,
    original_filename VARCHAR(255) NOT NULL,
    media_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    width_pixels INTEGER CHECK (width_pixels > 0),
    height_pixels INTEGER CHECK (height_pixels > 0),
    content_sha256 CHAR(64) NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    completion_idempotency_key VARCHAR(255),
    storage_provider VARCHAR(40) NOT NULL DEFAULT 'local',
    storage_key VARCHAR(1024) NOT NULL UNIQUE,
    status VARCHAR(40) NOT NULL DEFAULT 'upload_pending',
    moderation_result JSONB,
    rights_attested_at TIMESTAMPTZ,
    committed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (id, user_id),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (user_id, completion_idempotency_key),
    FOREIGN KEY (card_draft_id, user_id)
        REFERENCES card_drafts(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (revision_id, user_id)
        REFERENCES card_draft_revisions(id, user_id) ON DELETE SET NULL (revision_id),
    CONSTRAINT uploads_content_hash_format CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uploads_request_hash_format CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT uploads_storage_provider CHECK (storage_provider IN ('local', 's3')),
    CONSTRAINT uploads_status CHECK (
        status IN (
            'upload_pending',
            'upload_done',
            'moderation_pending',
            'moderation_passed',
            'moderation_failed',
            'attestation_required',
            'attestation_done',
            'committed'
        )
    ),
    CONSTRAINT uploads_moderation_result_object
        CHECK (moderation_result IS NULL OR jsonb_typeof(moderation_result) = 'object'),
    CONSTRAINT uploads_expire_within_24_hours
        CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '24 hours'),
    CONSTRAINT uploads_committed_timestamp
        CHECK ((status = 'committed') = (committed_at IS NOT NULL))
);

-- Generation jobs, sanitized provider attempts, and persisted assets.

CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    card_draft_id UUID NOT NULL,
    revision_id UUID NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'queued',
    request_hash CHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    credits_reserved SMALLINT NOT NULL DEFAULT 0 CHECK (credits_reserved >= 0),
    credits_refunded SMALLINT NOT NULL DEFAULT 0 CHECK (credits_refunded >= 0),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    FOREIGN KEY (card_draft_id, user_id)
        REFERENCES card_drafts(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (revision_id, user_id)
        REFERENCES card_draft_revisions(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT generation_jobs_status CHECK (
        status IN (
            'queued',
            'running',
            'succeeded',
            'partially_failed',
            'failed',
            'refunded',
            'canceled',
            'approved'
        )
    ),
    CONSTRAINT generation_jobs_request_hash_format CHECK (request_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT generation_jobs_credit_accounting CHECK (credits_refunded <= credits_reserved)
);

CREATE TABLE provider_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    generation_job_id UUID NOT NULL,
    asset_type VARCHAR(40) NOT NULL,
    provider VARCHAR(80) NOT NULL,
    model VARCHAR(160) NOT NULL,
    model_version VARCHAR(160),
    provider_request_id VARCHAR(255),
    attempt_number SMALLINT NOT NULL CHECK (attempt_number > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    input_hash CHAR(64) NOT NULL,
    result_storage_key VARCHAR(1024),
    moderation_result JSONB,
    cost_amount_minor INTEGER CHECK (cost_amount_minor >= 0),
    cost_currency CHAR(3),
    error_category VARCHAR(80),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (generation_job_id, asset_type, attempt_number),
    UNIQUE (id, user_id),
    FOREIGN KEY (generation_job_id, user_id)
        REFERENCES generation_jobs(id, user_id) ON DELETE CASCADE,
    CONSTRAINT provider_attempts_asset_type
        CHECK (asset_type IN ('image', 'song', 'message')),
    CONSTRAINT provider_attempts_status
        CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'timed_out')),
    CONSTRAINT provider_attempts_input_hash_format CHECK (input_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT provider_attempts_cost_currency
        CHECK ((cost_amount_minor IS NULL) = (cost_currency IS NULL)),
    CONSTRAINT provider_attempts_cost_currency_format
        CHECK (cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$'),
    CONSTRAINT provider_attempts_moderation_object
        CHECK (moderation_result IS NULL OR jsonb_typeof(moderation_result) = 'object'),
    CONSTRAINT provider_attempts_completion
        CHECK (completed_at IS NULL OR started_at IS NOT NULL)
);

CREATE UNIQUE INDEX provider_attempts_external_id_unique
    ON provider_attempts (provider, provider_request_id)
    WHERE provider_request_id IS NOT NULL;

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    card_draft_id UUID NOT NULL,
    revision_id UUID NOT NULL,
    generation_job_id UUID,
    provider_attempt_id UUID,
    asset_type VARCHAR(40) NOT NULL,
    generation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    storage_provider VARCHAR(40) NOT NULL DEFAULT 'local',
    storage_key VARCHAR(1024) NOT NULL UNIQUE,
    media_type VARCHAR(160) NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    width_pixels INTEGER CHECK (width_pixels > 0),
    height_pixels INTEGER CHECK (height_pixels > 0),
    duration_seconds NUMERIC(8, 3) CHECK (duration_seconds > 0),
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (id, user_id),
    FOREIGN KEY (card_draft_id, user_id)
        REFERENCES card_drafts(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (revision_id, user_id)
        REFERENCES card_draft_revisions(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (generation_job_id, user_id)
        REFERENCES generation_jobs(id, user_id) ON DELETE SET NULL (generation_job_id),
    FOREIGN KEY (provider_attempt_id, user_id)
        REFERENCES provider_attempts(id, user_id) ON DELETE SET NULL (provider_attempt_id),
    CONSTRAINT assets_type
        CHECK (asset_type IN ('upload', 'image', 'song', 'message', 'qr', 'print')),
    CONSTRAINT assets_generation_status
        CHECK (generation_status IN ('pending', 'generating', 'ready', 'failed')),
    CONSTRAINT assets_storage_provider CHECK (storage_provider IN ('local', 's3')),
    CONSTRAINT assets_content_hash_format CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT assets_moderation_status
        CHECK (moderation_status IN ('pending', 'passed', 'failed', 'not_required')),
    CONSTRAINT assets_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE card_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    card_draft_id UUID NOT NULL,
    song_asset_id UUID,
    qr_asset_id UUID,
    token_hash CHAR(64) NOT NULL UNIQUE,
    qr_payload_version SMALLINT NOT NULL DEFAULT 1 CHECK (qr_payload_version > 0),
    public_path VARCHAR(500) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (id, user_id),
    FOREIGN KEY (card_draft_id, user_id)
        REFERENCES card_drafts(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (song_asset_id, user_id)
        REFERENCES assets(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (qr_asset_id, user_id)
        REFERENCES assets(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT card_share_links_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT card_share_links_public_path CHECK (public_path LIKE '/%'),
    CONSTRAINT card_share_links_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

-- Orders, immutable order lines, payments, and payload-free webhook receipts.

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_number VARCHAR(40) NOT NULL UNIQUE,
    status VARCHAR(40) NOT NULL DEFAULT 'pending_payment',
    currency CHAR(3) NOT NULL,
    subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
    shipping_minor INTEGER NOT NULL DEFAULT 0 CHECK (shipping_minor >= 0),
    tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
    total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
    recipient_address JSONB,
    sender_address JSONB,
    idempotency_key VARCHAR(255) NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    placed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    CONSTRAINT orders_status CHECK (
        status IN (
            'pending_payment',
            'authorized',
            'paid',
            'fulfillment_pending',
            'submitted',
            'in_fulfillment',
            'shipped',
            'delivered',
            'payment_failed',
            'fulfillment_failed',
            'refunded',
            'canceled'
        )
    ),
    CONSTRAINT orders_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT orders_request_hash_format CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT orders_total_math
        CHECK (total_minor = subtotal_minor + shipping_minor + tax_minor),
    CONSTRAINT orders_recipient_address_object
        CHECK (recipient_address IS NULL OR jsonb_typeof(recipient_address) = 'object'),
    CONSTRAINT orders_sender_address_object
        CHECK (sender_address IS NULL OR jsonb_typeof(sender_address) = 'object')
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    card_draft_id UUID NOT NULL,
    card_entitlement_id UUID,
    price_offer_id UUID NOT NULL REFERENCES price_offers(id) ON DELETE RESTRICT,
    print_asset_id UUID,
    share_link_id UUID,
    product_type VARCHAR(40) NOT NULL DEFAULT 'physical_card',
    quantity SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
    total_amount_minor INTEGER NOT NULL CHECK (total_amount_minor >= 0),
    currency CHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (id, user_id),
    FOREIGN KEY (order_id, user_id)
        REFERENCES orders(id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (card_draft_id, user_id)
        REFERENCES card_drafts(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (card_entitlement_id, user_id)
        REFERENCES card_entitlements(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (print_asset_id, user_id)
        REFERENCES assets(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (share_link_id, user_id)
        REFERENCES card_share_links(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT order_items_product_type CHECK (product_type = 'physical_card'),
    CONSTRAINT order_items_total_math CHECK (total_amount_minor = unit_amount_minor * quantity),
    CONSTRAINT order_items_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TRIGGER order_items_are_immutable
BEFORE UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    provider VARCHAR(40) NOT NULL DEFAULT 'stripe',
    provider_customer_id VARCHAR(255),
    provider_payment_id VARCHAR(255),
    provider_payment_method_id VARCHAR(255),
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    currency CHAR(3) NOT NULL,
    authorized_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (authorized_amount_minor >= 0),
    captured_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (captured_amount_minor >= 0),
    refunded_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount_minor >= 0),
    authorization_expires_at TIMESTAMPTZ,
    idempotency_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    FOREIGN KEY (order_id, user_id)
        REFERENCES orders(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT payments_provider CHECK (provider IN ('stripe', 'mock')),
    CONSTRAINT payments_status CHECK (
        status IN (
            'pending',
            'requires_action',
            'authorized',
            'captured',
            'partially_refunded',
            'refunded',
            'failed',
            'canceled'
        )
    ),
    CONSTRAINT payments_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT payments_capture_not_above_authorization
        CHECK (captured_amount_minor <= authorized_amount_minor),
    CONSTRAINT payments_refund_not_above_capture
        CHECK (refunded_amount_minor <= captured_amount_minor)
);

CREATE UNIQUE INDEX payments_provider_payment_unique
    ON payments (provider, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(40) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(160) NOT NULL,
    payload_sha256 CHAR(64) NOT NULL,
    signature_verified_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'received',
    attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_error_category VARCHAR(80),
    received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (provider, provider_event_id),
    CONSTRAINT webhook_events_provider
        CHECK (provider IN ('stripe', 'scribeless')),
    CONSTRAINT webhook_events_payload_hash_format
        CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT webhook_events_status
        CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored'))
);

-- Fulfillment and shipment lifecycle. Payloads are represented by hashes rather
-- than copied PII-bearing provider requests.

CREATE TABLE fulfillment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    provider VARCHAR(40) NOT NULL,
    provider_job_id VARCHAR(255),
    status VARCHAR(40) NOT NULL DEFAULT 'queued',
    request_payload_sha256 CHAR(64) NOT NULL,
    response_payload_sha256 CHAR(64),
    attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    idempotency_key VARCHAR(255) NOT NULL,
    last_error_category VARCHAR(80),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    FOREIGN KEY (order_id, user_id)
        REFERENCES orders(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fulfillment_jobs_provider CHECK (provider IN ('scribeless', 'mock')),
    CONSTRAINT fulfillment_jobs_status CHECK (
        status IN (
            'queued',
            'submitting',
            'submitted',
            'accepted',
            'printing',
            'mailed',
            'delivered',
            'retryable_failed',
            'permanent_failed',
            'canceled'
        )
    ),
    CONSTRAINT fulfillment_jobs_request_hash_format
        CHECK (request_payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT fulfillment_jobs_response_hash_format
        CHECK (response_payload_sha256 IS NULL OR response_payload_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX fulfillment_jobs_provider_job_unique
    ON fulfillment_jobs (provider, provider_job_id)
    WHERE provider_job_id IS NOT NULL;

CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID NOT NULL,
    fulfillment_job_id UUID NOT NULL,
    provider VARCHAR(40) NOT NULL,
    provider_shipment_id VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'label_created',
    carrier VARCHAR(100),
    tracking_number VARCHAR(255),
    tracking_url VARCHAR(1000),
    estimated_delivery_date DATE,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (id, user_id),
    FOREIGN KEY (order_id, user_id)
        REFERENCES orders(id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (fulfillment_job_id, user_id)
        REFERENCES fulfillment_jobs(id, user_id) ON DELETE RESTRICT,
    CONSTRAINT shipments_status
        CHECK (status IN ('label_created', 'in_transit', 'delivered', 'exception', 'returned', 'canceled'))
);

CREATE UNIQUE INDEX shipments_provider_id_unique
    ON shipments (provider, provider_shipment_id)
    WHERE provider_shipment_id IS NOT NULL;

-- User notifications, security/business audit events, and neutral feature flags.

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID,
    channel VARCHAR(20) NOT NULL,
    template_key VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    provider VARCHAR(40),
    provider_message_id VARCHAR(255),
    idempotency_key VARCHAR(255) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    sent_at TIMESTAMPTZ,
    attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_error_category VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, idempotency_key),
    UNIQUE (id, user_id),
    FOREIGN KEY (order_id, user_id)
        REFERENCES orders(id, user_id) ON DELETE CASCADE,
    CONSTRAINT notifications_channel CHECK (channel IN ('email', 'in_app')),
    CONSTRAINT notifications_status CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'canceled'))
);

CREATE UNIQUE INDEX notifications_provider_message_unique
    ON notifications (provider, provider_message_id)
    WHERE provider_message_id IS NOT NULL;

CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subject_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(160) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    request_id VARCHAR(120),
    idempotency_key VARCHAR(255),
    outcome VARCHAR(20) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT audit_events_outcome CHECK (outcome IN ('succeeded', 'failed', 'denied')),
    CONSTRAINT audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TRIGGER audit_events_are_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_immutable_row_mutation();

CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key VARCHAR(160) NOT NULL,
    environment VARCHAR(40) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (flag_key, environment),
    CONSTRAINT feature_flags_environment CHECK (environment IN ('local', 'test', 'staging', 'production')),
    CONSTRAINT feature_flags_configuration_object CHECK (jsonb_typeof(configuration) = 'object')
);

-- Lifecycle and timestamp enforcement.

CREATE TRIGGER card_entitlements_initial_state
BEFORE INSERT ON card_entitlements
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('card_entitlement', 'status', 'available');

CREATE TRIGGER card_entitlements_state_transition
BEFORE UPDATE OF status ON card_entitlements
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('card_entitlement', 'status');

CREATE TRIGGER card_drafts_initial_state
BEFORE INSERT ON card_drafts
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('card_draft', 'status', 'draft');

CREATE TRIGGER card_drafts_state_transition
BEFORE UPDATE OF status ON card_drafts
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('card_draft', 'status');

CREATE TRIGGER uploads_initial_state
BEFORE INSERT ON uploads
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('upload', 'status', 'upload_pending');

CREATE TRIGGER uploads_state_transition
BEFORE UPDATE OF status ON uploads
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('upload', 'status');

CREATE TRIGGER generation_jobs_initial_state
BEFORE INSERT ON generation_jobs
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('generation_job', 'status', 'queued');

CREATE TRIGGER generation_jobs_state_transition
BEFORE UPDATE OF status ON generation_jobs
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('generation_job', 'status');

CREATE TRIGGER provider_attempts_initial_state
BEFORE INSERT ON provider_attempts
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('provider_attempt', 'status', 'pending');

CREATE TRIGGER provider_attempts_state_transition
BEFORE UPDATE OF status ON provider_attempts
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('provider_attempt', 'status');

CREATE TRIGGER assets_initial_state
BEFORE INSERT ON assets
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('asset', 'generation_status', 'pending');

CREATE TRIGGER assets_state_transition
BEFORE UPDATE OF generation_status ON assets
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('asset', 'generation_status');

CREATE TRIGGER orders_initial_state
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('order', 'status', 'pending_payment');

CREATE TRIGGER orders_state_transition
BEFORE UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('order', 'status');

CREATE TRIGGER payments_initial_state
BEFORE INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('payment', 'status', 'pending');

CREATE TRIGGER payments_state_transition
BEFORE UPDATE OF status ON payments
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('payment', 'status');

CREATE TRIGGER webhook_events_initial_state
BEFORE INSERT ON webhook_events
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('webhook_event', 'status', 'received');

CREATE TRIGGER webhook_events_state_transition
BEFORE UPDATE OF status ON webhook_events
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('webhook_event', 'status');

CREATE TRIGGER fulfillment_jobs_initial_state
BEFORE INSERT ON fulfillment_jobs
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('fulfillment_job', 'status', 'queued');

CREATE TRIGGER fulfillment_jobs_state_transition
BEFORE UPDATE OF status ON fulfillment_jobs
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('fulfillment_job', 'status');

CREATE TRIGGER shipments_initial_state
BEFORE INSERT ON shipments
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('shipment', 'status', 'label_created');

CREATE TRIGGER shipments_state_transition
BEFORE UPDATE OF status ON shipments
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('shipment', 'status');

CREATE TRIGGER notifications_initial_state
BEFORE INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION enforce_initial_lifecycle_state('notification', 'status', 'queued');

CREATE TRIGGER notifications_state_transition
BEFORE UPDATE OF status ON notifications
FOR EACH ROW EXECUTE FUNCTION enforce_lifecycle_transition('notification', 'status');

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users',
        'auth_identities',
        'user_sessions',
        'idempotency_records',
        'price_books',
        'price_offers',
        'card_entitlements',
        'card_drafts',
        'uploads',
        'generation_jobs',
        'provider_attempts',
        'assets',
        'card_share_links',
        'orders',
        'payments',
        'webhook_events',
        'fulfillment_jobs',
        'shipments',
        'notifications',
        'feature_flags'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I '
            || 'FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name,
            table_name
        );
    END LOOP;
END;
$$;

-- Ownership and operational query indexes. Composite foreign keys above prevent
-- cross-owner attachment even when a valid resource UUID is supplied.

CREATE INDEX auth_identities_user_id_idx ON auth_identities (user_id);
CREATE INDEX user_sessions_user_active_idx ON user_sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;
CREATE INDEX idempotency_records_user_created_idx ON idempotency_records (user_id, created_at DESC);
CREATE INDEX idempotency_records_expiry_idx ON idempotency_records (expires_at);
CREATE INDEX price_offers_book_active_idx ON price_offers (price_book_id, checkout_enabled, minimum_quantity, maximum_quantity);
CREATE INDEX credit_ledger_user_created_idx ON credit_ledger (user_id, created_at DESC);
CREATE INDEX credit_ledger_source_idx ON credit_ledger (source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX card_entitlements_user_status_idx ON card_entitlements (user_id, status, expires_at);
CREATE INDEX card_drafts_user_updated_idx ON card_drafts (user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX card_draft_revisions_draft_idx ON card_draft_revisions (draft_id, revision_number DESC);
CREATE INDEX uploads_user_draft_idx ON uploads (user_id, card_draft_id, created_at DESC);
CREATE INDEX uploads_expiry_idx ON uploads (expires_at) WHERE committed_at IS NULL;
CREATE INDEX generation_jobs_user_created_idx ON generation_jobs (user_id, created_at DESC);
CREATE INDEX generation_jobs_draft_idx ON generation_jobs (card_draft_id, created_at DESC);
CREATE INDEX generation_jobs_queue_idx ON generation_jobs (status, created_at) WHERE status IN ('queued', 'running');
CREATE INDEX provider_attempts_job_idx ON provider_attempts (generation_job_id, asset_type, attempt_number);
CREATE INDEX assets_user_draft_idx ON assets (user_id, card_draft_id, created_at DESC);
CREATE INDEX assets_job_idx ON assets (generation_job_id) WHERE generation_job_id IS NOT NULL;
CREATE INDEX card_share_links_draft_idx ON card_share_links (card_draft_id) WHERE revoked_at IS NULL;
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders (status, updated_at);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_draft_idx ON order_items (card_draft_id);
CREATE INDEX payments_user_created_idx ON payments (user_id, created_at DESC);
CREATE INDEX payments_order_idx ON payments (order_id, created_at DESC);
CREATE INDEX webhook_events_status_idx ON webhook_events (status, received_at);
CREATE INDEX fulfillment_jobs_user_order_idx ON fulfillment_jobs (user_id, order_id, created_at DESC);
CREATE INDEX fulfillment_jobs_queue_idx ON fulfillment_jobs (status, created_at)
    WHERE status IN ('queued', 'retryable_failed');
CREATE INDEX shipments_user_order_idx ON shipments (user_id, order_id);
CREATE INDEX notifications_user_status_idx ON notifications (user_id, status, scheduled_at);
CREATE INDEX audit_events_subject_time_idx ON audit_events (subject_user_id, occurred_at DESC);
CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX feature_flags_environment_idx ON feature_flags (environment, enabled);
