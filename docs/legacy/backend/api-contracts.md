> [!WARNING]
> Historical and non-authoritative. Do not run these commands or copy these APIs, identity fields, money values, or mock-success behavior. Start with `docs/legacy/README.md` and the current durable sources.

# Souvenote Backend API Contracts

Base URL in local development:

```txt
http://localhost:4000/api
```

Swagger is also available locally:

```txt
http://localhost:4000/api/docs
```

## Phase 1 Mock Rules

Phase 1 is fully local. These endpoints do not call AWS S3, Stripe, Scribeless, fal.ai, or any live third-party API.

Future service mapping:

| Phase 1 area | Current behavior | Phase 2 replacement |
| --- | --- | --- |
| Uploads | Stores metadata in PostgreSQL and returns `mock://` URLs | AWS S3 signed uploads |
| Generation | Creates mock generation jobs and assets | fal.ai image/music plus real provider asset storage |
| Checkout | Creates mock payment rows and mock checkout sessions | Stripe Checkout and webhooks |
| Fulfillment | Creates local fulfillment records | Scribeless fulfillment jobs and webhooks |

Common error shape from Nest:

```json
{
  "message": "Card draft not found.",
  "error": "Not Found",
  "statusCode": 404
}
```

## Full Local Flow

1. `POST /card-drafts`
2. Optional `POST /uploads/mock`
3. `POST /generation/start`
4. `GET /assets/card-draft/:cardDraftId`
5. `POST /orders`
6. `POST /checkout/start`
7. `POST /checkout/mock-success`
8. `POST /fulfillment/submit`

## Health

### GET `/health`

Checks API and database connectivity.

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
| 500 | Database connection or server startup problem |

## Drafts

### POST `/card-drafts`

Creates a local card draft.

Request:

```json
{
  "userId": "uuid",
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
| 500 | `userId` does not map to an existing local user or database error |

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

### GET `/card-drafts/user/:userId`

Lists active drafts for a user.

Response `200`:

```json
{
  "userId": "uuid",
  "cardDrafts": []
}
```

## Mock Uploads

### POST `/uploads/mock`

Immediate local mock upload. This is the easiest Phase 1 endpoint for frontend integration.

Request:

```json
{
  "userId": "uuid",
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
| 404 | Draft not found for that user |

### POST `/uploads/request`

Creates a local stand-in for a future signed upload request.

Request:

```json
{
  "userId": "uuid",
  "cardDraftId": "uuid",
  "filename": "photo.png",
  "contentType": "image/png",
  "fileSizeBytes": 12345
}
```

Response `201`:

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
    "status": "requested",
    "attestationAccepted": false,
    "uploadedAt": null,
    "mockUrl": "mock://souvenote/uploads/mock/uuid/photo.png",
    "storageKey": "mock/uuid/photo.png",
    "mockUploadUrl": "mock://souvenote/uploads/mock/uuid/photo.png",
    "mockKey": "mock/uuid/photo.png",
    "expiresAt": "2026-06-13T16:15:00.000Z"
  }
}
```

### POST `/uploads/commit`

Commits an upload request and creates a reviewable `upload` asset.

Request:

```json
{
  "userId": "uuid",
  "cardDraftId": "uuid",
  "s3Key": "mock/uuid/photo.png",
  "attestationAccepted": true
}
```

Response `201`:

```json
{
  "upload": {
    "id": "uuid",
    "status": "uploaded",
    "mockUrl": "mock://souvenote/uploads/mock/uuid/photo.png"
  },
  "asset": {
    "id": "uuid",
    "assetType": "upload",
    "mockUrl": "mock://souvenote/mock/uuid/photo.png"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Upload committed |
| 400 | Attestation was not accepted |
| 404 | Upload request or draft not found |

## Mock Generation

### POST `/generation/start`

Starts local mock generation, deducts credits, creates a `generation_jobs` row, and saves three generated assets.

Request:

```json
{
  "userId": "uuid",
  "cardDraftId": "uuid",
  "idempotencyKey": "draft-uuid-generation-1"
}
```

Response `201`:

```json
{
  "generationJob": {
    "id": "uuid",
    "user_id": "uuid",
    "card_draft_id": "uuid",
    "image_status": "ready",
    "song_status": "ready",
    "message_status": "ready",
    "provider_mode": "mock",
    "credits_charged": 2,
    "created_at": "2026-06-13T16:00:00.000Z",
    "updated_at": "2026-06-13T16:00:00.000Z"
  },
  "savedAssets": [
    {
      "id": "uuid",
      "asset_type": "image",
      "s3_key": "mock/card-image.png",
      "moderation_state": "approved_mock"
    }
  ],
  "mockAssets": {
    "image": {
      "status": "ready",
      "mockUrl": "mock://souvenote/card-image.png"
    },
    "song": {
      "status": "ready",
      "mockUrl": "mock://souvenote/song.mp3"
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
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Mock generation completed and assets saved |
| 400 | Insufficient credits or validation error |
| 404 | Draft not found for that user |

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
      "moderationState": "approved_mock",
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

## Orders

Order status values:

```txt
pending
checkout_started
paid_mock
fulfillment_started
fulfilled_mock
failed_mock
```

### POST `/orders`

Creates a local order connected to a draft and selected generated/upload asset.

Request:

```json
{
  "userId": "uuid",
  "cardDraftId": "uuid",
  "selectedAssetId": "uuid",
  "offerCode": "try_risk_free_one_card",
  "amountCents": 999,
  "currency": "usd",
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
    "currency": "usd",
    "checkoutSessionId": null,
    "paymentId": null,
    "fulfillmentJobId": null,
    "mockFulfillmentId": null,
    "trackingUrl": null,
    "recipientAddress": {},
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
| 400 | Invalid request body |
| 404 | Draft or selected asset not found |

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

### GET `/orders/user/:userId`

Lists a user's orders.

Response `200`:

```json
{
  "userId": "uuid",
  "orders": []
}
```

## Mock Checkout

### POST `/checkout/start`

Starts local mock checkout for a pending order.

Request:

```json
{
  "orderId": "uuid",
  "successUrl": "http://localhost:3000/checkout/success",
  "cancelUrl": "http://localhost:3000/checkout/cancel"
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
    "amountCents": 999,
    "currency": "usd",
    "checkoutUrl": "mock://souvenote/checkout/mock_checkout_uuid",
    "successUrl": "http://localhost:3000/checkout/success",
    "cancelUrl": "http://localhost:3000/checkout/cancel",
    "createdAt": "2026-06-13T16:00:00.000Z"
  },
  "order": {
    "id": "uuid",
    "status": "checkout_started",
    "checkoutSessionId": "mock_checkout_uuid",
    "paymentId": "uuid"
  }
}
```

Status codes:

| Code | Meaning |
| --- | --- |
| 201 | Mock checkout started |
| 400 | Order is not in `pending` status |
| 404 | Order not found |

### POST `/checkout/mock-success`

Simulates a successful checkout and updates the order to `paid_mock`.

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
    "currency": "usd",
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
| 404 | Order not found |

## Mock Fulfillment

### POST `/fulfillment/submit`

Submits a paid mock order to local mock fulfillment. Because there is no async provider in Phase 1, this moves the order through `fulfillment_started` and then completes immediately as `fulfilled_mock`.

Request:

```json
{
  "orderId": "uuid",
  "estimatedDelivery": "Mock delivery estimate: 5-7 business days."
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
    "status": "fulfilled_mock",
    "submittedAt": "2026-06-13T16:00:00.000Z",
    "estimatedDelivery": "Mock delivery estimate: 5-7 business days.",
    "requestPayload": {},
    "responsePayload": {
      "mock": true,
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
| 201 | Mock fulfillment submitted and completed |
| 400 | Order is not in `paid_mock` status |
| 400 | Mock fulfillment insert failed and the order was marked `failed_mock` |
| 404 | Order not found |

### GET `/fulfillment/order/:orderId`

Fetches fulfillment records for an order.

Response `200`:

```json
{
  "orderId": "uuid",
  "fulfillments": [
    {
      "id": "uuid",
      "mockFulfillmentId": "mock_fulfillment_uuid",
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

## Local Flow Test Script

Run migrations first from `backend/`:

```bash
psql -U postgres -d souvenote_dev -f database/migrations/001_initial_schema.sql
psql -U postgres -d souvenote_dev -f database/migrations/002_phase1_mock_backend.sql
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
