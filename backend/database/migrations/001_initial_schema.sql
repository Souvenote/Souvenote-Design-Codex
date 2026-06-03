CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Added the initial backend database folder structure and draft PostgreSQL migration for the Souvenote MVP schema.
-- NOTE: This migration is not ready to run yet. It still needs to be reviewed and tested locally against PostgreSQL before being used by anyone else.




-- users
-- Purpose: Stores each Souvenote user inside our app.
-- id: Souvenote's internal user ID.
-- cognito_user_id: Links the user to their AWS Cognito login account.
-- email: User's email address.
-- stripe_customer_id: Links the user to their Stripe customer profile.
-- created_at: When the user row was created.
-- updated_at: When the user row was last updated.
-- deleted_at: Soft delete timestamp, so we can hide/remove users without fully deleting the row.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cognito_user_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- credit_ledger
-- Purpose: Tracks every credit/token change for a user.
-- id: Unique ID for this ledger event.
-- user_id: The user whose credits changed.
-- event_type: What kind of credit event happened, like signup grant, generation deduction, or refund.
-- amount: Number of credits added or removed. Positive adds credits, negative spends credits.
-- source: Where the event came from, like signup, Stripe, generation, or provider failure.
-- idempotency_key: Prevents the same credit event from being recorded twice.
-- metadata: Extra event details, such as payment ID or generation job ID.
-- created_at: When the credit event happened.
CREATE TABLE credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    source VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- card_drafts
-- Purpose: Stores cards that users are creating or have saved as drafts.
-- id: Unique ID for the card draft.
-- user_id: The user who owns the draft.
-- occasion: The event for the card, like birthday or anniversary.
-- relationship: The recipient relationship, like friend, parent, or partner.
-- creative_brief: User answers and prompt details stored as JSON.
-- status: Current draft state, such as draft, generating, approved, or sent.
-- created_at: When the draft was created.
-- updated_at: When the draft was last changed.
-- deleted_at: Soft delete timestamp for removed drafts.
CREATE TABLE card_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    occasion VARCHAR(255),
    relationship VARCHAR(255),
    creative_brief JSONB,
    status VARCHAR(255) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- generation_jobs
-- Purpose: Tracks AI generation progress for image, song, and message assets.
-- id: Unique ID for the generation job.
-- user_id: The user who started the generation.
-- card_draft_id: The card draft this generation belongs to.
-- image_status: Current status of the image generation.
-- song_status: Current status of the song generation.
-- message_status: Current status of the inside message generation.
-- provider_mode: Whether generation uses mock mode or a real AI provider.
-- credits_charged: Number of credits charged for this generation job.
-- error_message: Stores failure details if generation fails.
-- created_at: When the job was created.
-- updated_at: When the job was last updated.
CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_draft_id UUID REFERENCES card_drafts(id) ON DELETE CASCADE,
    image_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    song_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    message_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    provider_mode VARCHAR(50) NOT NULL DEFAULT 'mock',
    credits_charged INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- assets
-- Purpose: Stores files and generated outputs connected to a card.
-- id: Unique ID for the asset.
-- user_id: The user who owns the asset.
-- card_draft_id: The card draft this asset belongs to.
-- generation_job_id: The AI generation job that created this asset.
-- asset_type: Type of asset, like image, song, message, upload, QR code, or print file.
-- s3_key: File path/key for the asset stored in S3.
-- moderation_state: Moderation result/status for uploaded or generated media.
-- approved_at: When the user approved this asset.
-- print_asset_key: Final print-ready file key.
-- qr_metadata: QR code details stored as JSON.
-- created_at: When the asset row was created.
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_draft_id UUID REFERENCES card_drafts(id) ON DELETE CASCADE,
    generation_job_id UUID REFERENCES generation_jobs(id) ON DELETE CASCADE,
    asset_type VARCHAR(255) NOT NULL,
    s3_key VARCHAR(255),
    moderation_state VARCHAR(255),
    approved_at TIMESTAMPTZ,
    print_asset_key VARCHAR(255),
    qr_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- orders
-- Purpose: Stores physical card orders and fulfillment information.
-- id: Unique ID for the order.
-- user_id: The user who placed the order.
-- card_draft_id: The card being ordered.
-- status: Current order state, like pending, paid, submitted, shipped, or failed.
-- scribeless_job_id: External Scribeless print/fulfillment job ID.
-- tracking_url: Shipment tracking link.
-- recipient_address: Recipient shipping address stored as JSON.
-- sender_address: Sender/return address stored as JSON.
-- qr_code_url: URL for the final QR code connected to the card/song.
-- created_at: When the order was created.
-- updated_at: When the order was last updated.
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_draft_id UUID REFERENCES card_drafts(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    scribeless_job_id VARCHAR(255),
    tracking_url VARCHAR(255),
    recipient_address JSONB,
    sender_address JSONB,
    qr_code_url VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- payments
-- Purpose: Stores payment records connected to Stripe checkout.
-- id: Unique ID for the payment record.
-- user_id: The user who made the payment.
-- stripe_payment_intent_id: Stripe's payment intent ID for tracking the transaction.
-- offer_code: Pricing offer used, like Try Risk-Free or Big Sender.
-- amount_cents: Payment amount in cents.
-- status: Payment status, such as pending, succeeded, failed, refunded, or released.
-- metadata: Extra Stripe/payment details stored as JSON.
-- created_at: When the payment record was created.
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255),
    offer_code VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- audit_logs
-- Purpose: Records important backend actions for debugging, tracking, and accountability.
-- id: Unique ID for the audit log entry.
-- user_id: User connected to the action, if there is one.
-- action: What happened, like credit_refunded, generation_failed, or order_submitted.
-- entity_type: Type of object affected, like user, order, asset, or generation_job.
-- entity_id: ID of the affected object.
-- metadata: Extra action details stored as JSON.
-- created_at: When the action happened.
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255),
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);