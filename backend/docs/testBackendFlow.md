# Souvenote Authenticated Mock Flow

This runbook verifies the local Phase 1 flow through the protected API.

## Prerequisites

- Apply database migrations `001` through `016` plus the pricing seed.
- Configure PostgreSQL and Cognito in `backend/server/.env.local`.
- Set `AI_MOCK_MODE=true`.
- Set `UPLOAD_PROVIDER_MODE=mock` for this no-network runbook.
- Set `GENERATION_PROVIDER_MODE=mock`.
- Set `CHECKOUT_PROVIDER_MODE=mock`.
- Set `FULFILLMENT_PROVIDER_MODE=mock`.
- Set `NOTIFICATION_PROVIDER_MODE=mock` and
  `NOTIFICATION_WORKER_ENABLED=false` for this request-driven flow.
- Start the backend with `npm run start:dev`.
- Obtain a current Cognito ID token for the test account.

This runbook deliberately stays in mock mode and makes no Fal or S3 calls. See
`env-vars.md` for the real-provider settings and security constraints.
Use `operations-runbook.md` for credentialed staging, incident response,
provider ambiguity, and secret rotation; do not apply mock recovery steps to a
real payment or physical-mail outcome.

Swagger is available at `http://localhost:4000/api/docs`. Click **Authorize**
and enter the Cognito ID token. Health and pricing are public; every other
endpoint uses the authenticated user derived from the token. Never send a
`userId` in a request URL or body.

## Manual Swagger Flow

Use a new idempotency key for each run and carry the returned IDs into later
steps.

1. Confirm public services:

   ```txt
   GET /api/health
   GET /api/pricing
   ```

2. Provision or load the authenticated local user:

   ```txt
   GET /api/auth/me
   ```

3. Add local mock credits and confirm the ledger balance:

   ```txt
   POST /api/credits/mock-purchase
   GET /api/credits/balance
   ```

   ```json
   {
     "amount": 10,
     "idempotencyKey": "local-full-flow-credit-001"
   }
   ```

4. Create a card draft:

   ```txt
   POST /api/card-drafts
   ```

   ```json
   {
     "occasion": "Birthday",
     "relationship": "Friend",
     "creativeBrief": {
       "tone": "warm",
       "insideMessage": "Make this feel personal and joyful."
     }
   }
   ```

5. Create a mock upload using the returned `cardDraft.id`:

   ```txt
   POST /api/uploads/mock
   ```

   ```json
   {
     "cardDraftId": "PASTE_CARD_DRAFT_ID",
     "filename": "birthday.png",
     "mimeType": "image/png",
     "size": 1200000
   }
   ```

6. Run mock generation:

   ```txt
   POST /api/generation/start
   ```

   ```json
   {
     "cardDraftId": "PASTE_CARD_DRAFT_ID",
     "idempotencyKey": "local-full-flow-generation-001"
   }
   ```

7. Fetch review assets and copy the generated image, song, and message asset
   IDs:

   ```txt
   GET /api/assets/card-draft/PASTE_CARD_DRAFT_ID
   ```

8. Persist review approval for the generated assets:

   ```txt
   POST /api/assets/card-draft/PASTE_CARD_DRAFT_ID/approve
   ```

   ```json
   {
     "assetIds": [
       "PASTE_IMAGE_ASSET_ID",
       "PASTE_SONG_ASSET_ID",
       "PASTE_MESSAGE_ASSET_ID"
     ]
   }
   ```

   The mock assets are moderation-cleared as `approved_mock`. A real generated
   image or song remains ineligible while its moderation state is `pending`.

9. Create the physical-card order using the approved generated image:

   ```txt
   POST /api/orders
   ```

   ```json
   {
     "cardDraftId": "PASTE_CARD_DRAFT_ID",
     "selectedAssetId": "PASTE_IMAGE_ASSET_ID",
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

10. Start and complete mock checkout:

   ```txt
   POST /api/checkout/start
   POST /api/checkout/mock-success
   ```

   Start body:

   ```json
   {
     "orderId": "PASTE_ORDER_ID"
   }
   ```

   Completion body:

   ```json
   {
     "orderId": "PASTE_ORDER_ID",
     "checkoutSessionId": "PASTE_CHECKOUT_SESSION_ID"
   }
   ```

11. Submit and inspect mock fulfillment:

    ```txt
    POST /api/fulfillment/submit
    GET /api/fulfillment/order/PASTE_ORDER_ID
    ```

    ```json
    {
      "orderId": "PASTE_ORDER_ID"
    }
    ```

The final order status should be `fulfilled_mock`.

## Automated Flow

Set `MOCK_FLOW_COGNITO_ID_TOKEN` in `backend/server/.env.local`, then run:

```powershell
npm run test:mock-flow
```

The script executes the same authenticated sequence, verifies expected error
cases, and requires no direct database writes.
