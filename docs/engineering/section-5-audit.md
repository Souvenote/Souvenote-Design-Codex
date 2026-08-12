# Section 5 checkout and fulfillment mocks audit

Audited: 2026-08-12

Branch: `codex/section-5-checkout-fulfillment-mocks`

Base: `44a91a2146e69f0c91a86e1ebb093e4ec457b064`

Status: implementation, local functional gate, draft PR #11, and exact-head CI complete. The in-app browser runtime was unavailable during final acceptance, so this audit does not claim responsive visual evidence.

## Scope and authority

Section 5 replaces direct local payment mutations and the Delivery placeholder with server-authoritative hosted-checkout sessions, exact-once payment reconciliation, payment-linked entitlements, and deterministic typed fulfillment. It does not activate Stripe traffic, Scribeless traffic, AWS, email, analytics, or production features.

The build plan requires Stripe test components in Section 5 but separately gates Stripe test activation in Section 7. The reconciled Section 4 handoff resolves that boundary as a Stripe-compatible hosted redirect and webhook contract in deterministic local/test mode. Real Stripe SDK/components and test traffic remain the separately approved provider-activation step.

## Acceptance matrix

| Requirement               | Result                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw payment data boundary | Pass                          | The checkout request accepts only an order ID or catalog credit-pack code. The local hosted-checkout screen has no card-number, expiry, CVC, CVV, or payment-method input. A negative API integration fixture proves unknown raw-card fields are rejected.                                                                                                                                                             |
| Server-owned CAD totals   | Pass                          | Order and credit-pack repositories select active Canada/CAD catalog rows and snapshot integer minor-unit totals. Checkout never accepts caller amount, currency, credits, or entitlement quantity.                                                                                                                                                                                                                     |
| Hosted checkout lifecycle | Pass                          | Owner-scoped `checkout_sessions` persist one physical-order or credit-pack target, provider identity, collection mode, amount, expiry, status, request hash, and idempotency key. Deterministic local/test redirects use the same domain boundary intended for a later Stripe adapter.                                                                                                                                 |
| Credit-pack capture       | Pass                          | The old immediate-capture route fails closed. Hosted completion captures the selected 10/CAD $2, 80/CAD $10, or 250/CAD $25 pack and grants its credits once through the ledger, including concurrent duplicate completion.                                                                                                                                                                                            |
| Try Risk-Free             | Pass                          | A completed one-card checkout creates the five-day CAD $9.99 authorization, one physical entitlement, and ten provisional credits. Fulfillment captures CAD $9.99; deadline resolution captures fixed CAD $2 and releases CAD $7.99 exactly once.                                                                                                                                                                      |
| Big Sender                | Pass                          | Quantities 2-30 select the server tier, capture the exact total, grant the purchased card entitlement, and consume the required quantity on fulfillment.                                                                                                                                                                                                                                                               |
| Verified webhooks         | Pass                          | Existing signature verification now feeds durable hash-only receipts, idempotent claim/process/ignore/fail states, stale/failed recovery, Stripe-compatible checkout reconciliation, and Scribeless state reconciliation. Raw request bodies are not stored.                                                                                                                                                           |
| Fulfillment adapter       | Pass                          | `DeterministicScribelessAdapter` accepts a versioned typed payload containing order identity, artwork/message asset keys and hashes, QR metadata, Canadian recipient/sender addresses, and idempotency identity. It makes no network call; persisted jobs contain hashes and provider IDs only.                                                                                                                        |
| Fulfillment recovery      | Pass                          | Jobs move through queued, submitting, retryable failure, submitted, and accepted states. Duplicate submission is idempotent, provider failure is retryable, and verified webhook states reconcile forward.                                                                                                                                                                                                             |
| Blank-card handoff        | Pass                          | A local/test feature flag permits only a one-card Try Risk-Free order, consumes that entitlement, records the handoff, and sends a typed blank variant with no artwork, inside message, or QR payload. Production remains disabled pending final print payload approval.                                                                                                                                               |
| Database integrity        | Pass                          | Additive migration `0005_checkout_fulfillment_mocks.sql` is checksum-journaled. Database functions row-lock exact-once reconciliation, constraints enforce lifecycle/targets/currency, and clean/repeat/tamper verification passes. Migrations 0001-0004 were not edited.                                                                                                                                              |
| Web journey               | Pass with evidence limitation | Delivery creates the order and hosted checkout from an approved backend draft, the simulator reconciles payment and fulfillment, and confirmation reports only local deterministic state. Multi-address and scheduled sends fail visibly instead of discarding unsupported input. Type, lint, route generation, and production build pass; interactive desktop/mobile browser evidence is unavailable in this session. |
| No external action        | Pass                          | No AWS mutation, Stripe request, Scribeless request, payment, physical print/mail, email, analytics, deployment, or paid-provider traffic occurred. External-service cost is CAD $0 / USD $0.                                                                                                                                                                                                                          |

## Concurrency, failure, and recovery evidence

The disposable PostgreSQL/API gate verifies:

- concurrent checkout completion grants one credit-pack ledger entry;
- duplicate completion with the same provider payment ID is a no-op and a conflicting payment ID is rejected;
- one-card Try Risk-Free authorization/payment/order state remains synchronized through fulfillment and deadline resolution;
- Big Sender capture and entitlement consumption use exact server-owned quantities;
- blank-card handoff is one-per-order/entitlement and feature-gated;
- invalid webhook signatures fail before receipt processing;
- duplicate provider event IDs cannot reconcile twice, while conflicting payload hashes are rejected;
- failed webhook events can be claimed and reconciled again after the underlying state is recoverable;
- fulfillment provider failure records a retryable state and bounded retry resumes the same job.

## Security and privacy review

- Authentication/default deny, BFF CSRF, owner scoping, bounded idempotency keys, rate limits, sanitized request logging, and exact-origin policy remain intact.
- Customer/user identity is derived from the authenticated request, never checkout input.
- Raw payment-card fields do not exist in application checkout DTOs, adapters, persistence, or logs. The one `cardNumber` value in the API integration test is a deliberate rejected-input fixture.
- Provider request/response bodies are not persisted. Fulfillment stores SHA-256 hashes, safe provider IDs, state, attempts, and sanitized error categories.
- Recipient/sender addresses remain owner-scoped order data and are not logged or sent to analytics.
- Provider modes and blank-card handoff fail closed outside development/test deterministic mode.

## Deferred behavior and risks

- Real Stripe test components/SDK traffic and real Scribeless sandbox traffic remain Section 7 provider activations. Production Try Risk-Free also requires legal approval.
- Final Scribeless dimensions, bleed, safe area, color profile, DPI, and blank-card payload remain explicit Section 8 launch gates.
- The current physical order contract supports one recipient address with quantity 1-30. Delivery blocks the existing multi-address UI rather than silently using one address; a reviewed recipient-array/order-line contract is still required for different addresses in one Big Sender checkout.
- Scheduled mailing is not represented in the Section 5 provider contract and is visibly blocked.
- The normal preserved local PostgreSQL volume contains the previously documented unpublished migration-0002 checksum mismatch. It was not reset. Section 5 database evidence uses clean disposable PostgreSQL 16 and passes.
- The in-app browser runtime returned no available browser instance. Visual desktop/mobile acceptance must be repeated when that runtime is available.

## Rollback

Before migration 0005 reaches any shared database, revert the Section 5 commit. After a shared apply, never edit migration 0005; use a reviewed forward migration. Runtime rollback is immediate by setting payment and fulfillment provider modes to disabled and leaving production feature flags false.
