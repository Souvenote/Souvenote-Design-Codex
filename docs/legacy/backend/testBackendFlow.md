# Souvenote Swagger Demo Flow

This document shows the full local backend demo flow using Swagger.

Base URL:

```txt
http://localhost:4000/api/docs
```

Test user:

```txt
ad2c7c0f-797f-4bc2-b103-91a1fc61ddef
```

Important: replace IDs as they are returned during the demo. Do not leave placeholders like `PASTE_IMAGE_ASSET_ID_HERE` in request bodies.

---

# 1. Health Check

## Endpoint

```txt
GET /api/health
```

## Purpose

Confirms the backend is running and connected to PostgreSQL.

## Expected Result

```json
{
  "status": "ok",
  "service": "souvenote-backend",
  "database": "connected",
  "timestamp": "..."
}
```

---

# 2. Pricing Catalog

## Endpoint

```txt
GET /api/pricing
```

## Purpose

Confirms the backend can read pricing offers from PostgreSQL.

## Expected Result

Should return pricing offers such as:

```txt
try_risk_free_one_card
big_sender_2_10
big_sender_11_20
big_sender_21_30
```

---

# 3. Check Starting Credit Balance

## Endpoint

```txt
GET /api/credits/balance/{userId}
```

## Example

```txt
GET /api/credits/balance/ad2c7c0f-797f-4bc2-b103-91a1fc61ddef
```

## Purpose

Checks the user’s current credit balance before starting generation.

---

# 4. Grant Test Credits

## Endpoint

```txt
POST /api/credits/grant
```

## Purpose

Adds credits to the test user for the local demo.

## Body

```json
{
  "userId": "ad2c7c0f-797f-4bc2-b103-91a1fc61ddef",
  "amount": 5,
  "source": "local_full_flow_test",
  "idempotencyKey": "local-full-flow-grant-001"
}
```

## Notes

Use a new `idempotencyKey` each time this is tested.

Example alternatives:

```txt
local-full-flow-grant-002
local-full-flow-grant-003
```

---

# 5. Create Card Draft

## Endpoint

```txt
POST /api/card-drafts
```

## Purpose

Creates a card draft that the generation, upload, order, checkout, and fulfillment flow can attach to.

## Body

```json
{
  "userId": "ad2c7c0f-797f-4bc2-b103-91a1fc61ddef",
  "occasion": "birthday",
  "relationship": "friend",
  "creativeBrief": {
    "cardType": "personalized_template",
    "tone": "funny and heartfelt",
    "recipientName": "Alex",
    "details": "They love basketball, coffee, and inside jokes",
    "messageGoal": "Make them feel appreciated and laugh a little"
  }
}
```

## Save This Value

Copy the returned card draft ID.

Example:

```txt
cardDraftId = a15cea95-1043-4ecf-9350-83911fc35651
```

---

# 6. Confirm Drafts for User

## Endpoint

```txt
GET /api/card-drafts/user/{userId}
```

## Example

```txt
GET /api/card-drafts/user/ad2c7c0f-797f-4bc2-b103-91a1fc61ddef
```

## Purpose

Confirms the draft is saved and attached to the user.

---

# 7. Confirm One Draft by ID

## Endpoint

```txt
GET /api/card-drafts/{draftId}
```

## Example

```txt
GET /api/card-drafts/a15cea95-1043-4ecf-9350-83911fc35651
```

## Purpose

Confirms the specific draft can be retrieved.

---

# 8. Mock Upload

## Endpoint

```txt
POST /api/uploads/mock
```

## Purpose

Creates a mock uploaded image asset attached to the card draft. This simulates a user uploading a photo before real S3 signed uploads are connected.

## Body

```json
{
  "userId": "ad2c7c0f-797f-4bc2-b103-91a1fc61ddef",
  "cardDraftId": "a15cea95-1043-4ecf-9350-83911fc35651",
  "filename": "birthday.png",
  "mimeType": "image/png",
  "size": 1200000
}
```

## Expected Result

The response should include an uploaded asset.

Important values:

```txt
asset.assetType = upload
asset.id = uploaded asset ID
upload.status = uploaded
attestationAccepted = true
```

Example uploaded asset ID:

```txt
aff349a5-7fd1-42cc-845b-24be5936260d
```

## Note

This uploaded asset is the user’s input photo. It is not the final generated card image.

---

# 9. Start Mock Generation

## Endpoint

```txt
POST /api/generation/start
```

## Purpose

Starts the mock AI generation flow.

This should:

```txt
Deduct 2 credits
Create a generation job
Save generated image/song/message assets
Return updated balance
```

## Body

```json
{
  "userId": "ad2c7c0f-797f-4bc2-b103-91a1fc61ddef",
  "cardDraftId": "a15cea95-1043-4ecf-9350-83911fc35651",
  "idempotencyKey": "local-full-flow-generation-001"
}
```

## Notes

Use a new `idempotencyKey` each time.

Example alternatives:

```txt
local-full-flow-generation-002
local-full-flow-generation-003
```

## Expected Result

The response should include:

```txt
generationJob
savedAssets
mockAssets
creditDeduction
balance
```

The saved assets should include:

```txt
image
song
message
```

---

# 10. Fetch Assets by Card Draft

## Endpoint

```txt
GET /api/assets/card-draft/{cardDraftId}
```

## Example

```txt
GET /api/assets/card-draft/a15cea95-1043-4ecf-9350-83911fc35651
```

## Purpose

Gets all assets connected to a card draft.

## Expected Result

The response should include:

```txt
upload
image
song
message
```

## Important Demo Step

Find the generated asset where:

```txt
asset_type = image
```

Copy its `id`.

Example:

```txt
selectedAssetId = d80e0661-2832-4e85-a622-e4b5359bce13
```

This is the asset ID that should be used when creating the order.

Do not use the upload asset ID for the order unless the goal is to print the uploaded photo directly. The order should normally use the generated image asset.

---

# 11. Create Order

## Endpoint

```txt
POST /api/orders
```

## Purpose

Creates a physical card order using the selected generated image asset.

## Body

```json
{
  "userId": "ad2c7c0f-797f-4bc2-b103-91a1fc61ddef",
  "cardDraftId": "a15cea95-1043-4ecf-9350-83911fc35651",
  "selectedAssetId": "d80e0661-2832-4e85-a622-e4b5359bce13",
  "recipientAddress": {
    "name": "Alex Smith",
    "line1": "123 Main St",
    "city": "Toronto",
    "region": "ON",
    "postalCode": "M1M 1M1",
    "country": "CA"
  },
  "senderAddress": {
    "name": "Samuel Mathew",
    "line1": "456 Sender St",
    "city": "Waterloo",
    "region": "ON",
    "postalCode": "N2L 1A1",
    "country": "CA"
  }
}
```

## Save This Value

Copy the returned order ID.

Example:

```txt
orderId = 270d3f5d-6eea-4a64-ad3d-1f817093fe8b
```

## Expected Result

The response should include:

```txt
order.status = pending
offerCode = try_risk_free_one_card
amountCents = 999
qrCodeUrl = mock://souvenote/qr/{selectedAssetId}
```

---

# 12. Start Mock Checkout

## Endpoint

```txt
POST /api/checkout/start
```

## Purpose

Starts the mock checkout flow for the order.

## Body

```json
{
  "orderId": "270d3f5d-6eea-4a64-ad3d-1f817093fe8b"
}
```

## Important Note

Do not include `userId` or `offerCode` in this request if the current DTO does not allow them. The order already stores those values.

## Expected Result

The response should include:

```txt
checkoutSession
order
```

Expected status:

```txt
checkoutSession.status = checkout_started
order.status = checkout_started
```

The response should also include:

```txt
paymentId
checkoutSessionId
checkoutUrl
```

---

# 13. Mark Mock Checkout as Paid

## Current Local Demo Requirement

Right now, the backend does not yet have a mock endpoint to complete checkout.

Because of that, the order must be manually marked as paid in PostgreSQL before fulfillment can run.

## Why This Is Needed

The local flow currently does this:

```txt
Start checkout
↓
Order status becomes checkout_started
```

But fulfillment requires:

```txt
Order status = paid_mock
```

In the real app, Stripe will do this through a webhook.

Real future flow:

```txt
User pays in Stripe
↓
Stripe webhook calls backend
↓
Backend updates order to paid
↓
Fulfillment can submit to Scribeless
```

In local mock mode, we simulate that with SQL.

## SQL

Run this in pgAdmin or psql:

```sql
UPDATE orders
SET status = 'paid_mock',
    updated_at = NOW()
WHERE id = '270d3f5d-6eea-4a64-ad3d-1f817093fe8b';
```

## Confirm

```sql
SELECT id, status, payment_id, checkout_session_id
FROM orders
WHERE id = '270d3f5d-6eea-4a64-ad3d-1f817093fe8b';
```

Expected:

```txt
status = paid_mock
```

## Future Cleanup

Add a mock checkout completion endpoint later:

```txt
POST /api/checkout/mock-complete
```

Suggested body:

```json
{
  "orderId": "270d3f5d-6eea-4a64-ad3d-1f817093fe8b"
}
```

That endpoint should update the order to:

```txt
paid_mock
```

This will remove the need for manual SQL during demos.

---

# 14. Submit Mock Fulfillment

## Endpoint

```txt
POST /api/fulfillment/submit
```

## Purpose

Submits the paid mock order to mock fulfillment.

## Body

```json
{
  "orderId": "270d3f5d-6eea-4a64-ad3d-1f817093fe8b"
}
```

## Expected Result

The response should include:

```txt
fulfillment
order
```

Expected values:

```txt
fulfillment.status = fulfilled_mock
fulfillment.providerMode = mock
order.status = fulfilled_mock
order.fulfillmentJobId = returned fulfillment ID
order.mockFulfillmentId = returned mock fulfillment ID
```

---

# 15. Optional Database Verification

After the full flow, run these checks in pgAdmin or psql.

## Credit Ledger

```sql
SELECT event_type, amount, source, idempotency_key, created_at
FROM credit_ledger
WHERE user_id = 'ad2c7c0f-797f-4bc2-b103-91a1fc61ddef'
ORDER BY created_at DESC;
```

Expected:

```txt
manual grant entry
generation deduction entry
```

## Card Drafts

```sql
SELECT id, user_id, occasion, relationship, status, created_at
FROM card_drafts
WHERE user_id = 'ad2c7c0f-797f-4bc2-b103-91a1fc61ddef'
ORDER BY created_at DESC;
```

Expected:

```txt
created card draft
```

## Uploads

```sql
SELECT id, user_id, card_draft_id, asset_id, filename, status, attestation_accepted, uploaded_at
FROM upload_requests
WHERE user_id = 'ad2c7c0f-797f-4bc2-b103-91a1fc61ddef'
ORDER BY created_at DESC;
```

Expected:

```txt
uploaded mock upload request
```

## Generation Jobs

```sql
SELECT id, user_id, card_draft_id, image_status, song_status, message_status, provider_mode, credits_charged, created_at
FROM generation_jobs
WHERE user_id = 'ad2c7c0f-797f-4bc2-b103-91a1fc61ddef'
ORDER BY created_at DESC;
```

Expected:

```txt
mock generation job
```

## Assets

```sql
SELECT id, user_id, card_draft_id, generation_job_id, asset_type, s3_key, moderation_state, created_at
FROM assets
WHERE user_id = 'ad2c7c0f-797f-4bc2-b103-91a1fc61ddef'
ORDER BY created_at DESC;
```

Expected:

```txt
upload asset
image asset
song asset
message asset
```

## Orders

```sql
SELECT id, user_id, card_draft_id, selected_asset_id, status, checkout_session_id, payment_id, fulfillment_job_id, mock_fulfillment_id, created_at
FROM orders
WHERE user_id = 'ad2c7c0f-797f-4bc2-b103-91a1fc61ddef'
ORDER BY created_at DESC;
```

Expected:

```txt
fulfilled_mock order
```

## Fulfillment Jobs

```sql
SELECT id, order_id, user_id, provider_mode, mock_fulfillment_id, status, submitted_at, estimated_delivery, created_at
FROM fulfillment_jobs
WHERE user_id = 'ad2c7c0f-797f-4bc2-b103-91a1fc61ddef'
ORDER BY created_at DESC;
```

Expected:

```txt
fulfilled_mock fulfillment job
```

---

# Successful Demo Criteria

The local backend demo passes if the following are true:

```txt
Health endpoint works
Pricing loads from database
Credits can be granted
Card draft can be created
Mock upload creates an uploaded asset
Mock generation deducts credits
Mock generation creates a generation job
Mock generation saves image/song/message assets
Assets can be fetched by card draft ID
Order can be created using generated image asset
Mock checkout starts and updates order
Order can be marked paid_mock locally
Mock fulfillment submits successfully
Order ends with fulfilled_mock status
Database rows exist for each major step
```

---

# Current Known Demo Limitation

The only manual step in the current demo is:

```txt
Marking checkout as paid_mock with SQL
```

This exists because the mock checkout does not yet have a completion endpoint.

Recommended next backend improvement:

```txt
POST /api/checkout/mock-complete
```

This would let Swagger complete the demo without manually editing the database.
