import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const backendRoot = resolve(__dirname, '../../..');
const runbook = readFileSync(
  resolve(backendRoot, 'docs/operations-runbook.md'),
  'utf8',
).replace(/\r\n/g, '\n');
const schema = [
  '001_initial_schema.sql',
  '002_phase1_mock_backend.sql',
  '003_account_profile_payments.sql',
  '004_s3_upload_pipeline.sql',
  '005_generation_job_lifecycle.sql',
  '006_asset_moderation_lifecycle.sql',
  '007_server_authoritative_order_pricing.sql',
  '008_stripe_checkout_lifecycle.sql',
  '009_scribeless_fulfillment_lifecycle.sql',
  '010_public_card_links.sql',
  '011_transactional_notifications.sql',
  '012_canadian_pricing_and_credit_packs.sql',
  '013_card_entitlement_ledger.sql',
]
  .map((filename) =>
    readFileSync(
      resolve(backendRoot, `database/migrations/${filename}`),
      'utf8',
    ),
  )
  .join('\n');

describe('production operations runbook', () => {
  it('contains one bounded read-only SQL evidence bundle', () => {
    const sqlBlocks = [...runbook.matchAll(/```sql\s+([\s\S]*?)```/g)];
    expect(sqlBlocks).toHaveLength(1);

    const sql = sqlBlocks[0]?.[1] ?? '';
    expect(sql).toContain('BEGIN TRANSACTION READ ONLY;');
    expect(sql).toContain("SET LOCAL statement_timeout = '5s';");
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(sql).not.toMatch(/\bSELECT\s+\*/i);
    expect(sql).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|COPY)\b/i,
    );
  });

  it('does not select customer content, credentials, signed URLs, or raw provider diagnostics', () => {
    const sql = [...runbook.matchAll(/```sql\s+([\s\S]*?)```/g)][0]?.[1] ?? '';
    expect(sql).not.toMatch(
      /\b(email|phone|recipient_address|recipient_addresses|sender_address|creative_brief|s3_key|qr_metadata|request_payload|response_payload|template_data|raw_payload|token_hash)\b/i,
    );
    expect(sql).not.toMatch(/audit_logs\.metadata/i);
    expect(sql).toMatch(/error_message IS NOT NULL AS has_error/g);
    expect(sql).toContain('status_reason IS NOT NULL AS has_status_reason');
    expect(sql).toContain(
      'jsonb_array_length(fulfillment_jobs.provider_recipient_ids)',
    );
  });

  it.each([
    'orders',
    'payments',
    'stripe_webhook_events',
    'fulfillment_jobs',
    'generation_jobs',
    'credit_ledger',
    'asset_moderation_jobs',
    'assets',
    'public_card_links',
    'notification_outbox',
    'notification_delivery_events',
    'delivery_unknown',
    'audit_logs',
    'amount_captured_cents',
    'checkout_session_id',
    'fulfillment_job_id',
    'fulfillment_status_updated_at',
    'provider_recipient_ids',
    'overall_status',
    'refunded_at',
    'moderation_state',
    'access_count',
    'submission_unknown',
    'fulfillment_on_hold',
  ])('grounds the operational identifier %s in the schema', (identifier) => {
    expect(schema).toContain(identifier);
  });

  it('states the no-blind-retry and no-ad-hoc-write invariants', () => {
    expect(runbook).toContain(
      'Never retry an ambiguous Stripe capture or Scribeless submission',
    );
    expect(runbook).toMatch(
      /Never change order, payment, credit, moderation, public-link, notification, or\s+fulfillment rows with ad hoc SQL\./,
    );
    expect(runbook).toContain(
      '`PUBLIC_LINK_HMAC_SECRET` is required to deterministically create/reconfirm a',
    );
  });

  it('holds ambiguous notification delivery and deduplicates signed callbacks', () => {
    expect(runbook).toContain(
      '`notification_delivery_events.event_id`\n  is the `sg_event_id` dedupe key',
    );
    expect(runbook).toContain(
      '`delivery_unknown` means a request may have reached SendGrid',
    );
    expect(runbook).toMatch(
      /A\s+network\/timeout ambiguity and a provider-accepted\/local-write ambiguity never\s+retry automatically/,
    );
  });

  it('documents the group-protected evidence endpoint without claiming mutation powers', () => {
    expect(runbook).toContain('GET /api/operations/orders/:orderId/evidence');
    expect(runbook).toContain('OPERATIONS_READER_GROUPS');
    expect(runbook).toContain(
      'No internal reconciliation or\ncorrection API exists.',
    );
    expect(runbook).toMatch(
      /It has no state-correction, reconciliation,\s+retry, refund, capture, fulfillment, moderation-decision, impersonation, or\s+arbitrary-query capability\./,
    );
  });

  it('documents PII-safe telemetry, aggregate alerts, and production providers', () => {
    expect(runbook).toContain('provider_call_metric');
    expect(runbook).toContain('ANALYTICS_PROVIDER_MODE=posthog');
    expect(runbook).toContain('ERROR_REPORTING_MODE=sentry');
    expect(runbook).toContain('payment_reconciliation_backlog');
    expect(runbook).toContain('moderation_queue_stale');
    expect(runbook).toContain('generation_refund_spike');
    expect(runbook).toContain('fulfillment_hold_backlog');
    expect(runbook).toContain('ANALYTICS_ID_HASH_SECRET');
    expect(runbook).toMatch(
      /Do not add email, names, addresses, user\/order\/job IDs, free text, card\s+content, prompts, upload references, provider IDs, URLs, or token values/,
    );
  });
});
