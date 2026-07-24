# Section 3 standalone credit-pack correction handoff

```text
Milestone and PR: Section 3 standalone credit-pack correction; draft PR #5 (https://github.com/Souvenote/Souvenote-Design-Codex/pull/5)
Build-plan section and gate: Section 3 correction; standalone catalog, signup trial, idempotent purchase/grant, ownership, browser, database, and full quality gates pass
Goal: Correct the original Section 3 interpretation so the three approved standalone CAD credit packs are real repeat-purchasable products and new users receive two free trial credits.
Codex task title: Section 3 — Pricing, credits, and entitlements
Task lifecycle: active until the final PR head passes exact-head CI; then complete-and-ready-to-archive
Canonical repository: C:\Users\wilso\Desktop\Souvenote_Design_Codex
Branch: codex/section-3-standalone-credit-packs
Implementation commit: 14322899d982ad2948eca1daa7be630acddb65d9
Base commit: 140145ae4aef6536678aee29828e96d063a0b677

Concurrency/worktree record:
- Visible lead tasks used: Section 3 — Pricing, credits, and entitlements.
- Internal workers used: none.
- Editing worktree ownership: the visible lead alone edited C:\Users\wilso\Desktop\Souvenote_Design_Codex on codex/section-3-standalone-credit-packs.

Behavior completed:
- Exact public Canada/CAD standalone catalog: 10 credits/CA$2, 80/CA$10, and 250/CA$25.
- Existing account provisioning grants two free trial credits exactly once and customer copy explains the trial purpose.
- Authenticated users may buy a standalone pack repeatedly with different idempotency keys.
- Development/test mock capture creates a durable purchase snapshot and grants the exact catalog quantity once through the atomic ledger.
- Same-key retries return one purchase/grant; same-key different-input reuse conflicts.
- Production and non-mock purchase attempts fail closed; production checkout flags remain false.
- Pricing and creation-modal surfaces read the backend catalog instead of hardcoded prices.
- Browser balance publication updates immediately after each successful local mock purchase.
- Local same-origin purchase mutations work through Next.js localhost/127.0.0.1 proxying while cross-site requests remain rejected.

Files/modules changed:
- API pricing and credits DTOs/controllers/services/repositories plus unit and concurrent e2e coverage.
- Web pricing, creation-modal catalog, FAQ, BFF CSRF boundary, API adapter, and unit coverage.
- Additive migration 0003, checksum manifest, SQL contract suite, and disposable verifier.
- Generated OpenAPI/TypeScript contracts and contract policy checks.
- AGENTS.md, architecture, build plan, MVP specification, decision register, correction audit, and historical Section 3 pointers.

Public interfaces changed:
- GET /api/v1/pricing now includes the separate creditPacks catalog.
- POST /api/v1/credits/purchases/mock creates or replays an authenticated local/test mock purchase and requires Idempotency-Key.
- GET /api/v1/credits/purchases/:purchaseId returns one owner-scoped purchase.

Database migrations:
- Added immutable 0003_standalone_credit_packs.sql and its SHA-256 manifest entry.
- Added credit_pack_offers, credit_pack_purchases, server-owned offer snapshot enforcement, lifecycle transitions, exact three-pack seed catalog, and disabled production feature flag.
- Did not edit applied migrations 0001 or 0002.

Tests and checks executed:
- Command: npm run verify under Node 22.22.0/npm 10.9.8.
  Result: passed contract drift, formatting, lint, type checks, 20 script tests, 35 API tests, 13 web tests, 10 worker tests, all four builds, and production audit with zero vulnerabilities.
- Command: npm run test:database.
  Result: passed clean/repeat/tamper migration checks, three SQL suites, concurrent API idempotency/ownership coverage, and exact container cleanup.
- Command: in-app browser acceptance against fresh disposable PostgreSQL 16.
  Result: exact public CAD catalog; signup balance 2; two repeat CA$2 purchases produced balances 12 and 22; 390x844 mobile presentation passed; no browser warnings/errors.
- Command: migration SHA-256 comparison and git diff --check.
  Result: checksum matches 7a4de59c73051f7d08e86874ee136dfe88ef05a56c3c2d2dd658f861cb8295c3 and the diff is clean.

Security/privacy review:
- Default-deny authentication and owner scoping preserved.
- Browser cannot set identity, price, currency, quantity, payment state, balance, or granted credit amount.
- Money remains integer minor units; purchase and ledger writes are transactional and idempotent.
- Mock purchase is development/test only and no raw payment fields or external credentials were introduced.
- No customer content or private customer data was added to logs or analytics.

Cost impact:
- CAD $0 / USD $0 external-service cost.

AWS/provider actions taken:
- Approval ID: none required.
- Action: none.
- Result: no AWS, Stripe, paid-provider, email, analytics, error-reporting, deployment, or shared-environment state changed.

Unresolved risks or decisions:
- Section 5 must implement approved Stripe-hosted checkout, verified capture/webhook state, tax/legal/refund review, and reconciliation before production activation.
- The normal local database volume contains a preserved historical migration preview; continue using disposable databases unless the user explicitly approves resetting that local volume.
- The correction does not alter Try Risk-Free or Big Sender terms.

Build-plan deviations:
- None. The correction is the approved MVP-022 clarification inside Section 3. Production Stripe collection remains in Section 5.

Rollback notes:
- Revert the implementation commit while migration 0003 has not reached a shared database. After any shared apply, never edit 0003; use a reviewed forward migration.

Exact recommended next task prompt:
After draft PR #5 is reviewed, exact-head CI is green, and the correction is merged to main, implement complete Section 4 — Creation workflow with deterministic mocks — from the approved build plan in a fresh GPT-5.6 Sol task. Work only in C:\Users\wilso\Desktop\Souvenote_Design_Codex from the new main head. Read AGENTS.md and every authoritative product/engineering source first. Preserve the approved visual journey while implementing server-persisted drafts, private local uploads, image-rights attestation, moderation states, generation jobs/provider attempts, per-asset review/regeneration, exact Section 3 credit costs/refunds, delivery handoff, and My Cards & Songs resume for both creation routes. Use deterministic image/music/text mock adapters only; make no AWS, fal, Bedrock, Stripe, Scribeless, email, analytics, deployment, or paid call. Prove ownership, idempotency, retries, partial failures, refunds, persistence, accessibility, responsive behavior, and browser completion. Finish with the full pinned-toolchain gate, disposable PostgreSQL evidence, Section 4 audit/handoff, committed draft PR, and green exact-head CI; do not merge without explicit user direction.

Task retirement:
- Final exact-head checks passed: pending CI on the final PR #5 head.
- Rename to Section 3 — Pricing, credits, and entitlements (Complete): after exact-head CI passes.
- Archive before the next section starts: after exact-head CI passes and the completion rename is confirmed.
```
