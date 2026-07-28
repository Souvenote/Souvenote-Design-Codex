-- Durable, idempotent transactional notification delivery and callback state.
-- Customer email stays on users; the outbox stores only safe template data.

CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    provider_mode VARCHAR(30),
    provider_message_id VARCHAR(255),
    last_error_code VARCHAR(100),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notification_outbox_event_type_check CHECK (
        event_type IN (
            'order_confirmation',
            'order_shipped',
            'order_delivered'
        )
    ),
    CONSTRAINT notification_outbox_template_data_check CHECK (
        jsonb_typeof(template_data) = 'object'
    ),
    CONSTRAINT notification_outbox_status_check CHECK (
        status IN (
            'pending',
            'processing',
            'accepted',
            'failed',
            'delivery_unknown'
        )
    ),
    CONSTRAINT notification_outbox_delivery_status_check CHECK (
        delivery_status IN (
            'pending',
            'processed',
            'deferred',
            'delivered',
            'bounced',
            'dropped'
        )
    ),
    CONSTRAINT notification_outbox_attempt_count_check CHECK (
        attempt_count >= 0
    ),
    CONSTRAINT notification_outbox_provider_mode_check CHECK (
        provider_mode IS NULL OR provider_mode IN ('mock', 'sendgrid')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_outbox_provider_message
    ON notification_outbox(provider_mode, provider_message_id)
    WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_outbox_dispatch_due
    ON notification_outbox(status, available_at, created_at)
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_notification_outbox_order
    ON notification_outbox(order_id, created_at);

CREATE TABLE IF NOT EXISTS notification_delivery_events (
    event_id VARCHAR(100) PRIMARY KEY,
    notification_id UUID NOT NULL
        REFERENCES notification_outbox(id) ON DELETE CASCADE,
    provider_message_id VARCHAR(255),
    event_type VARCHAR(30) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notification_delivery_events_type_check CHECK (
        event_type IN (
            'processed',
            'deferred',
            'delivered',
            'bounced',
            'dropped'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_events_notification
    ON notification_delivery_events(notification_id, occurred_at);
