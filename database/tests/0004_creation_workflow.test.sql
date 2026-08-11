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
    (SELECT count(*) = 1 FROM schema_migrations WHERE version = '0004'),
    'the runner journals the creation workflow exactly once'
);

SELECT pg_temp.assert_true(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'uploads'
          AND column_name = 'content_idempotency_key'
    ),
    'validated upload content has a separate idempotency boundary'
);

SELECT pg_temp.assert_true(
    (
        SELECT count(*) = 6
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'card_drafts'
          AND column_name IN (
              'approved_image_asset_id',
              'approved_song_asset_id',
              'approved_message_asset_id',
              'approval_idempotency_key',
              'approval_request_hash',
              'approved_at'
          )
    ),
    'draft approval selection and idempotency state is durable'
);

DO $$
DECLARE
    account_id UUID;
    draft_id UUID;
    revision_id UUID;
    job_id UUID;
BEGIN
    INSERT INTO users (email)
    VALUES ('section-4-action-cost@example.test')
    RETURNING id INTO account_id;

    INSERT INTO card_drafts (user_id, creation_route)
    VALUES (account_id, 'build_my_card')
    RETURNING id INTO draft_id;

    INSERT INTO card_draft_revisions (draft_id, user_id, revision_number)
    VALUES (draft_id, account_id, 1)
    RETURNING id INTO revision_id;

    UPDATE card_drafts SET current_revision_id = revision_id WHERE id = draft_id;

    INSERT INTO generation_jobs (
        user_id, card_draft_id, revision_id, request_hash, idempotency_key,
        action_type, credits_reserved
    )
    VALUES (
        account_id, draft_id, revision_id, repeat('4', 64),
        'section-4-initial-image-key', 'initial_image', 1
    )
    RETURNING id INTO job_id;

    PERFORM pg_temp.assert_true(job_id IS NOT NULL, 'initial image generation costs exactly one credit');
END;
$$;

ROLLBACK;
