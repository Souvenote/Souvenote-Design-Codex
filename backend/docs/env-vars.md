# Environment Variables

Copy `backend/server/.env.example` to `backend/server/.env.local` and set the
values needed for the services you run.

## Core

```dotenv
NODE_ENV=development
PRODUCTION_PREVIEW_MODE=false
DATABASE_URL=
DATABASE_POOL_MAX=10
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_QUERY_TIMEOUT_MS=30000
CORS_ALLOWED_ORIGINS=http://localhost:3000
SWAGGER_ENABLED=
COGNITO_REGION=
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
MOCK_FLOW_COGNITO_ID_TOKEN=
AI_MOCK_MODE=true
GENERATION_PROVIDER_MODE=mock
```

`PRODUCTION_PREVIEW_MODE=true` is a narrowly scoped deployment gate for the
private AWS-URL preview of the production stack. It preserves production HTTP
security while allowing mock notifications and disabled PostHog/Sentry until
the external-provider launch gates are complete. It must never be enabled for
a custom-domain or customer-facing launch. The production CloudFormation stack
derives it automatically: the AWS-generated URL uses preview mode, while
attaching a custom domain disables it and restores fail-closed provider checks.

The database pool defaults to 10 connections. Acquiring a connection fails
after five seconds, idle clients are evicted after 30 seconds, and both the
client query timer and PostgreSQL `statement_timeout` cancel queries after 30
seconds. Overrides must be whole milliseconds within these ranges:
`DATABASE_POOL_MAX` 1-100, `DATABASE_CONNECTION_TIMEOUT_MS` 100-60000,
`DATABASE_IDLE_TIMEOUT_MS` 1000-600000, and `DATABASE_QUERY_TIMEOUT_MS`
100-300000. Size the pool against the database's total connection limit across
all deployed API instances.

`CORS_ALLOWED_ORIGINS` is a comma-separated list of exact frontend origins.
Paths, wildcards, embedded credentials, queries, and fragments are rejected.
It is required in production, where non-loopback entries must use HTTPS. Never
use `*` with the credentialed API.

Helmet security headers apply to every route before CORS or Swagger is mounted.
HSTS is disabled outside production so a local HTTP origin is not upgraded
unexpectedly; production uses Helmet's default HSTS and content-security
policies. `SWAGGER_ENABLED` accepts only `true` or `false`, defaults to `true`
outside production, and defaults to `false` in production. Set it to `true` in
production only for a deliberately controlled documentation surface; doing so
relaxes the content-security policy required by Swagger UI while retaining the
other Helmet headers.

`MOCK_FLOW_COGNITO_ID_TOKEN` is only used by the authenticated local-flow
script. It must be a current Cognito ID token for a test account.

`AI_MOCK_MODE=true` enables development-only credit grants. It does not select
the generation provider.

## Generation

```dotenv
GENERATION_PROVIDER_MODE=mock
FAL_KEY=
GENERATION_JOB_TIMEOUT_SECONDS=1800
GENERATION_REFERENCE_URL_EXPIRES_SECONDS=900
GENERATION_REMOTE_ASSET_HOSTS=fal.media
GENERATION_ASSET_DOWNLOAD_TIMEOUT_MS=30000
GENERATION_MAX_IMAGE_BYTES=20971520
GENERATION_MAX_AUDIO_BYTES=20971520
```

- `mock` completes locally and does not contact Fal or S3.
- `fal` queues GPT Image 2 image/edit jobs and Lyria 3 music jobs. It requires
  `FAL_KEY`, `AWS_REGION`, and `AWS_S3_BUCKET_NAME`; the server rejects the mode
  before dispatch if any are missing.
- `FAL_KEY` is server-only. Never expose it through a `NEXT_PUBLIC_*` variable,
  browser bundle, log, API response, or committed file.
- Real generation signs owned upload keys for reference-image input, polls the
  provider queue, imports completed files into private S3, and persists only
  owned S3 keys. Provider output URLs are never stored in PostgreSQL.
- `GENERATION_JOB_TIMEOUT_SECONDS` is the durable job deadline. A provider-
  reported failure, timeout, or unsafe output import marks the job failed and
  triggers the idempotent credit refund path.
- Reference URLs expire after `GENERATION_REFERENCE_URL_EXPIRES_SECONDS` and
  are only sent to the provider; they are not stored as generation results.
- `GENERATION_REMOTE_ASSET_HOSTS` is a comma-separated HTTPS hostname allowlist.
  Keep it narrow. Subdomains of each listed host are allowed.
- Download time and byte limits are enforced while streaming, before the file
  is copied into S3. MIME metadata, response MIME, and file signatures must
  agree.

## Uploads

```dotenv
UPLOAD_PROVIDER_MODE=mock
UPLOAD_MAX_BYTES=10485760
UPLOAD_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp
UPLOAD_URL_EXPIRES_SECONDS=900
ASSET_READ_URL_EXPIRES_SECONDS=300
AWS_REGION=
AWS_S3_BUCKET_NAME=
AWS_S3_ENDPOINT=
AWS_S3_FORCE_PATH_STYLE=false
AWS_S3_KMS_KEY_ID=
```

- `mock` mode keeps the complete flow local and does not contact object storage.
- `s3` mode signs a constrained browser POST and verifies the stored object's
  size and content type before creating an asset.
- `ASSET_READ_URL_EXPIRES_SECONDS` controls ephemeral S3 GET links returned by
  authenticated, owner-scoped asset reads. These URLs are response-only and are
  never persisted. The default is five minutes.
- `AWS_REGION` and `AWS_S3_BUCKET_NAME` are required in `s3` mode. The AWS SDK
  default credential chain supplies credentials; do not add access keys to the
  repository.
- `AWS_S3_ENDPOINT` and `AWS_S3_FORCE_PATH_STYLE` are optional compatibility
  settings for an S3-compatible local service.
- `AWS_S3_KMS_KEY_ID` is optional. Generated assets use S3-managed AES-256
  encryption by default and the configured KMS key when this value is set.
- The S3 bucket CORS policy must allow `POST` from each frontend origin. It must
  also allow `GET` and `HEAD` for private signed image/song playback, and should
  expose `Accept-Ranges`, `Content-Length`, `Content-Range`, and `ETag` so browser
  audio seeking works consistently. The backend role needs `s3:PutObject` and
  `s3:GetObject` for the `uploads/` and `generated/` prefixes. Enable
  `UPLOAD_PROVIDER_MODE=s3` when Fal should receive user-uploaded reference
  photos. Keep the bucket private; CORS does not grant object access.

## Moderation

```dotenv
MODERATION_PROVIDER_MODE=manual
MODERATION_REVIEWER_GROUPS=moderators,admin
```

- `manual` is the supported production-safe moderation mode. Real uploaded,
  generated image, and generated song assets enter a durable review queue and
  are never auto-approved. Unsupported provider-mode values are rejected.
- `MODERATION_REVIEWER_GROUPS` is a comma-separated allowlist matched against
  the verified Cognito `cognito:groups` claim. Only those users can list queue
  items or record decisions.
- Queue reads return short-lived private S3 URLs. Approvals and rejections are
  atomic, final, and written to `audit_logs` with the reviewer identity.
- Fal reference-image generation requires every uploaded reference to have an
  `approved` moderation state. Pending references return `409`, and rejected
  references return `400`, before credits are deducted or a generation job is
  created.

## Operations evidence

```dotenv
OPERATIONS_READER_GROUPS=operations,admin
```

- `OPERATIONS_READER_GROUPS` is a comma-separated, exact allowlist matched
  against the verified Cognito `cognito:groups` claim for the PII-minimized
  order-evidence endpoint. It is intentionally separate from
  `MODERATION_REVIEWER_GROUPS`; moderator membership alone grants no operations
  access.
- Production requires an explicit non-empty allowlist and rejects `*`. The
  development/test default is `operations,admin` only so local verification can
  run without weakening the production fail-closed behavior.
- The operations route is read-only. It cannot impersonate a customer, inspect
  card content or addresses, reveal raw provider diagnostics or tokens, retry a
  provider mutation, reconcile state, or correct database records.

## Checkout

```dotenv
CHECKOUT_PROVIDER_MODE=mock
CHECKOUT_SUCCESS_URL=http://localhost:3000/delivery?checkout=success&session_id={CHECKOUT_SESSION_ID}
CHECKOUT_CANCEL_URL=http://localhost:3000/delivery?checkout=cancel
CREDIT_CHECKOUT_SUCCESS_URL=http://localhost:3000/cart?checkout=success&session_id={CHECKOUT_SESSION_ID}
CREDIT_CHECKOUT_CANCEL_URL=http://localhost:3000/cart?checkout=cancel
AUTHORIZATION_WORKER_ENABLED=false
AUTHORIZATION_WORKER_INTERVAL_MS=60000
AUTHORIZATION_WORKER_BATCH_SIZE=10
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_WEBHOOK_SECRETS=
STRIPE_EXPECT_LIVEMODE=false
STRIPE_AUTOMATIC_TAX_ENABLED=true
STRIPE_ALLOW_PROMOTION_CODES=false
```

- `mock` keeps the no-network checkout path. `stripe` creates hosted Checkout
  Sessions from immutable server-side order or standalone-credit pricing
  snapshots; it requires the secret key, at least one webhook secret, and the
  matching card and credit-pack redirect settings.
- Redirect URLs are server-owned. The success URL must include
  `{CHECKOUT_SESSION_ID}`. HTTPS is mandatory except for local loopback URLs;
  request bodies cannot override either redirect.
- `STRIPE_EXPECT_LIVEMODE` must match every signed event. Keep it `false` in
  local and staging test-mode environments and set it deliberately for live
  deployment.
- Automatic tax is enabled by default. Promotion codes are disabled until
  deliberately enabled and configured in Stripe.
- Try Risk-Free uses manual capture. A `send` finalization captures the
  authorized Stripe total; `not_send` captures only the frozen
  `no_send_fee_cents` catalog value and releases the remainder. The browser
  cannot supply either amount.
- The authorization webhook freezes `decision_due_at` from the catalog
  snapshot: five days after Stripe reports the payment authorized. Enable
  `AUTHORIZATION_WORKER_ENABLED` in Stripe staging/production so an expired,
  undecided authorization is leased and finalized as `not_send`, capturing the
  frozen flat CA$2 fee. The worker defaults on in production and off elsewhere,
  polls every 10 seconds to one hour, and claims 1-50 rows per batch.
- Standalone credit packs are always automatic-capture, CAD-only purchases.
  Credits are granted through one ledger idempotency key only after the signed
  Stripe success event or the development-only mock completion.
- The public webhook route accepts only a valid Stripe signature over the raw
  request bytes. Events are deduplicated durably before atomic payment/order
  reconciliation. Never expose any Stripe secret through frontend variables.
- `STRIPE_WEBHOOK_SECRETS` accepts one or two comma-separated `whsec_` values
  for a bounded old/new overlap during rotation. The singular
  `STRIPE_WEBHOOK_SECRET` remains supported and joins that set when present;
  more than two distinct secrets, empty entries, or non-Stripe values fail
  closed. Remove the old secret promptly after both signing paths are verified.

## Fulfillment

```dotenv
FULFILLMENT_PROVIDER_MODE=mock
SCRIBELESS_API_KEY=
SCRIBELESS_CAMPAIGN_ID=
SCRIBELESS_FOLDED_WORKFLOW_CONFIRMED=false
SCRIBELESS_CAMPAIGN_SENDER_CONFIRMED=false
SCRIBELESS_CAMPAIGN_SENDER_ADDRESS_JSON=
SCRIBELESS_ALLOW_PENDING_CAMPAIGN=false
SCRIBELESS_IMAGE_VARIABLE=frontImageUrl
SCRIBELESS_MESSAGE_VARIABLE=insideMessage
SCRIBELESS_QR_VARIABLE=qrCodeUrl
SCRIBELESS_QR_DESTINATION_URL=
SCRIBELESS_ASSET_URL_EXPIRES_SECONDS=3600
SCRIBELESS_REQUEST_TIMEOUT_MS=30000
PUBLIC_LINK_HMAC_SECRET=
PUBLIC_ASSET_URL_EXPIRES_SECONDS=300
```

- `mock` completes deterministically without network traffic. `scribeless`
  validates a recurring direct-mail campaign, then submits one recipient for
  every card in the immutable paid order.
- Scribeless's public custom-HTML endpoint does not currently support folded
  products. Real mode therefore requires a team-specific folded campaign and
  published template; keep `SCRIBELESS_FOLDED_WORKFLOW_CONFIRMED=false` until
  Scribeless has confirmed that workflow for the Souvenote account.
- The configured campaign template must expose the image, inside-message, and
  optional QR variable names. The return address is campaign-owned, so
  `SCRIBELESS_CAMPAIGN_SENDER_CONFIRMED` must also be set deliberately and
  `SCRIBELESS_CAMPAIGN_SENDER_ADDRESS_JSON` must exactly match the order's
  normalized sender address. A mismatched user-entered return address is held
  before provider submission rather than silently replaced.
- Keep pending campaigns for controlled preview testing only. A pending
  campaign does not print or mail recipients; production should use a live or
  ready recurring campaign.
- `SCRIBELESS_QR_DESTINATION_URL` is required only for cards with a song and
  must be an HTTPS template containing `{PUBLIC_TOKEN}`, for example
  `https://app.example.com/listen/{PUBLIC_TOKEN}`. Do not point a printed QR
  code at an order ID or a short-lived S3 URL.
- `PUBLIC_LINK_HMAC_SECRET` must be an independently generated 32-byte secret
  encoded as 64 hexadecimal characters. It deterministically derives an
  unguessable printed token while PostgreSQL stores only its SHA-256 hash. Keep
  this secret stable; changing it after cards are printed intentionally fails
  closed instead of orphaning or replacing live links.
- `PUBLIC_ASSET_URL_EXPIRES_SECONDS` controls the short-lived private S3 reads
  returned after a valid token lookup. Public-link responses are no-store and
  noindex; revoked, malformed, unpaid, or unknown links all return `404`.
- Approved front artwork is provided through a bounded one-hour signed S3 URL
  for render-time ingestion. Signed URLs and Scribeless document URLs are not
  persisted in fulfillment records.
- Scribeless currently exposes QR-scan webhooks, not fulfillment-status
  webhooks. The backend polls recipient IDs and applies monotonic submitted,
  printing, shipped, delivered, hold, or failed states. An ambiguous submission
  timeout is held for operator reconciliation and is never retried blindly.
- `SCRIBELESS_API_KEY` is server-only. Never expose it through frontend
  variables, logs, API responses, or committed files.

## Transactional notifications

```dotenv
NOTIFICATION_PROVIDER_MODE=mock
NOTIFICATION_WORKER_ENABLED=false
NOTIFICATION_WORKER_INTERVAL_MS=5000
NOTIFICATION_PROCESSING_LEASE_MS=300000
NOTIFICATION_MAX_ATTEMPTS=5
NOTIFICATION_ORDERS_URL=https://app.example.com/my-cards
SENDGRID_API_KEY=
SENDGRID_API_BASE_URL=https://api.sendgrid.com
SENDGRID_FROM_EMAIL=
SENDGRID_FROM_NAME=Souvenote
SENDGRID_ORDER_CONFIRMATION_TEMPLATE_ID=
SENDGRID_ORDER_SHIPPED_TEMPLATE_ID=
SENDGRID_ORDER_DELIVERED_TEMPLATE_ID=
SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY=
SENDGRID_REQUEST_TIMEOUT_MS=10000
```

- `mock` accepts notifications without network traffic and is rejected when
  `NODE_ENV=production`, except for the explicit AWS-only
  `PRODUCTION_PREVIEW_MODE=true` gate. A customer-facing production launch must
  use `sendgrid` and enable the worker. The worker defaults off outside
  production so tests and local API processes do not start an unexpected
  background dispatcher.
- Paid/paid-mock orders enqueue one `order_confirmation`; real fulfillment
  transitions enqueue one `order_shipped` and one `order_delivered`. A unique
  lifecycle idempotency key prevents duplicate intents across webhook
  redelivery or repeated status polling.
- The outbox stores the owning user/order IDs and bounded order status, amount,
  currency, and quantity only. It does not duplicate email, postal addresses,
  card/message content, storage keys, signed URLs, or provider callback bodies.
  The current user email is loaded only while dispatching.
- SendGrid mode uses dynamic template IDs and a credential-free HTTPS
  `NOTIFICATION_ORDERS_URL`. The API base is restricted to SendGrid's global or
  EU endpoint. API keys, template IDs, sender identity, and event-webhook
  signing key must be configured in deployment secrets/settings as applicable.
- Configure SendGrid's signed Event Webhook to POST to
  `/api/notifications/sendgrid/webhook`. Verification uses the exact raw body,
  signature, and timestamp headers. Only delivery lifecycle fields and the
  `sg_event_id` dedupe key are retained; callback email, reason, URL,
  user-agent, and raw payload are discarded.
- Explicit `408`, `429`, and `5xx` provider rejections use bounded exponential
  retry. Network/timeout ambiguity, stale processing claims, or provider
  acceptance followed by an unproven local write become `delivery_unknown` and
  are never resent blindly.
- Cognito remains responsible for account verification and password recovery.
  Support/referral messages require an explicit product workflow before they
  are added to the transactional outbox.

## Analytics and observability

```dotenv
ANALYTICS_PROVIDER_MODE=disabled
POSTHOG_API_KEY=
POSTHOG_HOST=https://us.i.posthog.com
ANALYTICS_ID_HASH_SECRET=

ERROR_REPORTING_MODE=disabled
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=
SENTRY_FLUSH_TIMEOUT_MS=2000

OPERATIONAL_ALERTS_ENABLED=false
OPERATIONAL_ALERTS_INTERVAL_MS=60000
OPERATIONAL_ALERT_REPEAT_MS=3600000
PAYMENT_RECONCILIATION_ALERT_AGE_MINUTES=15
PAYMENT_AUTHORIZATION_ALERT_AGE_HOURS=144
PAYMENT_RECONCILIATION_ALERT_THRESHOLD=1
MODERATION_QUEUE_ALERT_AGE_MINUTES=60
MODERATION_QUEUE_ALERT_THRESHOLD=10
GENERATION_REFUND_ALERT_WINDOW_MINUTES=15
GENERATION_REFUND_ALERT_THRESHOLD=5
FULFILLMENT_HOLD_ALERT_THRESHOLD=1
```

- Development and test default both integrations to `disabled`. Production
  defaults to, and requires, `posthog` analytics and `sentry` error reporting;
  explicitly disabling either in production fails startup unless the
  AWS-generated-URL deployment has the explicit
  `PRODUCTION_PREVIEW_MODE=true` gate. Custom-domain production disables that
  gate and remains fail closed.
- PostHog receives only five backend-owned funnel events: account provisioned,
  generation started, generation approved, checkout started, and order
  confirmed. The server HMACs local user and lifecycle IDs with the independent
  32-byte `ANALYTICS_ID_HASH_SECRET`; raw IDs, emails, names, addresses, card or
  message text, prompts, upload references, and signed URLs are not sent.
- `POSTHOG_HOST` is restricted to the official US or EU ingestion endpoint.
  The integration disables GeoIP, person-profile processing, and exception
  autocapture. Keep the identity hash secret stable or funnel continuity and
  deterministic event dedupe will intentionally change.
- Sentry uses manual capture with default integrations disabled. Request data,
  user data, contexts, extras, breadcrumbs, modules, and transaction names are
  stripped before send. Only a synthetic error code, scrubbed stack frames,
  route template/request ID, HTTP status, and fixed provider operation tags may
  leave the process.
- Provider calls emit structured `provider_call_metric` logs containing only
  provider, operation, outcome, and duration. Never add URLs, object IDs,
  response bodies, exception messages, or request payloads to this event.
- Operational alerts default on in production and off elsewhere. The worker
  reads aggregate counts for stalled payment reconciliation, stale moderation
  work, generation-refund spikes, and fulfillment holds. Threshold crossings
  are sent to Sentry with a one-hour default repeat cooldown; recovery clears
  the cooldown state so a later recurrence alerts immediately.

Only commit `.env.example`. Never commit real secrets or local `.env` files.
See `operations-runbook.md` before rotating credentials, changing alert
thresholds, changing `ANALYTICS_ID_HASH_SECRET`, or reconciling a provider
outcome.
