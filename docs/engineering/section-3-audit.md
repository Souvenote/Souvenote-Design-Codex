# Section 3 completion audit

Audited: 2026-07-22

Branch: `codex/section-3-pricing-credits-entitlements`

Base: `fdf2c14b61250120ee3359379f67a61fcc5399c1`

Status: implementation and local acceptance complete. Draft PR #4 remains unmerged and stacked on the Section 2 branch; exact-head CI is the final publication gate.

## Scope and authority

This audit maps Section 3 to implementation evidence. It does not activate Stripe, paid providers, AWS, checkout, fulfillment, or the complete Section 4 creation workflow.

The task read `AGENTS.md`, the complete build plan, MVP specification, decision register, architecture, cost-approval rules, current baseline, Section 2 audit/handoff, review rules, and local-development instructions before implementation.

## Acceptance matrix

| Requirement               | Result | Evidence                                                                                                                                                                                                                |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canada/CAD catalog        | Pass   | Additive migration `0002_pricing_credits_entitlements.sql` publishes Try Risk-Free plus the exact 2-10, 11-20, and 21-30 Big Sender tiers. The public catalog returns CAD/CA only.                                      |
| Exact Try Risk-Free terms | Pass   | The database constrains a CAD $9.99 authorization, five-day deadline, ten provisional credits, CAD $2 fixed no-send capture, and CAD $7.99 release. Production checkout is false.                                       |
| Big Sender pricing        | Pass   | Server selects the tier and computes integer-minor-unit totals for quantities 2-30. Quantity one and values above 30 are rejected.                                                                                      |
| Starter credits           | Pass   | Existing Section 2 provisioning remains authoritative and grants two credits exactly once. Eight-request concurrency coverage remains in the API suite; browser re-login stayed at two.                                 |
| Generation action costs   | Pass   | Initial image/song costs two, image-only or song-only regeneration costs one, and inside-message generation costs zero. The API derives cost from a closed action enum; callers cannot submit a balance or price.       |
| Failure refunds           | Pass   | The domain service/database ledger refunds `provider_failed`, `timed_out`, `policy_blocked`, and `invalid_result` failures exactly once. Eight concurrent refund attempts produce one ledger credit.                    |
| Atomic credit ledger      | Pass   | Generation reservation/refund and provisional-credit grants use the database ledger function inside transactions with database idempotency and non-negative balance enforcement.                                        |
| Card entitlements         | Pass   | Mock Try Risk-Free atomically creates one physical-card entitlement and ten credits. Resolution synchronizes entitlement state. Owner-scoped listing remains authenticated by default.                                  |
| Big Sender reservations   | Pass   | Authenticated create/read/release routes return server-owned CAD quotes, expire after 15 minutes, never collect payment, and never grant an entitlement at quote time. Create/release idempotency is database-enforced. |
| Mock Try Risk-Free        | Pass   | Authorization works only in development/test with `PAYMENT_PROVIDER_MODE=mock`, is one per account, makes no external call, and resolves exactly once through database-owned deadline/fulfillment functions.            |
| Worker deadline resolver  | Pass   | A repository-only SQL adapter invokes the database resolver. Runtime validation restricts it to local/test mock payment mode and it is disabled by default. Success and sanitized failure tests pass.                   |
| Immutable migrations      | Pass   | `0001_mvp_baseline.sql` was not edited. Migration 0002 has a committed SHA-256 checksum; clean apply, repeat no-op, journal tamper rejection, and both SQL contract suites pass in disposable PostgreSQL 16.            |
| Generated API contract    | Pass   | OpenAPI and the TypeScript client expose the pricing fields, action-specific generation request, card reservations, and mock Try Risk-Free resources. Contract drift checks pass.                                       |
| Customer copy             | Pass   | UI shows Canada/CAD, five days, fixed CAD $2, no first-send bonus, and Big Sender beginning at two. Credit top-ups are disabled and say Coming soon.                                                                    |
| Checkout honesty          | Pass   | Cart contains no active promo, invented client-side GST, payment form, or simulated success. It shows the fixed CAD $9.99 preview total, says Checkout coming soon, and states no payment/order is created.             |
| No live/paid action       | Pass   | Local mocks and disposable Docker only. No AWS, Stripe, fal, Bedrock, Scribeless, email, analytics, error-reporting, or production deployment action occurred.                                                          |

## Concurrency and state evidence

The isolated database/API gate verifies:

- concurrent first-generation requests with one idempotency key create one job and one two-credit debit;
- concurrent failure processing creates one refund and restores the balance once;
- regeneration and inside-message actions charge exactly one/zero credits;
- insufficient credit requests fail without a partial job or ledger mutation;
- concurrent Big Sender requests return one reservation and one server total;
- reservation release is idempotent and owner-scoped;
- concurrent mock Try Risk-Free requests produce one authorization, one entitlement, and one ten-credit grant;
- a second account-level authorization is rejected even with a new idempotency key;
- duplicate fulfillment/deadline resolver calls capture exactly once and emit one audit result.

## Browser acceptance

The app was run with the pinned toolchain against a fresh disposable PostgreSQL database and mock/disabled providers. Browser inspection verified:

- public pricing showed `$9.99`, fixed `$2.00`, five days, and exact `$8.99/$7.99/$6.99` tiers starting at two;
- all catalog `checkoutEnabled` values were false;
- local signed-cookie provisioning displayed `Credits 2`, and a second login still displayed `Credits 2`;
- credit top-up cards were disabled and labelled Coming soon;
- the Try Risk-Free cart showed a fixed `$9.99 CAD` total, no fabricated discount/tax, Checkout coming soon, and “No payment or order is created in this preview.”

The disposable browser database/container and owned app processes are removed during final cleanup. The pre-existing normal local data volume is preserved and was not reset or rewritten.

## Verification evidence

| Gate                     | Result                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean install            | `npm ci` passed with Node 22.22.0/npm 10.9.8 and reported zero vulnerabilities.                                                                                                                      |
| Aggregate quality        | `npm run verify` passed toolchain, generated-contract drift, formatting, lint, type checks, 20 script tests, 32 API tests, 11 web tests, 10 worker tests, all four builds, and the production audit. |
| Web build                | Next.js generated all 40 routes.                                                                                                                                                                     |
| Database/API integration | `npm run test:database` passed clean apply, repeat no-op, checksum/journal tamper rejection, two SQL suites, concurrent API integration, and exact temporary-container cleanup.                      |
| Runtime health           | Web, API, and worker returned HTTP 200 against the disposable browser-acceptance database; pricing returned four exact checkout-disabled offers.                                                     |
| Final source scan        | No active seven-day, per-credit no-send fee, USD launch price, first-send bonus, one-card Big Sender tier, raw payment-card UI, or simulated checkout success remains in active application source.  |

The documentation-only and cart-authority changes made after the first aggregate run are covered again by the final exact-source gate before publication.

## Security, privacy, and cost

- Authentication and ownership remain default-deny; customer identity comes from the verified token/session boundary.
- Money is integer minor units and ISO currency in the database/API. Client quote data is not transaction authority.
- Provider credentials are neutralized by local runtime policy and all provider modes are mock or disabled.
- No prompt, photo, recipient, payment-card, or private message data was introduced into analytics or logs.
- AWS resources changed: none.
- Paid-provider calls: none.
- External-service cost: CAD $0 / USD $0.

## Deferred behavior and risks

- Real Stripe components, authorizations, captures/releases, tax calculation, and webhooks remain Section 5 and require separate approval plus legal review.
- Big Sender reservations are quotes only until an approved payment conversion flow exists.
- Section 4 owns persisted provider jobs, per-asset attempts/outputs, upload moderation bytes, complete drafts/library resume, and full mock creation delivery.
- The normal local named PostgreSQL volume contains an unpublished preview of migration 0002 created during concurrent task activity. It was deliberately preserved rather than reset. Clean verification uses disposable databases; a future explicit local reset may be chosen after the branch is finalized, but no shared environment is affected.
- This branch must remain stacked on `codex/section-2-schema-contracts-security` until its base merges.
