# MVP decision register

This register contains product and engineering decisions that override conflicting PRD, prototype, or legacy-document statements. Add future decisions chronologically; do not rewrite history.

## Decision format

```text
ID:
Date:
Status: proposed | approved | superseded
Decision:
Reason:
Supersedes:
Consequences:
Approval reference:
```

## Approved decisions

### MVP-001 - Authority order

- Date: 2026-07-21
- Status: approved
- Decision: Explicit user decisions and this register take precedence, followed by the sanitized MVP specification, PRD product intent, current approved visual journey, engineering/security rules, and finally legacy documents.
- Consequence: Conflicts are surfaced rather than silently resolved.

### MVP-002 - Confidential PRD handling

- Date: 2026-07-21
- Status: approved
- Decision: Keep the original confidential PDF outside Git and commit only a sanitized implementation specification.
- Consequence: Fresh tasks read `docs/product/mvp-spec.md`; they do not require the PDF.

### MVP-003 - Visual and frontend strategy

- Date: 2026-07-21
- Status: approved
- Decision: Preserve the current visual design and route journey. Do not rewrite the application into Tailwind. Add server-state and ephemeral workflow-state tools only where they clarify ownership.
- Supersedes: PRD prescription of Tailwind as a required frontend technology.

### MVP-004 - MVP/future feature boundary

- Date: 2026-07-21
- Status: approved
- Decision: Gift, redemption, digital cards, B2B, Community, full referrals, Trust Circle, calendar, chatbot, recipient rewards, and animated downloads remain inactive placeholders. The one-card blank-card handoff remains part of the physical MVP.
- Consequence: Functional-looking prototype actions must be disabled or clearly labeled.

### MVP-005 - Canada-first pricing

- Date: 2026-07-21
- Status: approved
- Decision: PRD prices are CAD. Canada launches first. US checkout remains disabled until an independent USD catalog and unit economics are approved.
- Supersedes: USD seed currency and any assumption that matching face values apply in both markets.

### MVP-006 - Try Risk-Free

- Date: 2026-07-21
- Status: approved
- Decision: Five-day CAD $9.99 authorization; capture $9.99 when sent; otherwise charge a fixed CAD $2.00 and release the remainder.
- Supersedes: Seven-day copy and $0.20-per-used-credit behavior in the prototype.
- Gate: Production activation requires Stripe and legal approval.

### MVP-007 - Credits and bonus

- Date: 2026-07-21
- Status: approved
- Decision: Signup grants two credits once; combined first image/song generation costs two; individual image/song regeneration costs one; inside-message generation costs zero; remove the first-send +2 bonus.

### MVP-008 - Big Sender

- Date: 2026-07-21
- Status: approved
- Decision: Big Sender begins at two cards and supports 2-30 cards using the approved CAD tiers.
- Supersedes: Prototype copy that begins the first tier at one card.

### MVP-009 - Build My Card module

- Date: 2026-07-21
- Status: approved
- Decision: Treat the existing Build My Card route and components as the module. Refactor it behind the same draft, upload, generation, delivery, and checkout contracts as Personalize a Template.

### MVP-010 - Song duration

- Date: 2026-07-21
- Status: approved
- Decision: Thirty-second Lyria 3 output is acceptable for MVP.
- Supersedes: PRD target of 40-50 seconds.

### MVP-011 - Database scope

- Date: 2026-07-21
- Status: approved
- Decision: Build a complete, constrained MVP schema plus stable product-neutral extension points. Do not create a speculative complete V2 schema.
- Supersedes: PRD requirement to place all dormant V2 tables in migration 001.

### MVP-012 - Cost and external action approvals

- Date: 2026-07-21
- Status: approved
- Decision: Preserve at least $1,000 of AWS credit and require explicit scoped approval for every action that can create/increase cost or activate a paid provider.
- Consequence: Local mocks and read-only inspection precede external mutations. Silence is denial.

### MVP-013 - Prototype behavior is not product approval

- Date: 2026-07-21
- Status: approved
- Decision: Existing UI presentation is not evidence that a feature is approved for transaction or persistence. Where current behavior conflicts with this register, preserve the styling and journey while replacing the behavior and copy.
- Consequence: Functional-looking Gift, referral, Community, US, bonus, pricing, and duration behavior remains subject to this register.

### MVP-014 - Section 0 CI baseline

- Date: 2026-07-21
- Status: approved implementation decision
- Decision: Section 0 CI is credential-free and non-deploying. It blocks type, unit-test, production-build, and critical dependency-audit failures. Existing non-fixing lint failures and high dependency advisories are recorded debt for Section 1, not silently waived.
- Consequence: CI starts green without rewriting source, touching a database, or requiring secrets; Section 1 must remediate the debt and raise the gates.

### MVP-015 - Canonical workspace and toolchain

- Date: 2026-07-21
- Status: approved implementation decision
- Decision: Use one npm workspace rooted at the repository, with `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`, `packages/config`, `database`, `infra`, and `docs`; use Node.js 22 as the canonical local and CI runtime.
- Supersedes: The separate `front end` and `backend/server` package layout and independent lockfiles.
- Consequence: Root commands and one lockfile own installation, verification, and local lifecycle behavior. The contracts package remains a placeholder until Section 2 generates the client.

### MVP-016 - Local PostgreSQL and lifecycle safety

- Date: 2026-07-21
- Status: approved implementation decision
- Decision: Use PostgreSQL 16 for local development, bound to `127.0.0.1:55432`. Normal `dev:down` preserves its Docker volume; destructive reset or volume deletion is never part of the ordinary lifecycle.
- Consequence: Port conflicts fail with a diagnostic rather than killing unrelated processes. Database readiness uses a connectivity query only during Section 1.

### MVP-017 - Section 1 transitional runtime boundaries

- Date: 2026-07-21
- Status: approved implementation decision
- Decision: Keep the existing `/api` prefix until Section 2; do not auto-run the legacy draft migrations; keep all provider modes deterministic mock or disabled; permit disabled authentication only in the explicit local environment and reject it in every non-local environment.
- Consequence: Section 1 can verify workspace and process orchestration without legitimizing an unsafe schema, caller-supplied identity, or external traffic. Section 2 owns `/api/v1`, Cognito/session enforcement, generated contracts, and the verified baseline migration.

### MVP-018 - Section 1 external-cost boundary

- Date: 2026-07-21
- Status: approved implementation decision
- Decision: Section 1 is entirely local and credential-free. It creates no AWS resources and activates no paid or metered provider traffic.
- Consequence: Section 1 external cost is CAD $0 and USD $0. Any later AWS mutation or paid-provider activation still requires a separately scoped approval under `docs/operations/cost-approval.md`.

### MVP-019 - Questions require an explicit user response

- Date: 2026-07-21
- Status: approved
- Decision: Any question an agent asks is blocking until the user explicitly answers every question. Questions never expire, auto-resolve, or acquire a default answer because the user has not replied.
- Consequence: Agents ask only necessary questions, group related questions where practical, and pause all task actions while any question remains unanswered, no matter how long the wait lasts. Silence never authorizes progress.
- Approval reference: Direct user instruction in the Section 1 task.

### MVP-020 - Complete build plan is mandatory

- Date: 2026-07-21
- Status: approved
- Decision: `docs/engineering/build-plan.md` is the mandatory execution plan for the entire MVP build, including Sections 0-8, task protocol, model/concurrency rules, approval boundaries, section gates, and the final MVP completion contract.
- Consequence: Every fresh task and PR must read and comply with the plan. A section cannot skip its gate, borrow completion evidence from an older branch, or silently pull later-section scope forward. CI repository-policy tests protect the plan's required structure and entry-point links.
- Approval reference: Direct user request to make the full outlined build plan a rule for the entire build.

### MVP-021 - One visible lead task per section

- Date: 2026-07-22
- Status: approved
- Decision: Use exactly one clearly named, user-visible Codex lead task for each PR-sized build-plan section. Only that lead may mutate the canonical Desktop worktree. Separate sidebar tasks may not act as workers, retries, handoff targets, or parallel leads. Internal workers are optional, read-only by default, bounded and non-overlapping; an editing worker requires an isolated worktree/branch and may never edit the canonical worktree. After the gate, handoff, draft PR, and exact-head checks pass, rename the lead task with `(Complete)` and archive it before starting the next section. New visible tasks require explicit user direction.
- Reason: Concurrent Section 3 task handoffs inherited misleading titles and briefly edited the shared canonical worktree, creating an avoidable migration/checksum collision and confusing task state.
- Supersedes: Any interpretation of the fresh-task or worker rules that permits multiple visible tasks or multiple agents to mutate the same canonical worktree concurrently.
- Consequence: Duplicate or misnamed tasks stop before their next mutation, report their last mutation, are renamed `Retired — <original purpose>`, and are archived after the lead reconciles their work. An unanswered user question pauses the entire section and cannot be bypassed by another task or worker.
- Approval reference: Direct user instruction after the Section 3 task-state audit.

### MVP-022 - Standalone credit packs and signup trial

- Date: 2026-07-23
- Status: approved
- Decision: Standalone credit packs are real Canada-first MVP products that authenticated users may purchase repeatedly: 10 credits for CAD $2.00, 80 credits for CAD $10.00, and 250 credits for CAD $25.00. Every newly provisioned user receives two free trial credits exactly once so they can try the creation experience before purchasing.
- Reason: The existing interface already presented these three pack choices, but incorrectly treated them as disabled placeholders instead of approved products.
- Supersedes: Section 3 copy and behavior that labels standalone credit top-ups as unavailable or Coming soon.
- Consequence: Section 3 owns the server-authoritative catalog, idempotent mock purchase/grant state, and customer presentation. Section 5 owns Stripe-hosted payment collection and production checkout activation. Credit quantities, prices, currency, payment state, and ledger grants are never browser authority.
- Approval reference: Direct user decision in the Section 3 correction task.
