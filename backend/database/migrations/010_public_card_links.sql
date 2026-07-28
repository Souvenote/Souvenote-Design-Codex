-- Stable tokenized public keepsake links for printed song QR codes.

CREATE TABLE IF NOT EXISTS public_card_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    access_count BIGINT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT public_card_links_status_check CHECK (
        status IN ('active', 'revoked')
    ),
    CONSTRAINT public_card_links_token_hash_check CHECK (
        token_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT public_card_links_access_count_check CHECK (access_count >= 0),
    CONSTRAINT public_card_links_revocation_check CHECK (
        (status = 'active' AND revoked_at IS NULL)
        OR (status = 'revoked' AND revoked_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_public_card_links_active_hash
    ON public_card_links(token_hash)
    WHERE status = 'active';
