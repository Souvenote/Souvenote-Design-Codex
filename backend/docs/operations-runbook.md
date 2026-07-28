# Souvenote Production Operations Runbook

This runbook covers incident triage, ambiguous provider outcomes, credential
rotation, and credentialed staging checks for the MVP backend. It reflects the
state machines in migrations `001` through `012` and the current NestJS
services. It does not authorize manual database corrections or customer
impersonation.

## Non-negotiable safety rules

- Use UTC in every incident note and provider search.
- Record environment, request ID, order/job ID, provider, first-seen time, and
  impact. Do not record a public QR token, Cognito token, signed S3 URL, card or
  message content, email, postal address, phone number, or payment instrument.
- Search structured logs by the exact `requestId`. Do not search by customer
  content or copy raw request/response bodies into an incident system.
- Run database diagnostics in a read-only transaction with a short statement
  timeout. Never use `SELECT *` against customer-content tables.
- Never change order, payment, credit, moderation, public-link, notification, or
  fulfillment rows with ad hoc SQL. Recovery must use an authorized, tested,
  idempotent API or a reviewed migration/tool that writes an `audit_logs` entry.
- Never retry an ambiguous Stripe capture or Scribeless submission until the
  provider outcome is known. A duplicate payment or physical card is more
  damaging than a deliberate hold.
- Never paste a secret into a shell history, ticket, log, source file, database,
  or chat. Secret-manager version identifiers are safe; secret values are not.

## Severity and ownership

| Severity | Examples | Immediate action |
| --- | --- | --- |
| SEV-0 | Suspected secret/data exposure, unauthorized asset access, duplicate charges, or duplicate physical mail in progress | Disable the affected provider path, preserve evidence, and page security plus engineering immediately. Do not delete logs or records. |
| SEV-1 | Checkout/webhook outage, paid orders blocked, widespread generation refunds, fulfillment submissions held, or printed-link outage | Stop new affected operations when possible, assign an incident lead, and reconcile provider state before recovery. |
| SEV-2 | One order/job stuck, moderation backlog, or isolated provider failure without duplicate/exposure risk | Keep the durable hold/failure state, gather the evidence bundle, and escalate during the support window. |

The incident lead owns the timeline and decision log. The provider operator may
inspect the provider dashboard but must not retry a mutation independently. An
engineer owns any recovery change. A moderator may use only the existing
moderator-protected decision API.

## First ten minutes

1. Capture the support code (`X-Request-ID`), environment, UTC timestamp,
   affected route category, and stable order/job ID. If no support code exists,
   record only a narrow UTC window.
2. Check process and dependency health independently:

   ```powershell
   Invoke-WebRequest -UseBasicParsing https://api.example.com/api/health/live
   Invoke-WebRequest -UseBasicParsing https://api.example.com/api/health/ready
   ```

   `live=200, ready=503` means the process is alive but PostgreSQL is not ready;
   do not restart healthy application instances repeatedly. `live` failure is
   an application/runtime incident.
3. Search the JSON application logs for the exact request ID. The safe event
   contains only method, matched route template, status, duration, and request
   ID. A successful health probe is intentionally not logged.
4. Call `GET /api/operations/orders/:orderId/evidence` with a short-lived token
   for an exact `OPERATIONS_READER_GROUPS` member. If the application API is
   unavailable or independent schema evidence is required, run the SQL fallback
   below using a least-privilege operations database role.
5. Compare local state with the provider dashboard using provider IDs and UTC
   timestamps. Never use a recipient address or card content as the search key.
6. Choose the provider-specific branch in this runbook. If state is ambiguous,
   keep it on hold and escalate; uncertainty is not permission to retry.

## Read-only order evidence bundle

The preferred application path is
`GET /api/operations/orders/:orderId/evidence`. It runs the same categories of
explicit reads in a PostgreSQL read-only transaction with a five-second local
statement timeout, maps only approved fields, and caps each collection. A
`truncated=true` section means the cap was reached; preserve the response and
escalate instead of broadening the API or querying customer-content fields.
Responses are `private, no-store` and require the separate operations-reader
Cognito group. Moderator access alone is insufficient.

The endpoint is evidence-only. It has no state-correction, reconciliation,
retry, refund, capture, fulfillment, moderation-decision, impersonation, or
arbitrary-query capability.

### Direct database fallback

Replace the all-zero UUID with the affected order ID. These queries omit
addresses, message/card content, storage keys, signed URLs, provider response
payloads, notification template/callback content, error text, metadata, and
token hashes.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    orders.id,
    orders.status,
    orders.offer_code,
    orders.quantity,
    orders.amount_cents,
    orders.currency,
    orders.payment_id,
    orders.fulfillment_job_id,
    orders.created_at,
    orders.updated_at,
    orders.fulfillment_status_updated_at
FROM orders
JOIN incident ON incident.order_id = orders.id;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    payments.id,
    payments.order_id,
    payments.provider_mode,
    payments.status,
    payments.capture_method,
    payments.attempt_number,
    payments.idempotency_key,
    payments.checkout_session_id,
    payments.stripe_payment_intent_id,
    payments.amount_cents,
    payments.amount_captured_cents,
    payments.currency,
    payments.finalization_action,
    payments.decision_due_at,
    payments.finalization_claimed_at,
    payments.expires_at,
    payments.created_at,
    payments.updated_at
FROM payments
JOIN incident ON incident.order_id = payments.order_id
ORDER BY payments.attempt_number;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
), provider_objects AS (
    SELECT checkout_session_id AS object_id
    FROM payments JOIN incident USING (order_id)
    WHERE checkout_session_id IS NOT NULL
    UNION
    SELECT stripe_payment_intent_id
    FROM payments JOIN incident USING (order_id)
    WHERE stripe_payment_intent_id IS NOT NULL
)
SELECT
    stripe_webhook_events.event_id,
    stripe_webhook_events.event_type,
    stripe_webhook_events.object_id,
    stripe_webhook_events.livemode,
    stripe_webhook_events.status,
    stripe_webhook_events.attempt_count,
    stripe_webhook_events.error_message IS NOT NULL AS has_error,
    stripe_webhook_events.processed_at,
    stripe_webhook_events.created_at,
    stripe_webhook_events.updated_at
FROM stripe_webhook_events
JOIN provider_objects USING (object_id)
ORDER BY stripe_webhook_events.created_at;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    fulfillment_jobs.id,
    fulfillment_jobs.order_id,
    fulfillment_jobs.provider_mode,
    fulfillment_jobs.provider_fulfillment_id,
    fulfillment_jobs.provider_campaign_id,
    fulfillment_jobs.provider_status,
    fulfillment_jobs.status,
    fulfillment_jobs.attempt_number,
    fulfillment_jobs.idempotency_key,
    jsonb_array_length(fulfillment_jobs.provider_recipient_ids) AS recipient_id_count,
    fulfillment_jobs.status_reason IS NOT NULL AS has_status_reason,
    fulfillment_jobs.submitted_at,
    fulfillment_jobs.last_synced_at,
    fulfillment_jobs.completed_at,
    fulfillment_jobs.failed_at,
    fulfillment_jobs.created_at,
    fulfillment_jobs.updated_at
FROM fulfillment_jobs
JOIN incident ON incident.order_id = fulfillment_jobs.order_id
ORDER BY fulfillment_jobs.attempt_number;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    generation_jobs.id,
    generation_jobs.provider_mode,
    generation_jobs.overall_status,
    generation_jobs.image_status,
    generation_jobs.song_status,
    generation_jobs.message_status,
    generation_jobs.credits_charged,
    generation_jobs.error_message IS NOT NULL AS has_error,
    generation_jobs.started_at,
    generation_jobs.completed_at,
    generation_jobs.failed_at,
    generation_jobs.refunded_at,
    generation_jobs.created_at,
    generation_jobs.updated_at
FROM generation_jobs
JOIN orders ON orders.card_draft_id = generation_jobs.card_draft_id
JOIN incident ON incident.order_id = orders.id
ORDER BY generation_jobs.created_at;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    credit_ledger.id,
    credit_ledger.event_type,
    credit_ledger.amount,
    credit_ledger.source,
    credit_ledger.idempotency_key,
    credit_ledger.created_at
FROM credit_ledger
JOIN generation_jobs ON credit_ledger.idempotency_key IN (
    'generation:' || generation_jobs.user_id::text || ':' || generation_jobs.idempotency_key || ':deduct',
    'generation:' || generation_jobs.user_id::text || ':' || generation_jobs.idempotency_key || ':refund'
)
JOIN orders ON orders.card_draft_id = generation_jobs.card_draft_id
JOIN incident ON incident.order_id = orders.id
ORDER BY credit_ledger.created_at;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    asset_moderation_jobs.id,
    asset_moderation_jobs.asset_id,
    assets.asset_type,
    assets.moderation_state,
    asset_moderation_jobs.provider_mode,
    asset_moderation_jobs.status,
    asset_moderation_jobs.attempt_number,
    asset_moderation_jobs.reviewed_by,
    asset_moderation_jobs.started_at,
    asset_moderation_jobs.completed_at,
    asset_moderation_jobs.created_at,
    asset_moderation_jobs.updated_at
FROM asset_moderation_jobs
JOIN assets ON assets.id = asset_moderation_jobs.asset_id
JOIN orders ON orders.card_draft_id = assets.card_draft_id
JOIN incident ON incident.order_id = orders.id
ORDER BY asset_moderation_jobs.created_at;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    notification_outbox.id,
    notification_outbox.order_id,
    notification_outbox.event_type,
    notification_outbox.status,
    notification_outbox.delivery_status,
    notification_outbox.attempt_count,
    notification_outbox.available_at,
    notification_outbox.locked_at,
    notification_outbox.provider_mode,
    notification_outbox.provider_message_id,
    notification_outbox.last_error_code,
    notification_outbox.accepted_at,
    notification_outbox.created_at,
    notification_outbox.updated_at
FROM notification_outbox
JOIN incident ON incident.order_id = notification_outbox.order_id
ORDER BY notification_outbox.created_at;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    notification_delivery_events.event_id,
    notification_delivery_events.notification_id,
    notification_delivery_events.provider_message_id,
    notification_delivery_events.event_type,
    notification_delivery_events.occurred_at,
    notification_delivery_events.created_at
FROM notification_delivery_events
JOIN notification_outbox
  ON notification_outbox.id = notification_delivery_events.notification_id
JOIN incident ON incident.order_id = notification_outbox.order_id
ORDER BY notification_delivery_events.occurred_at;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    public_card_links.id,
    public_card_links.order_id,
    public_card_links.status,
    public_card_links.access_count,
    public_card_links.last_accessed_at,
    public_card_links.activated_at,
    public_card_links.revoked_at,
    public_card_links.created_at,
    public_card_links.updated_at
FROM public_card_links
JOIN incident ON incident.order_id = public_card_links.order_id;

WITH incident(order_id) AS (
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid)
)
SELECT
    audit_logs.id,
    audit_logs.action,
    audit_logs.entity_type,
    audit_logs.entity_id,
    audit_logs.created_at
FROM audit_logs
JOIN incident ON incident.order_id = audit_logs.entity_id
ORDER BY audit_logs.created_at;

COMMIT;
```

If a query fails because a migration or column is missing, stop. The target
environment is not on the expected schema and must not receive remediation
writes until migrations `001` through `012` are reconciled.

## Scribeless ambiguity and fulfillment holds

### `submission_unknown`

The backend sets `fulfillment_jobs.status=submission_unknown`, the order to
`fulfillment_on_hold`, and records `fulfillment_submission_unknown` when a
Scribeless submission times out or returns an acceptance response that cannot
be reconciled safely. The active-job uniqueness constraint and service logic
block another submission.

1. Do not call the submit endpoint again. Do not mark the job `failed` with SQL.
2. Confirm the local order ID, attempt number, idempotency key, campaign ID,
   submission time, and expected quantity from the evidence bundle.
3. In Scribeless, inspect recipient records for the configured campaign and the
   exact UTC window. Match the custom `externalId` values
   `<order-id>:1` through `<order-id>:<quantity>`. Do not match by address.
4. Classify the result:

   - Exactly the expected unique recipients exist: treat the submission as
     accepted and do not resend. Capture provider recipient IDs/statuses in the
     restricted incident record and escalate for an audited reconciliation
     tool/change. The current customer API intentionally cannot attach missing
     provider IDs to an unknown submission.
   - No recipients exist and Scribeless confirms in writing that the request
     was not accepted: keep the hold until engineering provides an audited
     release/retry operation. Do not turn the row into `failed` manually.
   - A partial set exists, duplicates exist, or Scribeless cannot confirm the
     outcome: keep the hold, raise SEV-1, and have Scribeless suppress duplicates
     before any Souvenote recovery is designed.

5. Close only when provider recipient count/status, local order/fulfillment
   state, and the audit trail agree. Add the missing operator reconciliation
   endpoint before attempting routine production resolution of this state.

### Known provider IDs and `on_hold`

When provider recipient IDs are already stored, the normal refresh path polls
Scribeless and applies monotonic `submitted -> printing -> shipped -> delivered`
progress, or a hold/failure. The authenticated order owner may request the
documented refresh endpoint. Operations must not impersonate the owner. Use the
read-only operations evidence endpoint and provider dashboard for evidence,
then escalate any required local recovery. No internal reconciliation or
correction API exists.

Never regress a delivered/shipped state or create a second fulfillment attempt
by SQL. `status_reason`, `request_payload`, and `response_payload` may contain
restricted provider diagnostics; inspect them only in the production console
when necessary and do not copy them into a general ticket.

## Stripe payment and webhook reconciliation

1. Match the local `checkout_session_id` and `stripe_payment_intent_id` to the
   Stripe dashboard in the same livemode/testmode environment.
2. Compare amount, currency, capture state, amount received/capturable, and
   timestamps with the immutable local order total. Do not copy customer or
   payment-method details.
3. Inspect `stripe_webhook_events`. `processed` means the signed event was
   applied atomically; `ignored` means the event type was deliberately not part
   of the state machine. A higher `attempt_count` is expected after Stripe
   redelivery and does not repeat the payment/order mutation.
4. If Stripe shows a handled event that is absent locally, use Stripe's own
   webhook redelivery for that exact event after fixing delivery/configuration.
   The event ID primary key makes redelivery idempotent. Never manufacture a
   webhook body or edit the event table.
5. Before retrying Checkout, prove the previous PaymentIntent is failed,
   canceled, or expired. Never create a new attempt for `authorized` or
   `succeeded`, and never invoke capture/cancel until the provider state and the
   frozen Try Risk-Free finalization action agree.
6. `STRIPE_EXPECT_LIVEMODE` must match the provider event. A mismatch is a
   configuration incident, not a reason to bypass signature or mode checks.

Escalate immediately if provider and local captured amounts differ, an order is
paid without a succeeded/authorized payment, a succeeded payment lacks an order
transition, or the same order has more than one provider charge.

## SendGrid delivery ambiguity and callbacks

- `notification_outbox.status=accepted` means SendGrid returned HTTP `202`; it
  does not prove inbox delivery. Use `delivery_status` and the signed event rows
  to distinguish processed, deferred, delivered, bounced, or dropped mail.
- SendGrid may redeliver callback events. `notification_delivery_events.event_id`
  is the `sg_event_id` dedupe key. Never manufacture a callback, bypass ECDSA
  verification, or copy callback email/reason/URL/user-agent into an incident.
- `delivery_unknown` means a request may have reached SendGrid but local
  acceptance could not be proven, or a worker claim went stale. Do not reset it
  to `pending` or resend by SQL. Compare the notification ID, provider message
  ID when present, event IDs, and exact UTC window with SendGrid Email Activity;
  escalate for an audited reconciliation tool if they disagree.
- Explicit rejected requests can retry with the bounded worker policy. A
  network/timeout ambiguity and a provider-accepted/local-write ambiguity never
  retry automatically because SendGrid Mail Send has no Souvenote-controlled
  provider idempotency key.
- The webhook intentionally ignores open, click, URL, and user-agent engagement
  events. A bounce/drop writes a PII-safe audit event; it does not expose a
  customer email or provider reason through the operations API.

## Generation credits and moderation

- A generation job may be `pending`, `running`, `ready`, `failed`, `refunded`,
  or `canceled`. Provider failure/timeout uses a deterministic refund ledger key
  and cannot grant the same refund twice.
- For a charged failed job, confirm exactly one negative
  `generation_deduction` and, when eligible, one equal positive
  `generation_refund`. Do not infer the balance from UI state and do not insert a
  credit row manually.
- `overall_status=refunded` without its ledger refund, or a ledger refund while
  the job remains `running`, requires engineering reconciliation. Preserve both
  idempotency keys.
- Real upload/image/song assets remain unusable while moderation is `pending`.
  Only configured Cognito reviewer groups may list the queue or record a final
  decision. Never approve directly in PostgreSQL and never paste signed review
  URLs into an incident.
- A mistaken final moderation decision is an incident. The current API does not
  reverse completed decisions; add an audited correction workflow instead of
  changing the asset/job rows.

## Printed public-link incidents

- Never ask a customer to send the full QR URL or token in a general support
  channel. Treat it as a bearer capability. Use the order ID and the safe public
  link fields in the evidence bundle.
- `active` plus an allowed fulfillment order state is required. Unknown,
  malformed, revoked, unpaid, or media-incomplete links deliberately return the
  same `404` response.
- Do not compare, export, or log `token_hash`, and do not create a replacement
  token manually. Existing printed links resolve by their stored token hash.
- `PUBLIC_LINK_HMAC_SECRET` is required to deterministically create/reconfirm a
  token for an order. Changing it causes existing-order fulfillment/reprint
  attempts to fail closed instead of replacing the printed token.

## Telemetry and operational alerts

Production requires `ANALYTICS_PROVIDER_MODE=posthog` and
`ERROR_REPORTING_MODE=sentry`. The application fails startup rather than
silently disabling either stream. `OPERATIONAL_ALERTS_ENABLED` defaults on in
production and off elsewhere.

The following telemetry is intentionally safe to inspect in the normal
operations console:

- `provider_call_metric` contains only provider, fixed operation, outcome, and
  duration in milliseconds. `unknown` means the network outcome could not be
  proven; it is not permission to retry.
- Sentry backend issues contain a synthetic error code, scrubbed stack frames,
  request ID, matched route template, status code, and fixed provider tags.
  Automatic request capture is disabled and request/user/context/extra/
  breadcrumb/module/transaction fields are removed before send.
- PostHog contains only the five documented HMAC-pseudonymous funnel events.
  Do not add email, names, addresses, user/order/job IDs, free text, card
  content, prompts, upload references, provider IDs, URLs, or token values as
  event properties.

The alert worker evaluates aggregate database counts at a bounded interval:

| Alert | Default trigger | First response |
| --- | --- | --- |
| `payment_reconciliation_backlog` | One Stripe checkout/create state or signed webhook left processing past 15 minutes, or an authorization unchanged for 144 hours | Compare payment, order, and signed event state with Stripe. Do not start another checkout or capture until the prior outcome is proven. The authorization age is separate from Checkout Session expiry and must remain longer than the approved Try Risk-Free decision window. |
| `moderation_queue_stale` | Ten pending/running jobs older than 60 minutes | Confirm reviewer coverage and queue age. Do not auto-approve or bulk-edit assets. |
| `generation_refund_spike` | Five refunds in the last 15 minutes | Check Fal/S3 provider metrics and ledger/job agreement. Do not disable the idempotent refund path. |
| `fulfillment_hold_backlog` | One `on_hold`, `submission_unknown`, or failed fulfillment | Follow the Scribeless ambiguity branch and do not resubmit. |

An alert repeats no more often than `OPERATIONAL_ALERT_REPEAT_MS` while it
remains active. Falling below threshold re-arms it so a later recurrence alerts
immediately. Treat an alert as evidence to investigate, not as proof that a
provider mutation should be retried. If telemetry delivery itself is
unavailable, preserve the local structured logs and restore the integration;
never route customer payloads through an alternate debugging channel.

Changing `ANALYTICS_ID_HASH_SECRET` intentionally changes pseudonymous identity
continuity and deterministic event UUIDs. It is not an ordinary rotation:
freeze the change, document its analytics impact, and obtain product/security
approval. Never print the value while comparing secret-manager versions.

## Credential rotation procedure

For every rotatable provider credential:

1. Open a change record containing only provider, environment, secret-manager
   version IDs, owner, UTC window, validation plan, and rollback plan.
2. Create the new credential without revoking the old one when the provider
   supports overlap. Apply least privilege and the correct test/live scope.
3. Store it in the deployment secret manager. Never write a real value to
   `.env`, `.env.example`, a command line, or the repository.
4. Deploy a canary, check liveness/readiness, run the non-destructive provider
   validation below, and inspect PII-safe logs.
5. Roll out all instances. Allow in-flight requests and old signed deliveries
   to drain for the provider's documented window.
6. Revoke the old credential, prove the application still works, and record the
   revocation time/version ID. If validation fails, restore the prior secret
   version before it is revoked.

| Credential | Overlap and proof | Special rule |
| --- | --- | --- |
| `STRIPE_WEBHOOK_SECRETS` / `STRIPE_WEBHOOK_SECRET` | Configure at most two distinct `whsec_` values, deliver signed test events through both old/new paths, and confirm `stripe_webhook_events.status=processed`. Remove the old value after rollout. | Signature verification always uses the raw body. Never weaken `STRIPE_EXPECT_LIVEMODE`. More than two values makes webhook handling fail closed. |
| `STRIPE_SECRET_KEY` | Deploy the new server key, create/retrieve a test-mode Checkout Session in staging, verify webhook reconciliation, then revoke the old key. | Do not run a live charge merely to test rotation. Keep test/live keys isolated. |
| `FAL_KEY` | Validate a bounded staging queue request and private S3 import before revoking the old key. | Confirm byte/MIME/hostname enforcement and eligible refund behavior; do not log provider result URLs. |
| `SCRIBELESS_API_KEY` | Validate campaign read access in staging/pending mode and verify configured variable names/sender address before revocation. | A rotation test must not mail a real recipient. Never use a submission mutation as a health check. |
| AWS workload identity | Prefer short-lived role credentials and rotate at the IAM platform, not with static repository variables. Prove S3 POST, HEAD/GET signing, and least-privilege prefixes. | Retain decrypt access to the prior KMS key until old objects are migrated or intentionally retired. Changing the key affects new encryption, not existing object readability. |
| Cognito signing keys | Cognito rotates JWKS keys; the verifier fetches an unknown `kid` while cached old keys continue validating unexpired tokens. | User pool/client ID changes are identity migrations, not ordinary secret rotations, and require explicit session/audience planning. |
| `PUBLIC_LINK_HMAC_SECRET` | No in-place rotation is supported. Keep the exact 32-byte value backed up in a restricted, versioned secret manager and test restoration by secret version ID, never by printing it. | If compromised, freeze new song-bearing fulfillment and design a versioned-key migration. Existing printed links use stored token hashes; do not replace or orphan them ad hoc. |
| `SENDGRID_API_KEY` | Create a least-privilege replacement, canary one staging dynamic-template send, prove the signed delivery callback, then revoke the old key. | Never use a production customer address for rotation. The event-webhook public key is verification material, not the API secret; changing webhook signing settings requires deploying its new public key before testing delivery. |
| `POSTHOG_API_KEY` | Canary the five allowlisted events in staging, verify pseudonymous IDs/properties and deterministic replay dedupe, roll out, then revoke the old project key. | Keep person profiles, GeoIP, exception autocapture, and arbitrary event properties disabled. `ANALYTICS_ID_HASH_SECRET` is a separate continuity secret and is not rotated with the API key. |
| `SENTRY_DSN` / project routing | Canary a synthetic staging failure and one aggregate alert, verify final event scrubbing and ownership/routing, then remove the prior project route. | A DSN is configuration, not permission to capture request data. Keep automatic integrations disabled and server-side project scrubbing enabled as defense in depth. |

When both Stripe variables are present, the distinct union of
`STRIPE_WEBHOOK_SECRETS` and `STRIPE_WEBHOOK_SECRET` must still contain at most
two values. This supports a legacy-to-overlap rollout without an unsigned gap.

## Credentialed staging gate

Mock-mode tests do not prove provider readiness. Before production launch, use
separate staging accounts/resources and record evidence for all of the
following:

- Cognito: email/password and configured hosted/social sign-in issue an ID token
  with the expected issuer, audience, token use, and group claims; ownership
  tests still hide another user's records.
- S3: constrained browser POST accepts only the signed key/MIME/size; server
  HEAD verification rejects mismatches; signed GET playback works from each
  frontend origin; audio range GETs expose the required range/content headers;
  the bucket remains private.
- Fal: approved references only, queue/poll completion, allowlisted HTTPS output,
  streaming byte cap, MIME/signature agreement, encrypted private import,
  moderation enqueue, and an idempotent failed-job refund.
- Stripe: correct test mode, frozen amount/currency, Checkout redirect template,
  valid raw-body signature, duplicate event replay, authorization/finalization,
  tax configuration, and old/new webhook-secret overlap.
- Scribeless: team-confirmed folded campaign, published variable names, exact
  sender address, recipient count, QR destination template, and provider status
  polling. Use a pending/non-mailing staging campaign unless a separately
  approved physical test is planned.
- Public link: generated QR points to the stable frontend URL, the database
  stores only a token hash, media reads are short-lived/private, and malformed,
  revoked, wrong-state, or media-incomplete requests are indistinguishable
  `404`s.
- SendGrid: verified sender, each dynamic template, credential-free orders URL,
  HTTP `202` acceptance, raw-body ECDSA event verification, duplicate
  `sg_event_id` replay, and delivered/bounced state updates. Use a restricted
  staging inbox and retain no email or callback payload in the gate record.
- PostHog: each of the five allowlisted funnel events arrives with an HMAC
  distinct ID, deterministic UUID, no person profile or GeoIP, and only the
  documented bounded properties. Replaying the same lifecycle subject must not
  create another logical event.
- Sentry/alerts: one synthetic `5xx`, one known provider rejection, one
  ambiguous provider outcome, and one test threshold alert arrive with only
  approved tags and scrubbed stacks. Verify issue ownership, paging routes,
  cooldown behavior, recovery re-arming, and the absence of request, user,
  context, extra, breadcrumb, module, and transaction data.
- HTTP edge: verify `X-Content-Type-Options`, `X-Frame-Options`, referrer policy,
  and production HSTS on a public and an authenticated route; confirm
  `X-Powered-By` is absent. Confirm `/api/docs`, `/api/docs-json`, and
  `/api/docs-yaml` are unavailable when production uses the default
  `SWAGGER_ENABLED=false`.

For each gate, retain only UTC timestamps, environment/resource identifiers,
request IDs, stable local/provider object IDs, pass/fail, and reviewer. Do not
retain payloads, signed URLs, tokens, recipient information, or secret values.

## Incident closure checklist

- Provider state, local state, money/credit state, fulfillment count,
  notification delivery state, and audit events agree.
- No blind retry, duplicate charge, duplicate card, ownership leak, or secret
  exposure occurred; otherwise keep the higher-severity incident open.
- Any recovery was idempotent, reviewed, and audited. No ad hoc SQL writes were
  used.
- Temporary overlap credentials were removed and old credentials revoked.
- Logs/tickets contain only approved identifiers and no PII, content, signed
  URL, bearer token, or secret.
- Monitoring/runbook/tests were updated for the discovered failure mode.

See `env-vars.md` for configuration constraints, `api-contracts.md` for route
behavior, `testBackendFlow.md` for the local mock flow, and
`../database/README.md` for migration order.
