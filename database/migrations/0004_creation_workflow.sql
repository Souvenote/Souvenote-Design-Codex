-- Section 4: deterministic creation workflow, validated local uploads, and
-- durable draft approval. Earlier applied migrations remain immutable.

ALTER TABLE uploads
    ADD COLUMN content_idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX uploads_content_idempotency_key_unique
    ON uploads (user_id, content_idempotency_key)
    WHERE content_idempotency_key IS NOT NULL;

ALTER TABLE generation_jobs
    DROP CONSTRAINT generation_jobs_action_type,
    DROP CONSTRAINT generation_jobs_action_cost,
    ADD CONSTRAINT generation_jobs_action_type CHECK (
        action_type IN (
            'initial_image',
            'initial_image_song',
            'regenerate_image',
            'regenerate_song',
            'inside_message'
        )
    ),
    ADD CONSTRAINT generation_jobs_action_cost CHECK (
        (action_type = 'initial_image_song' AND credits_reserved = 2)
        OR (action_type IN ('initial_image', 'regenerate_image', 'regenerate_song') AND credits_reserved = 1)
        OR (action_type = 'inside_message' AND credits_reserved = 0)
    );

ALTER TABLE card_drafts
    ADD COLUMN approved_image_asset_id UUID,
    ADD COLUMN approved_song_asset_id UUID,
    ADD COLUMN approved_message_asset_id UUID,
    ADD COLUMN approval_idempotency_key VARCHAR(255),
    ADD COLUMN approval_request_hash CHAR(64),
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD CONSTRAINT card_drafts_approval_request_hash CHECK (
        approval_request_hash IS NULL OR approval_request_hash ~ '^[0-9a-f]{64}$'
    ),
    ADD CONSTRAINT card_drafts_approval_state CHECK (
        (
            status IN ('approved', 'ordered', 'sent')
            AND approved_image_asset_id IS NOT NULL
            AND approved_message_asset_id IS NOT NULL
            AND approval_idempotency_key IS NOT NULL
            AND approval_request_hash IS NOT NULL
            AND approved_at IS NOT NULL
        )
        OR status NOT IN ('approved', 'ordered', 'sent')
    );

ALTER TABLE card_drafts
    ADD CONSTRAINT card_drafts_approved_image_owner
        FOREIGN KEY (approved_image_asset_id, user_id)
        REFERENCES assets(id, user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT card_drafts_approved_song_owner
        FOREIGN KEY (approved_song_asset_id, user_id)
        REFERENCES assets(id, user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT card_drafts_approved_message_owner
        FOREIGN KEY (approved_message_asset_id, user_id)
        REFERENCES assets(id, user_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX card_drafts_approval_idempotency_key_unique
    ON card_drafts (user_id, approval_idempotency_key)
    WHERE approval_idempotency_key IS NOT NULL;

INSERT INTO feature_flags (flag_key, environment, enabled, configuration)
VALUES
    (
        'creation.deterministic_mock.section_4',
        'local',
        TRUE,
        '{"external_calls":false,"storage_provider":"local"}'::jsonb
    ),
    (
        'creation.deterministic_mock.section_4',
        'test',
        TRUE,
        '{"external_calls":false,"storage_provider":"local"}'::jsonb
    );
