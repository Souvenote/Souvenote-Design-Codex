# Section 5 checkout and fulfillment mocks audit

Audited: 2026-08-12

Branch: `codex/section-5-checkout-fulfillment-mocks`

Base: `44a91a2146e69f0c91a86e1ebb093e4ec457b064`

Status: implementation, hardening, and responsive acceptance are complete on draft PR #11. Full local verification, database verification, disposable-stack smoke, dependency audit, and authenticated desktop and 390px browser journeys pass.

## Scope and authority

Section 5 replaces direct local payment mutations and the Delivery placeholder with server-authoritative hosted-checkout sessions, exact-once payment reconciliation, payment-linked entitlements, and deterministic typed fulfillment. It does not activate Stripe traffic, Scribeless traffic, AWS, email, analytics, or production features.

The build plan requires Stripe test components in Section 5 but separately gates Stripe test activation in Section 7. The reconciled Section 4 handoff resolves that boundary as a Stripe-compatible hosted redirect and webhook contract in deterministic local/test mode. Real Stripe SDK/components and test traffic remain the separately approved provider-activation step.

## Acceptance matrix

| Requirement               | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw payment data boundary | Pass   | The checkout request accepts only an order ID or catalog credit-pack code. The local hosted-checkout screen has no card-number, expiry, CVC, CVV, or payment-method input. A negative API integration fixture proves unknown raw-card fields are rejected.                                                                                                                            |
| Server-owned CAD totals   | Pass   | Order and credit-pack repositories select active Canada/CAD catalog rows and snapshot integer minor-unit totals. Checkout never accepts caller amount, currency, credits, or entitlement quantity.                                                                                                                                                                                    |
| Hosted checkout lifecycle | Pass   | Owner-scoped `checkout_sessions` persist one physical-order or credit-pack target, provider identity, collection mode, amount, expiry, status, request hash, and idempotency key. Deterministic local/test redirects use the same domain boundary intended for a later Stripe adapter.                                                                                                |
| Credit-pack capture       | Pass   | The old immediate-capture route fails closed. Hosted completion captures the selected 10/CAD $2, 80/CAD $10, or 250/CAD $25 pack and grants its credits once through the ledger, including concurrent duplicate completion.                                                                                                                                                           |
| Try Risk-Free             | Pass   | A completed one-card checkout creates the five-day CAD $9.99 authorization, one physical entitlement, and ten provisional credits. Fulfillment captures CAD $9.99; deadline resolution captures fixed CAD $2 and releases CAD $7.99 exactly once.                                                                                                                                     |
| Big Sender                | Pass   | Quantities 2-30 select the server tier, capture the exact total, grant the purchased card entitlement, and consume the required quantity on fulfillment.                                                                                                                                                                                                                              |
| Verified webhooks         | Pass   | Existing signature verification now feeds durable hash-only receipts, idempotent claim/process/ignore/fail states, stale/failed recovery, Stripe-compatible checkout reconciliation, and Scribeless state reconciliation. Raw request bodies are not stored.                                                                                                                          |
| Fulfillment adapter       | Pass   | `DeterministicScribelessAdapter` accepts a versioned typed payload containing order identity, artwork/message asset keys and hashes, QR metadata, Canadian recipient/sender addresses, and idempotency identity. It makes no network call; persisted jobs contain hashes and provider IDs only.                                                                                       |
| Fulfillment recovery      | Pass   | Jobs move through queued, submitting, retryable failure, submitted, and accepted states. Duplicate submission is idempotent, provider failure is retryable, and verified webhook states reconcile forward.                                                                                                                                                                            |
| Blank-card handoff        | Pass   | A local/test feature flag permits only a one-card Try Risk-Free order, consumes that entitlement, records the handoff, and sends a typed blank variant with no artwork, inside message, or QR payload. Production remains disabled pending final print payload approval.                                                                                                              |
| Database integrity        | Pass   | Additive migration `0005_checkout_fulfillment_mocks.sql` is checksum-journaled. Database functions row-lock exact-once reconciliation, constraints enforce lifecycle/targets/currency, and clean/repeat/tamper verification passes. Migrations 0001-0004 were not edited.                                                                                                             |
| Web journey               | Pass   | Authenticated desktop and explicit 390px journeys created a deterministic card, approved backend assets, entered synthetic Canadian addresses, displayed standard delivery as included, created a server-priced CAD $9.99 Try Risk-Free checkout, reconciled payment and accepted fulfillment, and displayed the authenticated confirmation. A forged confirmation URL failed closed. |
| No external action        | Pass   | No AWS mutation, Stripe request, Scribeless request, payment, physical print/mail, email, analytics, deployment, or paid-provider traffic occurred. External-service cost is CAD $0 / USD $0.                                                                                                                                                                                         |

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
- Confirmation treats URL values only as opaque record identifiers. Payment, resource, and fulfillment claims are derived from authenticated owner-scoped server reads; forged status/order query values cannot create a verified result.
- Credit-pack checkout keeps one unresolved idempotency key across retry and retires it only after the server returns a session.
- Upload bodies inherited from Section 4 enter the service as `unknown` and must pass explicit object, array, Buffer-brand, and length checks before Buffer or storage use. PR #6 has zero open CodeQL alerts.

## Hardening and maintainability evidence

- `Delivery.tsx` was reduced from the Section 5 peak of 750 lines to 565 lines, below its 614-line Section 4 baseline. Backend data loading, checkout presentation, and pure delivery helpers now have focused modules and tests.
- Confirmation-state helpers cover missing state, mismatched checkout/fulfillment ownership, completed fulfillment, and credit-pack payment-only state.
- The lockfile uses patched, major-compatible `brace-expansion`, `fast-uri`, and `undici` resolutions. A clean `npm ci` and full `npm audit --audit-level=low` report zero known vulnerabilities.
- `npm run verify` passed formatting, lint, strict type checks, 95 automated tests, all workspace builds, 40 Next.js routes, and the production audit.
- `npm run test:database` passed clean/repeat/tamper migration and API database verification.
- `npm run smoke:stack:isolated` applied migrations 0001-0005, proved web/API/worker/PostgreSQL readiness, and removed only the dedicated `souvenote-audit` project and volume.
- `npm run dev:setup:isolated` now provides the same project/volume isolation for longer interactive browser acceptance.
- The explicit 390x844 acceptance covered photo, basics, image flow, inside message, QR song, review, delivery, hosted checkout, and confirmation. Two no-wrap heading defects found on the inside-message and QR-song screens were fixed; the repeated affected screens and all other recorded screens fit the viewport with no horizontal document overflow, and the browser console remained free of warnings and errors.

## Local cleanup incident

During browser-QA cleanup, a manual `docker compose down --volumes` used the shared `souvenote-local` project label. Docker removed the previously preserved `souvenote-local-postgres-data` volume even though the intended deletion target was only the synthetic QA volume. Docker now reports the default volume absent. It contained local-only development state with the already documented unpublished migration-0002 checksum mismatch; no source files, shared database, provider account, or external environment were affected. No dump was taken, and ordinary Docker volume tooling cannot restore it; only an independent Docker Desktop VM/disk backup could recover it. The synthetic `souvenote-browser-qa-postgres-data` volume was also removed as intended. The new isolated interactive command prevents future QA cleanup from sharing the default Compose project.

## Deferred behavior and risks

- Real Stripe test components/SDK traffic and real Scribeless sandbox traffic remain Section 7 provider activations. Production Try Risk-Free also requires legal approval.
- Final Scribeless dimensions, bleed, safe area, color profile, DPI, and blank-card payload remain explicit Section 8 launch gates.
- The current physical order contract supports one recipient address with quantity 1-30. Delivery blocks the existing multi-address UI rather than silently using one address; a reviewed recipient-array/order-line contract is still required for different addresses in one Big Sender checkout.
- Scheduled mailing is not represented in the Section 5 provider contract and is visibly blocked.
- The previous normal local PostgreSQL volume was removed in the cleanup incident recorded above. The next normal local start will create a clean empty volume; it cannot restore prior local-only records.

## Rollback

Before migration 0005 reaches any shared database, revert the Section 5 commit. After a shared apply, never edit migration 0005; use a reviewed forward migration. Runtime rollback is immediate by setting payment and fulfillment provider modes to disabled and leaving production feature flags false.
