# Section 2 task handoff

```text
Milestone and PR: Section 2 - Schema, contracts, and security; draft PR #3 (https://github.com/Souvenote/Souvenote-Design-Codex/pull/3)
Build-plan section and gate: Section 2; migrations/contracts pass and cross-user, arbitrary-credit, invalid-token, and missing-idempotency access fail
Goal: Replace legacy schema/API/browser authority with a verified, generated, default-deny owner-scoped boundary.
Canonical repository: C:\Users\wilso\Desktop\Souvenote_Design_Codex
Branch: codex/section-2-schema-contracts-security
Implementation commit: 3772d0809730b238bc6421cf287135ebd0fe5e53
Base commit: 7449088f199bb6291069dfe7788668a4876eb589

Behavior completed:
- One verified pre-launch MVP baseline and SHA-256 migration journal.
- /api/v1, generated OpenAPI contract/client, stable errors/statuses, and cursor pagination.
- Cognito authorization-code/PKCE BFF with encrypted HttpOnly sessions and deterministic loopback auth.
- Global authentication, owner-scoped repositories, exactly-once starter credits, CSRF/CORS/headers/limits/log redaction.
- Removal of caller identity, public credit mutations, browser token authority, fake payment/order/reward/email success, and active future-feature actions.

Files/modules changed:
- database baseline, runner, checksum manifest, SQL tests, and verifier.
- API auth/common security, repositories/controllers/services, DTO/OpenAPI generation, integration/unit tests.
- web BFF/auth routes, generated-client adapter, auth/session tests, and non-transactional placeholder surfaces.
- contracts package, root/CI/local supervisor commands, policy tests, and engineering documentation.

Public interfaces changed:
- Product APIs moved to /api/v1.
- Browser calls route through /api/bff/api/v1/*.
- New /me, /pricing, /credits, /card-entitlements, /card-drafts, /uploads, /generation-jobs, /assets, /orders, /checkout, /fulfillment-jobs, public share, and webhook contracts.
- Sensitive customer mutations require Idempotency-Key; verified webhooks use provider event IDs for idempotency.

Database migrations:
- 0001_mvp_baseline.sql with committed SHA-256 manifest.
- Deleted unapproved 001/002/003 draft history and draft pricing seed because no shared database existed.

Tests and checks executed:
- Clean npm ci and the aggregate verify gate passed on Node 22.22.0/npm 10.9.8.
- Contract drift, formatting, lint, type checks, 68 automated tests, all builds, and production/full audits passed.
- Isolated PostgreSQL migration/constraint/tamper tests and the credential-free stack smoke passed.
- Local browser checks passed for the cookie/BFF ownership boundary and inactive-feature honesty.
- See docs/engineering/section-2-audit.md for the exact command/result matrix.

Security/privacy review:
- Default deny, token claims/JWKS, BFF session isolation, owner constraints, CSRF/CORS, limits, stable errors, log redaction, and raw-card/token absence reviewed and tested.

Cost impact:
- CAD $0 / USD $0 external-service cost.

AWS/provider actions taken:
- Approval ID: none required.
- Action: none.
- Result: no AWS/provider state changed and no paid traffic occurred.

Unresolved risks or decisions:
- Real Cognito configuration and required access-token email claim must be verified before staging.
- Shared edge rate limiting is required before horizontal shared deployment.
- Section 3-5 behavior remains explicitly deferred and fail closed.

Build-plan deviations:
- None. Frontend authority cleanup needed to prevent simulated future-feature success was completed without claiming Section 3-5 behavior.

Rollback notes:
- Revert the Section 2 commits while no shared database has the baseline. After any shared apply, never revert by editing 0001; add a reviewed forward migration.

Exact recommended next task prompt:
Implement complete Section 3 - Pricing, credits, and entitlements - from the approved build plan in a fresh GPT-5.6 Sol task. Work only in C:\Users\wilso\Desktop\Souvenote_Design_Codex. Create codex/section-3-pricing-credits-entitlements from the final Section 2 commit and keep its draft PR stacked on codex/section-2-schema-contracts-security while Section 2 is unmerged. Read AGENTS.md and every authoritative product/engineering source first. Implement the approved active Canada/CAD catalog, idempotent ledger costs/refunds, physical-card entitlements and Big Sender reservations for 2-30, and the five-day Try Risk-Free/fixed-CAD-$2 state machine in deterministic mock payment mode. Remove conflicting pricing/currency/first-send-bonus copy without visual redesign. Prove concurrency, retries, refunds, reservations, transitions, and idempotency against isolated PostgreSQL. Make no AWS/provider/payment mutation or paid call. Finish with the full pinned-toolchain gate, browser evidence, Section 3 audit/handoff, committed branch, stacked draft PR, and green final-head checks; do not merge it.
```
