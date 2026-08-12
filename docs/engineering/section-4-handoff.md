# Section 4 creation workflow handoff

```text
Milestone and PR: Section 4 creation workflow with deterministic mocks; draft PR #6 (https://github.com/Souvenote/Souvenote-Design-Codex/pull/6)
Build-plan section and gate: Section 4 - Creation workflow with mocks; both creation routes complete locally through Delivery with persistence, failure/refund behavior, and responsive evidence using no paid calls
Goal: Replace browser-authoritative creation mocks with one secured, persisted backend journey for Personalize a Template and Build My Card while preserving the approved presentation.
Codex task title: Section 4 — Creation workflow with mocks (Complete)
Task lifecycle: complete-and-ready-to-archive
Canonical repository: C:\Users\wilso\Desktop\Souvenote_Design_Codex
Branch: codex/section-4-creation-workflow
Final implementation commit: 4138d37398760467518938f6b2e5f3a78d1e047a
Verification-record commit: this document's commit; use the draft PR head for the current record
Base commit: 9ecf2e7ac0c064b4d5e32c278d52503ec8fc5899

Concurrency/worktree record:
- Visible lead tasks used: Section 4 — Creation workflow with mocks.
- Internal workers used: none.
- Editing worktree ownership: the visible lead alone edited C:\Users\wilso\Desktop\Souvenote_Design_Codex on codex/section-4-creation-workflow.

Behavior completed:
- Personalize a Template and Build My Card use the same authenticated, owner-scoped draft, revision, upload, generation, approval, and Delivery handoff APIs.
- Drafts and wizard answers persist through the API and can be resumed from My Cards and Songs.
- Local-private uploads validate image bytes and dimensions, require rights attestation, progress through moderation, and use idempotent content storage.
- Deterministic local image, song, and message providers record generation jobs, provider attempts, assets, credit reservations, exact-once refunds, retries, and partial failures.
- Individual image or song regeneration charges the approved one-credit cost; inside-message generation remains free.
- Approval uses stable SHA-256 idempotency keys within the API limit and only approved backend asset IDs reach Delivery, downloads, and the song library.
- Checkout and fulfillment remain disabled Section 5 placeholders.

Files/modules changed:
- Additive creation migration 0004, checksum manifest, SQL verification, and database integration coverage.
- API modules for drafts, uploads, generation jobs/providers, assets, approval, Delivery state, capabilities, and owner-scoped library reads.
- Generated OpenAPI document, TypeScript contracts, client operations, and contract policy coverage.
- Web API adapter, shared creation workflow state, Build My Card and Personalize flows, Delivery, Saved Cards, downloads, song library, and responsive styling.
- Root optional Linux Sharp runtime declarations for reproducible Ubuntu CI installation.

Public interfaces changed:
- Added authenticated card-draft, revision, upload, generation-job, asset, approval, capability, and private asset-content operations under /api/v1.
- Generated web contracts and BFF calls now cover the complete persisted creation journey.

Database migrations:
- Added immutable 0004_creation_workflow.sql and its SHA-256 manifest entry.
- Added or completed constrained persisted creation lifecycle state for revisions, uploads, generation attempts, selected assets, approval, and Delivery handoff.
- Did not edit applied migrations 0001 through 0003.

Tests and checks executed:
- Command: npm run verify under Node.js 22.22.0/npm 10.9.8 at final head.
  Result: passed generated-contract drift, formatting, lint, strict types, 82 tests, all workspace builds, 40 Next.js routes, and production dependency audit with zero vulnerabilities.
- Command: npm run test:database.
  Result: passed clean/repeat/tamper migrations, SQL contracts, and API database integration against disposable PostgreSQL 16.
- Command: in-app browser acceptance for both creation routes on desktop and 390px mobile.
  Result: both routes completed generation, approval, and Delivery handoff with no horizontal overflow, browser warnings, or errors.
- Command: GitHub exact-head checks on e14103abb7c52a804fba2bfbdb20f6a36eb23ca3.
  Result: Workspace quality gate and Credential-free local stack both passed.
- Command: focused API formatting, lint, strict typecheck, and Jest after upload-body hardening.
  Result: all passed; four parameter-tampering cases prove string, array, plain-object, and null bodies fail closed before storage.
- Command: GitHub exact-head checks and open CodeQL alert query on 4138d37398760467518938f6b2e5f3a78d1e047a.
  Result: CodeQL, both CodeQL language analyses, Workspace quality gate, and Credential-free local stack all passed; open PR alerts: zero.

Security/privacy review:
- Authentication-by-default and owner scoping remain enforced for drafts, uploads, jobs, assets, and private content.
- Customer identity, credit charges, lifecycle status, selected assets, and approval remain server-authoritative.
- Uploads require validated bytes, rights attestation, and moderation before use.
- Upload content now enters the service as `unknown` and must pass explicit object, array, Buffer-brand, and byte-length checks before any Buffer API or storage call.
- Logs and analytics receive no prompts, messages, recipient data, private photo references, tokens, or private asset URLs.
- Idempotency and transactional credit refund behavior are covered under retry and partial-failure tests.

Cost impact:
- CAD $0 / USD $0 external-service cost.

AWS/provider actions taken:
- Approval ID: none required.
- Action: none.
- Result: no AWS mutation, paid provider call, payment, fulfillment submission, email, analytics, deployment, or shared-environment change occurred.

Unresolved risks or decisions:
- Section 5 owns Stripe-hosted test checkout, verified/idempotent payment reconciliation, Try Risk-Free resolution, physical blank-card entitlements, and Scribeless mock/sandbox fulfillment.
- Real provider activation, staging, and final print specifications remain later approved gates.

Build-plan deviations:
- The handoff document was reconstructed immediately before Section 5 because the completed Section 4 task archived after exact-head CI without committing this required file. No Section 4 implementation behavior changed during reconciliation.

Rollback notes:
- Revert Section 4 commits while migration 0004 has not reached a shared database. After any shared apply, never edit 0004; use a reviewed forward migration.

Exact recommended next task prompt:
Implement complete Section 5 — Checkout and fulfillment mocks — from the approved build plan in a fresh GPT-5.6 Sol task. Work only in C:\Users\wilso\Desktop\Souvenote_Design_Codex from the final Section 4 head. Implement server-owned CAD order totals, Stripe-compatible hosted test checkout contracts without raw card data, verified/idempotent webhook reconciliation, exact-once credit-pack grants, five-day Try Risk-Free resolution, Big Sender and one-card blank-card entitlement behavior, and a typed deterministic Scribeless adapter with retry/reconciliation/recovery tests. Preserve the Delivery/checkout presentation. Make no AWS mutation, live payment, physical print submission, paid call, email, analytics, or deployment. Finish with full pinned-toolchain, disposable PostgreSQL, responsive browser, security/privacy/cost, audit/handoff, draft PR, and exact-head CI evidence; do not merge without explicit user direction.

Task retirement:
- Final exact-head checks passed: yes, every required check passed on 4138d37398760467518938f6b2e5f3a78d1e047a and the PR has zero open CodeQL alerts.
- Rename to `Section 4 — Creation workflow with mocks (Complete)`: completed in the archived task record.
- Archive before the next section starts: completed; the task is preserved in the local archived-session store.
```
