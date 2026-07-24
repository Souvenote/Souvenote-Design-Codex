# Section 3 task handoff

Historical note: the original handoff predates approved decision MVP-022.
Standalone credit packs are now real MVP products; the current correction handoff
is `docs/engineering/section-3-credit-pack-correction-handoff.md`.

```text
Milestone and PR: Section 3 - Pricing, credits, and entitlements; draft PR #4 (https://github.com/Souvenote/Souvenote-Design-Codex/pull/4)
Build-plan section and gate: Section 3; ledger, pricing, reservations, refunds, state resolution, and idempotency pass concurrent integration tests
Goal: Implement the Canada-first catalog and deterministic local credit/entitlement state machines without paid traffic.
Codex task title: Section 3 — Pricing, Credits & Entitlements; rename with (Complete) immediately before archival
Task lifecycle: complete-and-ready-to-archive after the final PR head checks pass
Canonical repository: C:\Users\wilso\Desktop\Souvenote_Design_Codex
Branch: codex/section-3-pricing-credits-entitlements
Implementation commit: 85d46d7887f6c6cec2b3a2b12fef7e666b95139f
Base commit: fdf2c14b61250120ee3359379f67a61fcc5399c1

Concurrency/worktree record:
- Final visible lead: Section 3 — Pricing, Credits & Entitlements.
- Retired duplicate: Retired — Section 3 Duplicate Lead. Its last migration/checksum mutation was inventoried and reconciled before the full local and exact-head CI gates were rerun.
- Retired setup attempt: Retired — Section 3 Setup Attempt. It produced no retained source mutation.
- Internal workers: none active during final reconciliation, governance correction, verification, or publication.
- Editing worktree ownership: the final lead alone owned C:\Users\wilso\Desktop\Souvenote_Design_Codex after the collision was detected. Both retired tasks are archived.

Behavior completed:
- Exact Canada/CAD Try Risk-Free and Big Sender catalog with all production checkout flags off.
- Exactly-once starter/provisional credits, action-derived generation costs, and idempotent paid-failure refunds.
- Owner-scoped Big Sender quote reservations for 2-30 with server minor-unit totals and no payment/entitlement at quote time.
- One-per-account deterministic mock Try Risk-Free authorization, entitlement, ten-credit grant, five-day/fixed-$2 deadline, and full-capture fulfillment resolution.
- Disabled-by-default local/test worker resolution schedule.
- Canada-first frontend copy and an explicitly non-transactional cart with no fake promo, tax, or payment success.

Files/modules changed:
- API pricing, card-entitlement, credit, and generation controllers/services/repositories/DTOs plus integration/unit coverage.
- Web pricing catalog, pricing/options/cart/account copy, API adapter, and unit coverage.
- Worker runtime/database/schedule modules and unit coverage.
- Additive migration 0002, checksum manifest, SQL contract suite, disposable verifier, generated contracts, runtime policy, and engineering docs.

Public interfaces changed:
- GET /api/v1/pricing returns exact Canada/CAD offer terms and checkoutEnabled.
- POST/GET /api/v1/card-entitlements/reservations and POST .../:id/release provide owner-scoped Big Sender quote reservations.
- POST/GET /api/v1/card-entitlements/try-risk-free/authorizations provides local/test mock authorization state.
- POST /api/v1/generation-jobs requires actionType; callers never submit credit cost.

Database migrations:
- Added immutable 0002_pricing_credits_entitlements.sql and its SHA-256 manifest entry.
- Did not edit 0001_mvp_baseline.sql.

Tests and checks executed:
- Clean npm ci and npm run verify passed under Node 22.22.0/npm 10.9.8.
- 73 unit/script tests, four builds, contract drift, formatting, lint, type checks, and production audit passed.
- Disposable PostgreSQL clean/repeat/tamper/SQL/API concurrency verification passed.
- Browser and runtime-health acceptance passed against a fresh disposable database.
- Exact final-head CI is verified from the draft PR checks before task archival.
- The lifecycle correction re-ran contract drift, formatting, lint, type checks, all 73 tests, all four builds, and the production audit under Node 22.22.0/npm 10.9.8 before publication.

Security/privacy review:
- Default-deny auth/ownership preserved; money/credits remain server/database authoritative; mock payment is local/test only; no raw card fields, external credentials, or PII analytics added.

Cost impact:
- CAD $0 / USD $0 external-service cost.

AWS/provider actions taken:
- Approval ID: none required.
- Action: none.
- Result: no AWS/provider/payment/deployment state changed and no paid traffic occurred.

Unresolved risks or decisions:
- Stripe/legal approval is required before Try Risk-Free production activation.
- Section 4 must add complete persisted mock provider workflow and library resume without changing Section 3 money/credit authority.
- Preserve the normal local database volume unless the user explicitly directs a reset; use disposable databases for clean verification meanwhile.

Build-plan deviations:
- A temporary task-orchestration deviation allowed two visible tasks to mutate the canonical worktree. It is documented in the Section 3 audit, fully reconciled, and prevented going forward by decision MVP-021 and a repository policy test. Product/architecture scope had no deviation. Lyria duration/provider activation and all real checkout/fulfillment remain deferred.

Rollback notes:
- Revert the Section 3 commit while migration 0002 has not reached a shared database. After any shared apply, never edit 0002; use a reviewed forward migration.

Exact recommended next task prompt:
Implement complete Section 4 - Creation workflow with deterministic mocks - from the approved build plan in a fresh GPT-5.6 Sol task. Work only in C:\Users\wilso\Desktop\Souvenote_Design_Codex. Create codex/section-4-creation-workflow from the final Section 3 commit and keep its draft PR stacked on codex/section-3-pricing-credits-entitlements while Section 3 is unmerged. Read AGENTS.md and every authoritative product/engineering source first. Preserve the approved visual journey while implementing server-persisted drafts, private local uploads, image-rights attestation, moderation states, generation jobs/provider attempts, per-asset review/regeneration, exact Section 3 credit costs/refunds, delivery handoff, and My Cards & Songs resume for both creation routes. Use deterministic image/music/text mock adapters only; make no AWS, fal, Bedrock, Stripe, Scribeless, email, analytics, or paid call. Remove remaining demo/localStorage authorities without visual redesign. Prove ownership, idempotency, retries, partial failures, refunds, persistence, accessibility, responsive behavior, and browser completion. Finish with the full pinned-toolchain gate, disposable PostgreSQL evidence, Section 4 audit/handoff, committed stacked draft PR, and green exact-head CI; do not merge it.

Task retirement:
- Final exact-head checks must pass on the final PR #4 head before archival.
- Rename the lead to Section 3 — Pricing, Credits & Entitlements (Complete).
- Archive the lead before any Section 4 task starts.
```
