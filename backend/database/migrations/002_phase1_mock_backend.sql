-- Phase 1 local mock backend additions.
-- These tables and columns keep the MVP flow fully local until S3, Stripe,
-- Scribeless, and real AI providers are connected.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_draft_id UUID NOT NULL REFERENCES card_drafts(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    mock_url VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'requested',
    attestation_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS selected_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS offer_code VARCHAR(255),
    ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 999,
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    ADD COLUMN IF NOT EXISTS checkout_session_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS provider_mode VARCHAR(50) NOT NULL DEFAULT 'mock',
    ADD COLUMN IF NOT EXISTS checkout_session_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS fulfillment_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_mode VARCHAR(50) NOT NULL DEFAULT 'mock',
    mock_fulfillment_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'fulfilled_mock',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estimated_delivery TEXT NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fulfillment_job_id UUID REFERENCES fulfillment_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_card_draft_id ON uploads(card_draft_id);
CREATE INDEX IF NOT EXISTS idx_uploads_storage_key ON uploads(storage_key);
CREATE INDEX IF NOT EXISTS idx_orders_selected_asset_id ON orders(selected_asset_id);
CREATE INDEX IF NOT EXISTS idx_orders_checkout_session_id ON orders(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_session_id ON payments(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_order_id ON fulfillment_jobs(order_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_jobs_user_id ON fulfillment_jobs(user_id);
