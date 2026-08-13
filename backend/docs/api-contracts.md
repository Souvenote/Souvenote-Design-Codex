# Souvenote Backend API Contracts

## Request correlation and safe HTTP logs

Every API response includes `X-Request-ID`. A valid caller-provided UUID is
normalized and echoed; missing, repeated, or malformed values are replaced with
a server-generated UUID. Browser clients may read this header through CORS and
should include it in support reports.

Production console output is structured JSON. HTTP completion/failure events
contain only the request ID, method, matched route template, status code, and
duration. They never include URL parameters, query strings, headers, request or
response bodies, Cognito identities, recipient/card content, or exception
messages. Successful health probes are omitted; failed probes remain visible.
Use `operations-runbook.md` to correlate an incident, reconcile provider state,
or rotate credentials without exposing request/customer content.

Every HTTP response also receives Helmet's standard security headers. Local
HTTP does not receive HSTS; production does. Swagger UI and its raw OpenAPI
documents default off in production and are mounted only when
`SWAGGER_ENABLED=true`; invalid Boolean configuration fails startup.

## Analytics, provider metrics, and error reporting

The backend emits five allowlisted PostHog funnel events: `account provisioned`,
`generation started`, `generation approved`, `checkout started`, and
`order confirmed`. Local user/order/draft/job IDs are used only as inputs to a
server-side HMAC. PostHog receives the resulting pseudonymous distinct ID and
deterministic event UUID, plus bounded provider mode, offer code, quantity,
currency, or asset-count dimensions as applicable. It does not receive an API
request body or customer/card/media content. Deterministic event UUIDs make
webhook redelivery and idempotent lifecycle replay analytics-safe.

Every real Stripe, Fal, S3, Scribeless, and SendGrid boundary emits a structured
`provider_call_metric` log with only provider, fixed operation name, outcome,
and elapsed milliseconds. Known HTTP rejection and ambiguous network outcomes
are distinct; the metric never contains a URL, provider response, local or
provider object ID, signed URL, request payload, or exception message.

Unhandled HTTP `5xx` failures and provider failures are reported to Sentry as
synthetic, PII-scrubbed errors. Automatic request instrumentation is disabled,
and a final scrub removes request/user/context/extra/breadcrumb/module and
transaction fields. Operational threshold alerts contain only the fixed alert
name, aggregate count, and threshold. These streams are not customer-facing API
contracts and must not be used as a source of payment, credit, moderation,
fulfillment, or delivery truth.

Base URL in local development:

```txt
http://localhost:4000/api
```

Swagger is also available locally:

```txt
http://localhost:4000/api/docs
```

Production does not expose this route unless an operator explicitly enables it.

## Provider Modes

Fulfillment defaults to a local mock and can use a team-confirmed Scribeless
folded-card campaign with `FULFILLMENT_PROVIDER_MODE=scribeless`. Checkout
defaults to a local mock and can use Stripe-hosted Checkout with
`CHECKOUT_PROVIDER_MODE=stripe`. Uploads default to
`UPLOAD_PROVIDER_MODE=mock`, but can use private S3 storage with
`UPLOAD_PROVIDER_MODE=s3`. Generation defaults to a local mock and can use the
server-side Fal queue plus private S3 import with `GENERATION_PROVIDER_MODE=fal`.
Real media moderation uses a durable manual queue with
`MODERATION_PROVIDER_MODE=manual`; it never auto-approves real assets.

Service mapping:

| Area | Current behavior | Future replacement |
| --- | --- | --- |
| Uploads | Local metadata mock or constrained S3 signed POST, server verification, and durable moderation enqueue | Automated moderation provider integration |
| Generation | Durable mock jobs or queued Fal image/music jobs with encrypted private S3 import and moderation enqueue | Webhook-driven provider completion |
| Moderation | Cognito-group-protected human review queue with atomic decisions and audit logs | Optional automated provider workers |
| Checkout | Durable mock sessions or server-priced Stripe Checkout, manual authorization, signed webhook reconciliation, and audit logs | Additional payment methods and operational tooling |
| Fulfillment | Durable mock or Scribeless attempts, exact multi-recipient submission, safe ambiguity holds, and status polling | Background polling and operations tooling |
| Gifts/referrals | Signed private claims, escrowed gift entitlements, first-send referral rewards, mock invite delivery | Reviewed real-delivery templates |
| Notifications | Durable mock or SendGrid dynamic-template outbox, signed callback dedupe, and ambiguity holds | Explicit support workflows |
| Analytics | HMAC-pseudonymous, allowlisted backend funnel events through PostHog | Reviewed additions to the event schema |
| Observability | PII-safe structured HTTP/provider logs, scrubbed Sentry errors, and aggregate lifecycle alerts | Deployment dashboards and credentialed staging validation |

Common error shape from Nest:

```json
{
  "message": "Card draft not found.",
  "error": "Not Found",
  "statusCode": 404
}
```

## Authentication And Ownership

`GET /health`, `GET /health/live`, `GET /health/ready`, `GET /pricing`,
`GET /retention-policy`, and a tokenized `GET /public/souvenotes/:token` are
public. Stripe and SendGrid webhooks are unauthenticated but require valid
provider signatures. Every other endpoint requires a Cognito ID token. The
public keepsake token is an unguessable bearer capability printed on the
physical card; it is not a user/session token:

```http
Authorization: Bearer <cognito-id-token>
```

The API verifies the token, provisions or loads the matching local user, and
derives ownership from that user. Clients must not send `userId` in request
bodies or URLs. A record owned by another user is returned as `404`.

## Full Local Flow

1. `GET /auth/me`
2. Optional local-only `POST /credits/mock-purchase`, or standalone
   `POST /checkout/credit-packs/start`
3. `POST /card-drafts`
4. Optional `POST /uploads/request`, storage POST, and `POST /uploads/commit`
5. In real mode, a reviewer approves uploaded references through `/moderation`
6. `POST /generation/start`
7. In real mode, a reviewer approves generated media through `/moderation`
8. `GET /assets/card-draft/:cardDraftId`
9. `POST /assets/card-draft/:cardDraftId/approve`
10. `POST /orders`
11. `POST /checkout/start`
12. In mock mode, `POST /checkout/mock-success`
13. In Stripe Try Risk-Free mode, a signed webhook authorizes the payment and
    starts its five-day clock. `POST /checkout/authorization/finalize` records
    a decision; the worker finalizes no-action orders at the deadline.
14. `POST /fulfillment/submit`
15. In Scribeless mode, `POST /fulfillment/order/:orderId/refresh`

Steps 5 and 7 are not needed for mock assets, whose state is
`approved_mock` and which never leave the local mock flow.

## Retention policy

### GET `/retention-policy`

Returns the versioned, machine-readable staging retention baseline without
requiring authentication. The response includes its review status, governing
principles, category schedule, legal-hold exception, and deletion-verification
rules. The policy is descriptive until the separately reviewed purge/redaction
jobs are enabled.

The matching human-readable policy is
`backend/docs/data-retention-policy.md`.

## Health

### GET `/health`

Backwards-compatible alias for `GET /health/ready`.

### GET `/health/live`

Confirms the NestJS process can answer requests without querying dependencies.
Use this for a liveness probe so a temporary PostgreSQL outage does not trigger
an unnecessary application restart.

Response `200`:

```json
{
  "status": "ok",
  "service": "souvenote-backend",
  "timestamp": "2026-07-22T16:00:00.000Z"
}
```

### GET `/health/ready`

Checks API and PostgreSQL connectivity. Use this for readiness/load-balancer
traffic admission.

Response `200`:

```json
{
  "status": "ok",
  "service": "souvenote-backend",
  "database": "connected",
  "timestamp": "2026-06-13T16:00:00.000Z"
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 200 | API and database are reachable |
| 503 | PostgreSQL is unavailable; do not send new traffic |

## Credits

### GET `/credits/balance`

Returns the authenticated user's ledger balance.

### POST `/credits/mock-purchase`

Adds credits for the authenticated user during the local mock checkout flow.
This endpoint is available only when `AI_MOCK_MODE=true` and accepts at most
300 credits per request.

Request:

```json
{
  "amount": 10,
  "idempotencyKey": "mock-purchase-unique-key"
}
```

### GET `/credits/purchases/:purchaseId`

Returns one standalone credit-pack purchase only to its authenticated owner,
along with the current ledger balance. This endpoint is the source of truth
after returning from hosted Stripe Checkout; the browser must not infer a
credit grant from the redirect alone.

Response `200`:

```json
{
  "purchase": {
    "id": "uuid",
    "offerCode": "credit_pack_creator_80",
    "status": "paid",
    "amountCents": 1000,
    "currency": "cad",
    "creditAmount": 80,
    "checkoutSessionId": "cs_...",
    "paymentId": "uuid"
  },
  "balance": {
    "userId": "uuid",
    "balance": 82
  }
}
```

## Card entitlements

### GET `/card-entitlements/balance`

Returns the authenticated user's server-authoritative physical-card balance.
The balance is the sum of the append-only `card_entitlement_ledger`; the
browser cannot grant or mutate cards. A paid order grants its immutable
quantity exactly once, and its frozen `creditsPerCard` quantity is granted to
the credit ledger (at authorization for Try Risk-Free, otherwise at payment).
Creating a fulfillment attempt atomically deducts the paid quantity. A
definitive failed attempt refunds that deduction exactly once; an ambiguous
provider outcome remains on hold without refund so it cannot create duplicate
physical mail.

Response `200`:

```json
{
  "userId": "uuid",
  "balance": 4
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 200 | Owner-scoped card balance returned |
| 401 | Cognito session missing or invalid |

### GET `/card-entitlements/purchases/:purchaseId`

Returns one standalone Big Sender purchase only to its authenticated owner,
along with the current physical-card balance. Use this after returning from
hosted checkout; a browser redirect alone never grants cards.

```json
{
  "purchase": {
    "id": "uuid",
    "offerCode": "big_sender_2_10",
    "status": "paid",
    "amountCents": 4495,
    "currency": "cad",
    "cardAmount": 5,
    "creditAmount": 50
  },
  "balance": {
    "userId": "uuid",
    "balance": 5
  }
}
```

## Drafts

### POST `/card-drafts`

Creates a local card draft.

Request:

```json
{
  "occasion": "Birthday",
  "relationship": "Friend",
  "creativeBrief": {
    "tone": "warm",
    "insideMessage": "Make this feel personal."
  }
}
```

Response `201`:

```json
{
  "cardDraft": {
    "id": "uuid",
    "user_id": "uuid",
    "occasion": "Birthday",
    "relationship": "Friend",
    "creative_brief": {
      "tone": "warm",
      "insideMessage": "Make this feel personal."
    },
    "status": "draft",
    "created_at": "2026-06-13T16:00:00.000Z",
    "updated_at": "2026-06-13T16:00:00.000Z"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Draft created |
| 400 | Invalid request body |
| 500 | Database error |

### GET `/card-drafts/:draftId`

Fetches one draft.

Response `200`:

```json
{
  "cardDraft": {
    "id": "uuid",
    "user_id": "uuid",
    "occasion": "Birthday",
    "relationship": "Friend",
    "creative_brief": {},
    "status": "draft",
    "created_at": "2026-06-13T16:00:00.000Z",
    "updated_at": "2026-06-13T16:00:00.000Z"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 200 | Draft found |
| 404 | Draft not found |

### GET `/card-drafts`

Lists active drafts for a user.

Response `200`:

```json
{
  "userId": "uuid",
  "cardDrafts": []
}
```

## Uploads

### POST `/uploads/mock`

Immediate no-network upload for automated local flows. This shortcut is
available only when `UPLOAD_PROVIDER_MODE=mock`; the browser uses the provider-
neutral request and commit endpoints below.

Request:

```json
{
  "cardDraftId": "uuid",
  "filename": "photo.png",
  "mimeType": "image/png",
  "size": 12345
}
```

Response `201`:

```json
{
  "upload": {
    "id": "uuid",
    "userId": "uuid",
    "cardDraftId": "uuid",
    "assetId": "uuid",
    "filename": "photo.png",
    "mimeType": "image/png",
    "size": 12345,
    "status": "uploaded",
    "attestationAccepted": true,
    "uploadedAt": "2026-06-13T16:00:00.000Z",
    "createdAt": "2026-06-13T16:00:00.000Z",
    "updatedAt": "2026-06-13T16:00:00.000Z",
    "mockUrl": "mock://souvenote/uploads/mock/uuid/photo.png",
    "storageKey": "mock/uuid/photo.png"
  },
  "asset": {
    "id": "uuid",
    "userId": "uuid",
    "cardDraftId": "uuid",
    "generationJobId": null,
    "assetType": "upload",
    "storageKey": "mock/uuid/photo.png",
    "mockUrl": "mock://souvenote/mock/uuid/photo.png",
    "moderationState": "approved_mock",
    "approvedAt": null,
    "printAssetKey": null,
    "qrMetadata": {
      "source": "mock_upload"
    },
    "createdAt": "2026-06-13T16:00:00.000Z"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Mock upload created and committed |
| 400 | Invalid file metadata |
| 403 | Endpoint disabled because S3 mode is active |
| 404 | Draft not found for that user |

### POST `/uploads/request`

Creates a provider-aware upload request after validating draft ownership,
content type, and exact file size. In S3 mode, `formFields` contains the signed
multipart fields that the browser must send to `uploadUrl`; append the file
field last and do not send the Cognito authorization header to S3.

Request:

```json
{
  "cardDraftId": "uuid",
  "filename": "photo.png",
  "contentType": "image/png",
  "fileSizeBytes": 12345
}
```

S3-mode response `201`:

```json
{
  "uploadRequest": {
    "id": "uuid",
    "userId": "uuid",
    "cardDraftId": "uuid",
    "assetId": null,
    "filename": "photo.png",
    "mimeType": "image/png",
    "size": 12345,
    "providerMode": "s3",
    "status": "requested",
    "attestationAccepted": false,
    "uploadExpiresAt": "2026-06-13T16:15:00.000Z",
    "uploadedAt": null,
    "mockUrl": null,
    "storageKey": "uploads/user-uuid/draft-uuid/random-photo.png",
    "uploadMethod": "POST",
    "uploadUrl": "https://bucket.s3.ca-central-1.amazonaws.com",
    "formFields": {
      "Content-Type": "image/png",
      "key": "uploads/user-uuid/draft-uuid/random-photo.png",
      "policy": "signed-policy"
    },
    "expiresAt": "2026-06-13T16:15:00.000Z",
    "maxSizeBytes": 10485760,
    "mockUploadUrl": null,
    "mockKey": null
  }
}
```

In mock mode, the same response uses `providerMode: "mock"`,
`uploadMethod: "MOCK"`, an empty `formFields` object, and a `mock://` URL. No
storage request is required before commit.

### POST `/uploads/commit`

Commits an upload request and creates one reviewable `upload` asset. S3 mode
first performs a server-side object metadata check for the requested key, exact
byte length, and content type. Repeated commits are idempotent and return the
same asset.

Request:

```json
{
  "cardDraftId": "uuid",
  "s3Key": "uploads/user-uuid/draft-uuid/random-photo.png",
  "attestationAccepted": true
}
```

Response `201`:

```json
{
  "upload": {
    "id": "uuid",
    "status": "uploaded",
    "providerMode": "s3",
    "verifiedAt": "2026-06-13T16:01:00.000Z",
    "etag": "object-etag",
    "mockUrl": null
  },
  "asset": {
    "id": "uuid",
    "assetType": "upload",
    "storageKey": "uploads/user-uuid/draft-uuid/random-photo.png",
    "moderationState": "pending",
    "mockUrl": null
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Upload committed |
| 400 | Attestation missing, invalid state, or stored object metadata does not match |
| 404 | Upload request or draft not found |

## Generation

### POST `/generation/start`

Creates an idempotent generation job, deducts only the credits required by the
requested asset set, and persists provider outputs as assets. Set
`GENERATION_PROVIDER_MODE=mock` for deterministic local output or `fal` for
queued GPT Image 2 and Lyria 3 generation.

When `assetTypes` is omitted, the API generates the image and free message plus
the song when the draft has `includeSong: true`. Image and song generation cost
one credit each; message generation is free. Pass one asset type for a one-
credit image or song regeneration.

Request:

```json
{
  "cardDraftId": "uuid",
  "idempotencyKey": "draft-uuid-generation-1",
  "assetTypes": ["image", "song", "message"]
}
```

Response `201`:

```json
{
  "generationJob": {
    "id": "uuid",
    "user_id": "uuid",
    "card_draft_id": "uuid",
    "idempotency_key": "draft-uuid-generation-1",
    "overall_status": "ready",
    "image_status": "ready",
    "song_status": "ready",
    "message_status": "ready",
    "provider_mode": "mock",
    "requested_assets": ["image", "song", "message"],
    "provider_job_refs": {
      "mockJobId": "uuid"
    },
    "credits_charged": 2,
    "completed_at": "2026-06-13T16:00:01.000Z",
    "created_at": "2026-06-13T16:00:00.000Z",
    "updated_at": "2026-06-13T16:00:00.000Z"
  },
  "savedAssets": [
    {
      "id": "uuid",
      "asset_type": "image",
      "s3_key": "mock/generation/uuid/card-image.png",
      "moderation_state": "approved_mock"
    }
  ],
  "mockAssets": {
    "image": {
      "status": "ready",
      "mockUrl": "mock://souvenote/mock/generation/uuid/card-image.png"
    },
    "song": {
      "status": "ready",
      "mockUrl": "mock://souvenote/mock/generation/uuid/song.mp3"
    },
    "message": {
      "status": "ready",
      "text": "Happy birthday! This Souvenote message was generated in mock mode."
    }
  },
  "creditDeduction": {},
  "balance": {
    "userId": "uuid",
    "balance": 8
  },
  "idempotentReplay": false
}
```

Reusing the same idempotency key for the same user and request returns the
original job and assets without charging or generating again. Reusing it for a
different draft or asset set returns `409`.

In Fal mode, a successful start normally returns a `running` job and no saved
assets yet. The job references contain only provider endpoint/request IDs and
the deterministic message result; provider output URLs are not persisted.
Owned reference uploads are handed to the image-edit model through short-lived
signed S3 URLs, with at most 16 references per draft. Every reference must be
moderation-approved. The API checks this before deducting credits or inserting
the generation job, so pending or rejected references cannot reach Fal.

Example queued fields:

```json
{
  "generationJob": {
    "overall_status": "running",
    "provider_mode": "fal",
    "provider_job_refs": {
      "image": {
        "endpointId": "openai/gpt-image-2/edit",
        "requestId": "provider-request-id"
      },
      "song": {
        "endpointId": "fal-ai/lyria3",
        "requestId": "provider-request-id"
      }
    }
  },
  "savedAssets": []
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Generation accepted or completed |
| 400 | Insufficient credits, unsupported asset request, or provider failure |
| 409 | Idempotency key belongs to a different request, or a reference upload is awaiting moderation |
| 404 | Draft not found for that user |
| 500 | Selected provider or private storage is not configured |

### GET `/generation/:generationJobId`

Returns the authenticated user's generation job, its current component
statuses, saved assets, and current credit balance. The frontend polls this
endpoint when a start request returns `pending` or `running`.

For a running Fal job, this endpoint checks the provider queue. Once every
requested result is complete, the backend downloads only allowlisted HTTPS
files, enforces streaming byte limits, verifies MIME agreement and file
signatures, copies the outputs to encrypted private S3 keys under `generated/`,
and then atomically records the assets and ready job state. External result URLs
are neither stored nor returned. Provider failures, timeouts, and unsafe output
imports use an idempotent refund key. Concurrent status requests cannot refund
a job that another request already completed.

Real image and song outputs are inserted with `moderation_state=pending` and a
matching moderation job in the same transaction as generation completion.
Message assets do not contain provider media and are marked `approved`.

Status codes:

| Code | Meaning |
| --- | --- |
| 200 | Owned generation job returned |
| 404 | Job does not exist or belongs to another user |

## Moderation (Reviewer Only)

Every moderation route requires both a valid Cognito ID token and membership in
one of the Cognito groups configured by `MODERATION_REVIEWER_GROUPS`. An
authenticated customer outside those groups receives `403`.

### GET `/moderation/jobs`

Lists up to 50 pending/running manual review jobs in oldest-first order. Use the
optional `limit` query parameter for 1 through 100 results. Each item includes
a short-lived private `readUrl`; permanent provider URLs are not exposed or
stored.

Response `200`:

```json
{
  "jobs": [
    {
      "moderationJob": {
        "id": "uuid",
        "providerMode": "manual",
        "status": "pending",
        "attemptNumber": 1,
        "reviewedBy": null,
        "startedAt": null,
        "completedAt": null,
        "createdAt": "2026-07-22T12:00:00.000Z"
      },
      "asset": {
        "id": "uuid",
        "ownerId": "uuid",
        "cardDraftId": "uuid",
        "generationJobId": null,
        "assetType": "upload",
        "moderationState": "pending",
        "moderationReasonCode": null,
        "moderatedAt": null,
        "createdAt": "2026-07-22T12:00:00.000Z",
        "readUrl": "https://private-bucket.example/signed-object"
      },
      "idempotentReplay": false
    }
  ]
}
```

### POST `/moderation/jobs/:jobId/decision`

Atomically records a final human-review decision on both the moderation job and
asset and inserts an `audit_logs` record containing the reviewer identity. A
rejection also clears any previous user `approved_at` value. Repeating the same
decision is an idempotent replay and does not add a second audit event; reversing
a completed decision returns `409`.

Request:

```json
{
  "decision": "approved",
  "reasonCode": "safe_content"
}
```

`decision` must be `approved` or `rejected`. `reasonCode` is optional, at most
100 characters, and limited to lowercase letters, numbers, `_`, and `-`.

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Decision recorded or replayed idempotently |
| 400 | Invalid job UUID, decision, or reason code |
| 403 | Authenticated user is not in a configured reviewer group |
| 404 | Moderation job not found |
| 409 | Job is already completed with a different decision or is not actionable |

## Review Assets

### GET `/assets/card-draft/:cardDraftId`

Fetches upload and generated assets for review.

Response `200`:

```json
{
  "cardDraftId": "uuid",
  "assets": [
    {
      "id": "uuid",
      "asset_type": "image",
      "assetType": "image",
      "storageKey": "mock/card-image.png",
      "mockUrl": "mock://souvenote/mock/card-image.png",
      "readUrl": null,
      "moderationState": "approved_mock",
      "approvedAt": null,
      "qrMetadata": {},
      "createdAt": "2026-06-13T16:00:00.000Z"
    }
  ]
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 200 | Assets returned, possibly empty |

For S3-backed upload, image, and song assets, `readUrl` is a short-lived signed
GET URL. It is created only after the asset query is scoped to the authenticated
user and draft. Mock and message assets return `null`. Read URLs are never
written to the database and should not be cached beyond their expiry; fetch the
owned asset list again to refresh them. Storage keys outside the `uploads/` and
`generated/` prefixes are never signed.

### POST `/assets/card-draft/:cardDraftId/approve`

Atomically records the authenticated user's approval of one to three generated
assets. Each asset must belong to the draft and user, have a distinct type, and
already have a moderation state of `approved` or `approved_mock`. Uploads,
provider-pending assets, duplicate types, and mixed-ownership requests are
rejected without approving a subset.

Request:

```json
{
  "assetIds": ["IMAGE_ASSET_UUID", "SONG_ASSET_UUID", "MESSAGE_ASSET_UUID"]
}
```

Response `201` uses the same asset representation as the review endpoint, with
`approvedAt` populated. Repeating the same valid request is idempotent and keeps
the original approval timestamp.

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Every selected generated asset is approved |
| 400 | Asset ID array is empty, duplicated, too large, or malformed |
| 409 | At least one asset is unowned, not generated, duplicated by type, or awaiting moderation |

## Orders

Order status values:

```txt
pending
checkout_started
payment_authorized
paid
paid_mock
closed_no_send
payment_failed
payment_canceled
checkout_expired
fulfillment_started
fulfillment_submitted
printing
shipped
delivered
fulfillment_on_hold
fulfillment_failed
fulfilled_mock
failed_mock
```

### POST `/orders`

Creates a local order connected to a draft and selected generated image. The
image must have a private/mock storage key, approved moderation, and a persisted
user approval timestamp. Browser-only approval state is never trusted. Price,
currency, and total are resolved from the active server-side pricing catalog;
client-supplied `amountCents` or `currency` fields are rejected.

`quantity` defaults to 1 and is limited to 30. If `offerCode` is omitted, the
backend selects an active catalog tier whose card-count bounds include that
quantity. If it is supplied, that exact active offer must include the quantity.
The resulting unit price, total, and offer metadata are frozen in
`pricingSnapshot` on the order so later catalog edits cannot rewrite history.
`recipientAddresses`, when supplied, must contain exactly one address per
priced card. For single-address callers, `recipientAddress` is duplicated to
the frozen quantity for backward compatibility. The frontend sends the full
array for Big Sender orders so paid cards cannot be dropped at fulfillment.

When `fundingSource` is `card_bank`, each requested card is already fully paid
for by a prior card-pack purchase, including printing and standard delivery.
The order is created as `paid` with `amountCents: 0`, no payment or Checkout
session is created, no new credits are granted, and the exact card quantity is
reserved from the owner-scoped ledger in the same transaction. An insufficient
balance rolls the entire order creation back. Omit `fundingSource` or use
`checkout` to retain the direct-payment and Try Risk-Free flows.

Request:

```json
{
  "cardDraftId": "uuid",
  "selectedAssetId": "uuid",
  "fundingSource": "checkout",
  "offerCode": "try_risk_free_one_card",
  "quantity": 1,
  "recipientAddresses": [
    {
      "name": "Mock Recipient",
      "line1": "123 Local Lane",
      "city": "Toronto",
      "region": "ON",
      "postalCode": "M5V 0A1",
      "country": "CA"
    }
  ],
  "recipientAddress": {
    "name": "Mock Recipient",
    "line1": "123 Local Lane",
    "city": "Toronto",
    "region": "ON",
    "postalCode": "M5V 0A1",
    "country": "CA"
  },
  "senderAddress": {
    "name": "Mock Sender",
    "line1": "456 Dev Street",
    "city": "Toronto",
    "region": "ON",
    "postalCode": "M5V 0B2",
    "country": "CA"
  }
}
```

Response `201`:

```json
{
  "order": {
    "id": "uuid",
    "userId": "uuid",
    "cardDraftId": "uuid",
    "selectedAssetId": "uuid",
    "status": "pending",
    "offerCode": "try_risk_free_one_card",
    "amountCents": 999,
    "currency": "cad",
    "quantity": 1,
    "pricingSnapshot": {
      "catalogOfferId": "uuid",
      "offerCode": "try_risk_free_one_card",
      "name": "Try Risk-Free",
      "type": "try_risk_free",
      "unitAmountCents": 999,
      "quantity": 1,
      "totalAmountCents": 999,
      "currency": "cad",
      "creditsPerCard": 10,
      "shippingIncluded": true,
      "metadata": {
        "hold_days": 5,
        "decision_window_starts_at": "payment_authorized",
        "no_action_result": "charge_no_send_fee",
        "no_send_fee_cents": 200
      }
    },
    "checkoutSessionId": null,
    "paymentId": null,
    "fulfillmentJobId": null,
    "mockFulfillmentId": null,
    "trackingUrl": null,
    "recipientAddress": {},
    "recipientAddresses": [{}],
    "senderAddress": {},
    "qrCodeUrl": "mock://souvenote/qr/uuid",
    "createdAt": "2026-06-13T16:00:00.000Z",
    "updatedAt": "2026-06-13T16:00:00.000Z"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Order created |
| 400 | Invalid request, inactive/out-of-range offer, malformed catalog price, or selected image is not approved and moderation-cleared |
| 404 | Draft not found |

Prepaid response fields include `fundingSource: "card_bank"`,
`cardEntitlementsReservedAt`, `amountCents: 0`, `paymentId: null`, and a frozen
pricing snapshot with `printingIncluded`, `shippingIncluded`, and
`creditsPerCard: 0`.

### GET `/orders/:orderId`

Fetches one order.

Response `200`:

```json
{
  "order": {
    "id": "uuid",
    "status": "pending"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 200 | Order found |
| 404 | Order not found |

### GET `/orders`

Lists a user's orders.

Response `200`:

```json
{
  "userId": "uuid",
  "orders": []
}
```

## Checkout

### POST `/checkout/start`

Starts checkout for an owned order using the configured provider. The backend
uses only the order's frozen pricing snapshot; redirects and amounts cannot be
overridden by the request. Repeating a started attempt returns the same local
payment and provider session instead of creating another charge.

In Stripe mode, the response URL is a Stripe-hosted HTTPS Checkout page. The
Try Risk-Free offer uses manual capture and card payment methods; other current
tiers use asynchronous automatic capture. Automatic tax and promotion-code
behavior come from server environment settings.

Request:

```json
{
  "orderId": "uuid"
}
```

Response `201`:

```json
{
  "checkoutSession": {
    "id": "mock_checkout_uuid",
    "orderId": "uuid",
    "paymentId": "uuid",
    "providerMode": "mock",
    "status": "checkout_started",
    "captureMethod": "automatic_async",
    "amountCents": 999,
    "currency": "cad",
    "checkoutUrl": "mock://souvenote/checkout/mock_checkout_uuid",
    "expiresAt": "2026-06-13T16:30:00.000Z",
    "createdAt": "2026-06-13T16:00:00.000Z"
  },
  "order": {
    "id": "uuid",
    "status": "checkout_started",
    "checkoutSessionId": "mock_checkout_uuid",
    "paymentId": "uuid"
  },
  "idempotentReplay": false
}
```

Stripe mode uses a `cs_...` session ID, `providerMode: "stripe"`, a hosted
HTTPS `checkoutUrl`, and `captureMethod: "manual"` for Try Risk-Free.

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Checkout started or replayed idempotently |
| 400 | Order is not in a retryable pre-payment status |
| 409 | Active checkout/payment state is inconsistent |
| 404 | Order not found |
| 500 | Selected provider, Stripe key, or server redirect is not configured |
| 502 | Provider session creation failed; the attempt is marked failed and can be retried |

### POST `/checkout/credit-packs/start`

Starts a separate, automatic-capture checkout for one active CAD
`credit_pack` catalog offer. The browser supplies only the offer code and a
stable idempotency key; the backend freezes the price and credit quantity.

Request:

```json
{
  "offerCode": "credit_pack_creator_80",
  "idempotencyKey": "credit-cart-request-uuid"
}
```

Response `201`:

```json
{
  "checkoutSession": {
    "id": "cs_...",
    "creditPackPurchaseId": "uuid",
    "paymentId": "uuid",
    "providerMode": "stripe",
    "status": "checkout_started",
    "captureMethod": "automatic_async",
    "amountCents": 1000,
    "currency": "cad",
    "checkoutUrl": "https://checkout.stripe.com/..."
  },
  "purchase": {
    "id": "uuid",
    "offerCode": "credit_pack_creator_80",
    "status": "checkout_started",
    "amountCents": 1000,
    "currency": "cad",
    "creditAmount": 80
  },
  "idempotentReplay": false
}
```

The three launch offers are Starter (10 credits for CA$2), Creator (80 for
CA$10), and Power (250 for CA$25). A signed Stripe success event changes the
purchase to `paid` and grants the frozen credit quantity exactly once.

### POST `/checkout/credit-packs/mock-success`

Completes a started standalone purchase only in local mock checkout mode. It
validates the purchase/session pair and grants through the same idempotent
ledger path as Stripe.

```json
{
  "purchaseId": "uuid",
  "checkoutSessionId": "mock_checkout_uuid"
}
```

### POST `/checkout/card-packs/start`

Starts a durable automatic-capture checkout for one Big Sender tier. The
backend validates the quantity against the exact catalog offer, calculates the
total, and freezes both card and included-credit entitlements.

The card-pack price covers the later printing and standard delivery of every
card in the pack. Spending a card-bank entitlement therefore creates no second
card, printing, shipping, or delivery charge.

```json
{
  "offerCode": "big_sender_2_10",
  "quantity": 5,
  "idempotencyKey": "card-cart-request-uuid"
}
```

Response `201` includes `cardPackPurchaseId`, the provider session, and:

```json
{
  "purchase": {
    "id": "uuid",
    "offerCode": "big_sender_2_10",
    "status": "checkout_started",
    "amountCents": 4495,
    "currency": "cad",
    "cardAmount": 5,
    "creditAmount": 50
  }
}
```

Signed settlement grants the frozen card and credit amounts in the same
database transaction using separate idempotency keys.

### POST `/checkout/card-packs/mock-success`

Completes a started card-pack purchase only in mock provider mode. It validates
the owner and checkout session, marks the payment paid, and returns both the
updated `cardBalance` and `creditBalance`.

### POST `/checkout/mock-success`

Simulates a successful checkout and updates the order to `paid_mock`.
This route returns `403` whenever Stripe checkout mode is active.
The same transaction grants the immutable order card quantity and included AI
credits through their idempotent ledgers.

Request:

```json
{
  "orderId": "uuid",
  "checkoutSessionId": "mock_checkout_uuid"
}
```

Response `201`:

```json
{
  "checkoutSession": {
    "id": "mock_checkout_uuid",
    "orderId": "uuid",
    "paymentId": "uuid",
    "providerMode": "mock",
    "status": "paid_mock",
    "amountCents": 999,
    "currency": "cad",
    "checkoutUrl": "mock://souvenote/checkout/mock_checkout_uuid",
    "paidAt": "2026-06-13T16:00:00.000Z"
  },
  "order": {
    "id": "uuid",
    "status": "paid_mock"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Mock checkout marked paid |
| 400 | Session mismatch or order is not in `checkout_started` status |
| 403 | Mock completion is disabled in Stripe mode |
| 404 | Order not found |

### POST `/checkout/stripe/webhook`

Public only in the authentication sense: this endpoint requires the raw request
body and a valid `Stripe-Signature`. It also rejects test/live mode mismatches.
Supported events reconcile Checkout completion/expiry, asynchronous success or
failure, authorization readiness, PaymentIntent success/failure, and
cancellation. Credit-pack success also reconciles its purchase and credit
ledger in that transaction. The event ID is inserted before processing,
duplicate deliveries return success without reapplying state, and
payment/order/audit updates share one transaction.

Response `200`:

```json
{
  "received": true,
  "duplicate": false,
  "ignored": false,
  "eventId": "evt_..."
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 200 | Signed event processed, ignored safely, or already processed |
| 400 | Missing/invalid signature, wrong livemode, or reconciliation metadata mismatch |
| 500 | Stripe webhook secrets are missing |

### POST `/checkout/authorization/finalize`

Finalizes an owned Try Risk-Free Stripe authorization after the
`payment_intent.amount_capturable_updated` webhook moves the order to
`payment_authorized` and records a deadline five days after Stripe's
authorization timestamp. `send` captures the full provider-authorized total,
including Stripe-calculated tax. `not_send` captures only the immutable
`no_send_fee_cents` value in the order's pricing snapshot (or cancels when that
fee is zero), releasing the rest of the hold. Clients never submit an amount.

Request:

```json
{
  "orderId": "uuid",
  "action": "send"
}
```

Response `201` includes the updated `order`, a safe local `payment` summary,
and `idempotentReplay`. The same completed action replays safely; a conflicting
action is rejected.

When no decision is recorded by `decision_due_at`, the enabled authorization
worker leases the due payment and invokes the same `not_send` finalization.
For the launch catalog this captures a flat CA$2 and releases the remaining
hold. A five-minute lease prevents concurrent workers from racing; a stale
lease is retried with the same Stripe idempotency key.

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Authorization captured/canceled or replayed idempotently |
| 400 | Invalid action or order state |
| 403 | Endpoint unavailable outside Stripe mode |
| 409 | No actionable authorization, conflicting action, or invalid frozen fee |
| 502 | Stripe did not confirm the requested capture/cancellation |

## Fulfillment

### POST `/fulfillment/submit`

Creates a durable provider attempt for a fully paid order. Mock mode completes
locally as `fulfilled_mock`. Scribeless mode requires a `paid` Stripe order,
validates the configured recurring folded-card campaign, submits every frozen
recipient in the paid quantity, and stores only durable provider identifiers
and safe metadata.

The attempt row, order transition, and card-entitlement deduction share one
database transaction. For a card-bank-funded order, the initial reservation
was already deducted atomically when the zero-charge order was created, so the
first fulfillment attempt does not deduct it again. Insufficient entitlement
balance rolls any required retry reservation back.
A definitive local/provider rejection refunds the attempt's deduction using a
stable idempotency key and marks a prepaid reservation released. A later retry
must re-reserve the cards before it can submit again. Timeouts and
accepted-but-unreconciled responses are held without refund until provider
state is known.

The operation is idempotent while an attempt is active or successful. An
explicit provider rejection becomes `fulfillment_failed` and may be retried as
a new numbered attempt. A timeout or malformed success response becomes
`fulfillment_on_hold`/`submission_unknown`; the API will not resubmit it because
the provider may already have accepted the physical mail.

Request:

```json
{
  "orderId": "uuid"
}
```

Response `201`:

```json
{
  "fulfillment": {
    "id": "uuid",
    "orderId": "uuid",
    "userId": "uuid",
    "providerMode": "mock",
    "mockFulfillmentId": "mock_fulfillment_uuid",
    "providerFulfillmentId": "mock_fulfillment_uuid",
    "providerRecipientIds": ["mock_recipient_uuid_1"],
    "providerCampaignId": null,
    "providerStatus": "fulfilled_mock",
    "status": "fulfilled_mock",
    "attemptNumber": 1,
    "idempotencyKey": "fulfillment:order-uuid:mock:attempt:1",
    "submittedAt": "2026-06-13T16:00:00.000Z",
    "estimatedDelivery": "Mock delivery estimate: 5-7 business days.",
    "requestPayload": {},
    "responsePayload": {
      "mock": true,
      "recipientCount": 1,
      "message": "Mock fulfillment completed locally."
    },
    "createdAt": "2026-06-13T16:00:00.000Z",
    "updatedAt": "2026-06-13T16:00:00.000Z"
  },
  "order": {
    "id": "uuid",
    "status": "fulfilled_mock",
    "mockFulfillmentId": "mock_fulfillment_uuid"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Fulfillment submitted or replayed idempotently |
| 400 | Invalid order/payment state, address, approved asset bundle, or real-provider input |
| 409 | A prior submission outcome is unknown and must be reconciled before retry |
| 404 | Order not found |
| 500 | Real provider/campaign configuration is incomplete |
| 502 | Scribeless rejected the request, timed out, or returned an unsafe response |

### GET `/fulfillment/order/:orderId`

Fetches locally stored fulfillment attempts for an owned order. This endpoint
does not contact Scribeless.

Response `200`:

```json
{
  "orderId": "uuid",
  "fulfillments": [
    {
      "id": "uuid",
      "mockFulfillmentId": "mock_fulfillment_uuid",
      "providerRecipientIds": ["mock_recipient_uuid_1"],
      "status": "fulfilled_mock"
    }
  ]
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 200 | Fulfillment records found |
| 404 | No fulfillment record for the order |

### POST `/fulfillment/order/:orderId/refresh`

Polls every stored Scribeless recipient ID for the latest state and atomically
reconciles the fulfillment job and order. It never regresses progress (for
example, a later `ready` response cannot move a `shipped` order backwards).
Current provider states map to `fulfillment_submitted`, `printing`, `shipped`,
`delivered`, `fulfillment_on_hold`, or `fulfillment_failed`. Mock attempts replay
their stored terminal result without network traffic.

Response `201` has the same `fulfillment`, `order`, and `idempotentReplay` shape
as fulfillment submission.

Scribeless currently documents only QR-scan webhooks. Fulfillment status is
therefore polling-based; the API does not expose an invented tracking webhook.

## Transactional Notifications

Order notifications are durable side effects, not browser-triggered actions.
The same PostgreSQL transaction that records a paid/paid-mock order enqueues one
`order_confirmation`. A real fulfillment transition to `shipped` or
`delivered` enqueues the matching lifecycle update. Deterministic unique keys
make repeated Stripe events and Scribeless polling idempotent.

The background worker claims due rows with `FOR UPDATE SKIP LOCKED`, loads the
current owner email only for the provider call, and sends a configured SendGrid
dynamic template. The outbox stores only order ID, lifecycle state, amount,
currency, and quantity—not email, postal address, recipient/card/message
content, storage keys, signed URLs, or raw provider payloads.

Mock delivery is available outside production. SendGrid accepts a message with
HTTP `202`; an explicit retryable HTTP rejection receives bounded backoff. A
network/timeout ambiguity, stale processing claim, or provider acceptance whose
local status write cannot be proven becomes `delivery_unknown` and is not sent
again automatically.

### POST `/notifications/sendgrid/webhook`

Public provider callback that requires SendGrid's ECDSA signature over the raw
timestamp-plus-payload bytes. It accepts at most 100 events, correlates them by
the server-supplied `souvenoteNotificationId` custom argument, and deduplicates
on `sg_event_id`. Supported lifecycle events are `processed`, `deferred`,
`delivered`, `bounce`, and `dropped`; engagement events are ignored.

Response `200`:

```json
{
  "received": true,
  "processed": 1,
  "duplicates": 0,
  "ignored": 0
}
```

Only event ID, notification ID, provider message ID, normalized event type, and
event time are retained. The callback's email, reason, response text, URL,
user-agent, and raw payload are never stored. Bounce/drop audit entries contain
safe IDs and event type only. Responses use `Cache-Control: no-store`.

| Code | Meaning |
| --- | --- |
| 200 | Signed events processed, deduplicated, or safely ignored |
| 400 | Signature, raw payload, or event batch is invalid |

Cognito owns verification/password-recovery messages. Support/referral
messages are not exposed until an explicit product workflow defines their
authorization, content, and idempotency rules.

## Operations Evidence (Operations Readers Only)

### GET `/operations/orders/:orderId/evidence`

Returns a versioned, PII-minimized incident evidence bundle for one UUID-v4
order. The route requires a valid Cognito ID token whose exact
`cognito:groups` claim intersects `OPERATIONS_READER_GROUPS`. This allowlist is
separate from the moderation allowlist; customers and moderators do not gain
access implicitly.

All database reads execute sequentially inside one PostgreSQL
`BEGIN TRANSACTION READ ONLY` transaction with a five-second local statement
timeout. Every query is parameterized and selects explicit fields. Collection
queries fetch at most their cap plus one row and return `truncated=true` when
more evidence exists.

Response `200` has this stable top-level shape:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-22T12:00:00.000Z",
  "order": {
    "id": "22222222-2222-4222-8222-222222222222",
    "status": "fulfillment_on_hold",
    "offerCode": "try_risk_free_one_card",
    "quantity": 1,
    "amountCents": 999,
    "currency": "usd",
    "paymentId": "33333333-3333-4333-8333-333333333333",
    "fulfillmentJobId": "44444444-4444-4444-8444-444444444444",
    "createdAt": "2026-07-22T11:00:00.000Z",
    "updatedAt": "2026-07-22T12:00:00.000Z",
    "fulfillmentStatusUpdatedAt": "2026-07-22T12:00:00.000Z"
  },
  "payments": { "items": [], "truncated": false },
  "stripeWebhookEvents": { "items": [], "truncated": false },
  "fulfillmentAttempts": { "items": [], "truncated": false },
  "generationJobs": { "items": [], "truncated": false },
  "creditEvents": { "items": [], "truncated": false },
  "moderationJobs": { "items": [], "truncated": false },
  "notificationOutbox": { "items": [], "truncated": false },
  "notificationDeliveryEvents": { "items": [], "truncated": false },
  "publicLink": null,
  "auditEvents": { "items": [], "truncated": false }
}
```

The caps are 100 payments, 200 Stripe webhook events, 100 fulfillment
attempts, 100 generation jobs, 200 credit events, 200 moderation jobs, 200
notification intents, 200 notification delivery events, and 200 audit events.
The order's unique public-link record is either one object or `null`.

The response includes only statuses, timestamps, attempt/count fields, safe
local IDs, provider object IDs, amounts, currency, and boolean indicators that
restricted error/reason text exists. It never returns customer identity/profile
records, email, phone, addresses, creative/card/message content, storage keys,
signed URLs, provider recipient IDs, raw request/response or metadata payloads,
notification template data/callback content, error/reason text, public-link
tokens/hashes, or payment-instrument data. Responses set
`Cache-Control: private, no-store` and `X-Robots-Tag: noindex, noarchive`.

This endpoint does not expose reconciliation, correction, retry, refund,
capture, cancellation, fulfillment submission/refresh, moderation decision,
customer impersonation, or arbitrary-query capabilities. Use
`operations-runbook.md` when local and provider state disagree.

| Code | Meaning |
| --- | --- |
| 200 | Bounded order evidence returned |
| 400 | Order ID is not a UUID v4 |
| 401 | Cognito token missing or invalid |
| 403 | Caller is not in an operations-reader group |
| 404 | Order evidence not found |
| 500 | Production operations allowlist is missing/invalid, or a dependency failed |

## Gift Purchase and Redemption

`gift_souvenote_one_card` is a CAD $6.99 one-card catalog offer. Its snapshot
always includes 10 creation credits, printing, and standard delivery. Gift
checkout uses the existing card-pack payment lifecycle with `quantity: 1` and
recipient fields:

```json
{
  "offerCode": "gift_souvenote_one_card",
  "quantity": 1,
  "idempotencyKey": "gift-client-key",
  "recipientName": "Jordan",
  "recipientContact": "jordan@example.com",
  "deliveryMethod": "email",
  "personalMessage": "A little something for you."
}
```

On settlement, the one card and ten credits are granted and immediately
reserved into gift escrow in the same transaction. They never become spendable
by the purchaser. Mock completion is still
`POST /checkout/card-packs/mock-success`. Stripe card-pack webhook
reconciliation applies the same escrow rule.

- `GET /gifts` lists only gifts bought by the authenticated user.
- `GET /gifts/claim/:token` is a no-store public preview that excludes recipient
  contact and purchaser identity.
- `POST /gifts/claim/:token/redeem` requires authentication, prevents
  self-redemption, checks the intended email for email-delivered gifts, and
  atomically grants one prepaid physical send plus ten credits once.

Claim tokens are signed bearer links; PostgreSQL stores the gift UUID but not
the HMAC secret. Production requires stable secret configuration. Invitation
delivery is recorded as `mock_delivered`; no email or SMS provider is called by
this workflow yet.

## Referrals

- `GET /referrals/me` returns the authenticated user's signed personal link,
  durable invite history, program rules, and earned-credit total.
- `POST /referrals/invites` accepts `{ "email", "idempotencyKey" }`, blocks
  self-referral, deduplicates repeat invitations, and records mock delivery.
- `GET /referrals/claim/:token` publicly previews the non-PII program rules.
- `POST /referrals/claim/:token` requires a new account (at most seven days old
  and before its first physical send), enforces one attribution per account,
  and grants eight bonus credits on top of the normal two-credit signup grant,
  for ten starter credits total.

The referrer receives ten credits only when the referred account's first
fulfillment is accepted in a submitted/printing/shipped/delivered or mock-
fulfilled state. Signup alone never grants the referrer reward. All grants use
deterministic append-only credit-ledger keys.

## Public Souvenote Playback

### GET `/public/souvenotes/:token`

Resolves the stable private token embedded in a printed song QR code. The
backend stores only a SHA-256 token hash, permits links only after fulfillment
starts, increments an access counter, and returns fresh short-lived reads for
the owned approved image and song. It never exposes S3 keys, user IDs, order
IDs, provider IDs, addresses, or the link-secret material.

Response `200`:

```json
{
  "occasion": "Birthday",
  "imageUrl": "https://private-s3.example/image.png?signed=...",
  "songUrl": "https://private-s3.example/song.mp3?signed=...",
  "insideMessage": "A message for you.",
  "assetUrlExpiresInSeconds": 300
}
```

Responses include `Cache-Control: private, no-store`, `Referrer-Policy:
no-referrer`, and `X-Robots-Tag: noindex, nofollow, noarchive`.

| Code | Meaning |
| --- | --- |
| 200 | Active fulfilled Souvenote resolved |
| 404 | Token malformed, unknown, revoked, not yet fulfilled, or missing approved media |
| 500 | Private media signing configuration is unavailable |

## Local Flow Test Script

Run migrations first from `backend/`:

```bash
psql -U postgres -d souvenote_dev -f database/migrations/001_initial_schema.sql
psql -U postgres -d souvenote_dev -f database/migrations/002_phase1_mock_backend.sql
psql -U postgres -d souvenote_dev -f database/migrations/003_account_profile_payments.sql
psql -U postgres -d souvenote_dev -f database/migrations/004_s3_upload_pipeline.sql
psql -U postgres -d souvenote_dev -f database/migrations/005_generation_job_lifecycle.sql
psql -U postgres -d souvenote_dev -f database/migrations/006_asset_moderation_lifecycle.sql
psql -U postgres -d souvenote_dev -f database/migrations/007_server_authoritative_order_pricing.sql
psql -U postgres -d souvenote_dev -f database/migrations/008_stripe_checkout_lifecycle.sql
psql -U postgres -d souvenote_dev -f database/migrations/009_scribeless_fulfillment_lifecycle.sql
psql -U postgres -d souvenote_dev -f database/migrations/010_public_card_links.sql
psql -U postgres -d souvenote_dev -f database/migrations/011_transactional_notifications.sql
psql -U postgres -d souvenote_dev -f database/migrations/012_canadian_pricing_and_credit_packs.sql
psql -U postgres -d souvenote_dev -f database/migrations/013_card_entitlement_ledger.sql
psql -U postgres -d souvenote_dev -f database/migrations/014_card_pack_purchases.sql
psql -U postgres -d souvenote_dev -f database/migrations/015_prepaid_card_delivery.sql
psql -U postgres -d souvenote_dev -f database/migrations/016_gifts_and_referrals.sql
psql -U postgres -d souvenote_dev -f database/seeds/001_pricing_catalog.sql
```

If the first migration and seed data are already applied, the Phase 1 migration can also be applied from `backend/server/`:

```bash
npm run db:migrate:phase1
```

Start the backend from `backend/server/`:

```bash
npm run start:dev
```

In another terminal from `backend/server/`:

```bash
npm run test:mock-flow
```

The script seeds a local mock user, grants credits, creates a draft, creates a mock upload, starts generation, fetches review assets, creates an order, starts checkout, simulates checkout success, submits fulfillment, and verifies two clear error cases.
