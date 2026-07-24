# Approved end-to-end build plan

Status: approved and mandatory for the entire Souvenote MVP build

Approved: 2026-07-21

Last reconciled: 2026-07-23

This document is the durable execution plan for Sections 0 through 8. It is not a
roadmap suggestion. Every task, branch, pull request, review, deployment proposal,
and provider activation must comply with it unless a later approved decision in
`docs/product/decision-register.md` explicitly supersedes part of it.

The confidential PRD is not required to execute this plan and must not be committed.
Product behavior comes from `docs/product/mvp-spec.md`; system boundaries come from
`docs/engineering/architecture.md`; cost and external-action approval comes from
`docs/operations/cost-approval.md`.

## Whole-build rules

### Product and frontend

- Launch the physical-card MVP in Canada and CAD before any US checkout.
- Preserve the approved visual system and customer route journey.
- Do not introduce Tailwind.
- Use TanStack Query for server state, focused Zustand stores only for ephemeral
  cross-component workflow state, and React state for isolated inputs.
- Keep users, credits, prices, entitlements, drafts, assets, orders, payments, and
  fulfillment server-authoritative.
- Persist active drafts through the API. Never persist access or refresh tokens in
  Zustand or `localStorage`.
- Keep non-MVP experiences clearly non-transactional. They may not simulate a real
  payment, send, email, reward, redemption, or fulfillment event.
- Refactor oversized components without changing approved presentation; verify any
  visual change with responsive browser evidence.

### Repository and architecture

- Work only from the canonical Desktop clone on the user's Windows computer:
  `C:\Users\wilso\Desktop\Souvenote_Design_Codex`. CI and purpose-created isolated
  review worktrees are the only exceptions.
- Use the TypeScript npm-workspace modular monolith under `apps/`, `packages/`,
  `database/`, `infra/`, and `docs/`.
- Use Node.js 22 and npm 10.9.8 as the canonical local and CI toolchain.
- Keep web, API, and worker separately runnable but do not split them into
  microservices.
- Web imports generated contracts, never API implementation code.
- Controllers handle HTTP concerns, domain services own business rules,
  repositories alone execute SQL, and provider SDKs stay inside adapters.
- Jobs call domain services and do not duplicate business rules.
- Infrastructure contains no secrets or application business rules.
- Slow, failure-prone, or provider work runs asynchronously.

### Contracts, security, and data

- New product APIs use `/api/v1` and a generated OpenAPI client.
- Authentication and ownership are default. Customer identity comes from validated
  Cognito tokens, never caller-supplied authoritative user IDs.
- Use Cognito authorization-code/PKCE through a Next.js BFF with secure HTTP-only
  application-session cookies.
- Require idempotency keys for monetary, credit, generation, webhook, order,
  checkout, and fulfillment mutations.
- Use the stable `ApiError`, generation, and upload states defined in
  `docs/engineering/architecture.md` and `packages/contracts`.
- Use PostgreSQL with SQL isolated in repositories.
- Build one verified MVP baseline with migration checksums. Applied migrations are
  immutable.
- Store money in integer minor units with ISO currency codes. Credit changes are
  atomic ledger transactions.
- Constrain state transitions, ownership foreign keys, indexes, provider IDs,
  webhook IDs, and idempotency keys in the database.
- Expire uncommitted uploads after 24 hours.
- Do not create speculative Gift, Trust Circle, chatbot, calendar, Harte Hanks, or
  community-catalog schemas before their requirements are approved.
- Raw card data, tokens, private asset URLs, prompts, messages, recipient names, and
  private-photo references must not enter logs or analytics.

### AI and media

- Keep image, music, text, moderation, payment, notification, and fulfillment
  providers behind typed adapters with deterministic mocks.
- Initial planned adapters are GPT Image 2 through fal, Lyria 3 through fal, and an
  approved Llama model through Bedrock. Availability is reverified immediately
  before paid activation.
- Generate at a provider-supported nearby 5:7 resolution, then validate and produce
  a separate canonical print asset from the approved Scribeless specification.
- Record provider/model/version, input hash, attempt, timing, result key,
  moderation, cost, credit reservation/refund, and sanitized error category.
- Apply moderation, rate limits, retry bounds, concurrency bounds, and rollback to
  mock mode before activating any provider.

### Cost, AWS, and external actions

- Preserve at least USD $1,000 of AWS credit as a safety reserve.
- Local mock acceptance must pass before AWS deployment or paid provider traffic.
- Every cost-increasing AWS mutation and every paid-provider activation requires a
  separate, explicit, scoped approval under `docs/operations/cost-approval.md`.
- An approval packet states the resource diff, one-time cost, monthly cost,
  worst-case exposure, credit eligibility, rollback, and data-loss risk.
- Silence is never approval. A question never times out or auto-resolves.
- Ordinary CI has no deployment credentials. Protected GitHub environments require
  the user as reviewer for staging and production.
- Deploy roles must block Marketplace purchases, reserved capacity, paid support
  changes, large compute, provisioned AI capacity, and IAM escalation.

## Mandatory task workflow

Use exactly one fresh, user-visible Codex task per PR-sized section. Its active title
must be `Section N — <build-plan section name>`. Continue within that single task
for planning, implementation, testing, debugging, review, publication, and handoff
of the same bounded change.

Only the active section task may mutate the canonical Desktop worktree. Do not use
another sidebar task as a worker, handoff target, retry, or workaround, and do not
run two visible section tasks concurrently. A replacement lead task may start only
after the user explicitly requests it or the existing lead cannot continue; the old
lead must stop and be archived before the replacement mutates anything.

Every task begins by:

1. Confirming the canonical repository or approved isolated worktree, branch,
   commit, upstream, and worktree status.
2. Reading `AGENTS.md`, this build plan, the MVP specification, the decision
   register, and the relevant architecture and operations documents.
3. Inspecting the actual implementation before making claims.
4. Running the relevant baseline checks.
5. Restating the goal, scope, evidence, risks, interfaces, and done conditions.
6. Asking about missing product decisions instead of guessing.
7. Waiting for the user to answer every question and accept the bounded plan before
   implementing when a question or new decision is required.

Use GPT-5.6 Sol for architecture, implementation, and review when it is available.
Use one lead and no more than three non-overlapping internal workers. Workers are
read-only by default and are not separate user-visible section tasks. Any editing
worker must use a purpose-created isolated worktree/branch with an explicit file
ownership boundary; it may never edit the canonical Desktop worktree. Workers must
not edit the same files or jointly edit migrations, shared contracts, lockfiles, or
infrastructure interfaces. The lead owns integration and final verification.

Every task ends with the completed template in
`docs/engineering/task-handoff.md`, including the branch, commit, behavior, changed
files, interfaces, migrations, tests, security/privacy review, cost impact, external
actions, unresolved risks, rollback, and exact next-task prompt.

After its section gate, handoff, draft PR, and exact-head required checks are
complete, rename the task `Section N — <build-plan section name> (Complete)` and
archive it before starting the next section. A duplicate or misnamed task must stop
before its next mutation, report its last mutation to the lead, be renamed
`Retired — <original purpose>`, and be archived after reconciliation. A new visible
task is created only on explicit user direction. A paused user question pauses the
whole section; another task or worker may not continue around it.

## Section 0 - Governance and reconciled specification

Required work:

- Add durable agent rules and the sanitized MVP specification.
- Add the decision register, architecture, approval policy, review checklist, and
  handoff template.
- Add credential-free, non-deploying CI.
- Record reconciled PRD/prototype decisions without committing the confidential PDF.

Gate: a fresh agent can accurately explain the MVP, authority order, cost rules, and
build sequence without this conversation or the confidential PDF.

## Section 1 - Workspace and clean baseline

Required work:

- Consolidate into the canonical npm-workspace layout with one root lockfile.
- Add root formatting, lint, type, test, production audit, and build commands.
- Pin Node.js 22 and npm 10.9.8 locally and in CI.
- Add PostgreSQL 16 local orchestration and a separately runnable idle worker.
- Add a safe one-command supervisor for web, API, worker, and database.
- Add liveness/readiness checks, port-ownership checks, credential neutralization,
  mock/disabled provider modes, and volume-preserving cleanup.
- Do not run the legacy migrations or legitimize transitional insecure APIs.
- Remove high-severity production dependency findings.
- Preserve the approved frontend route journey and visual assets.

Gate: one command starts web, API, worker, and PostgreSQL with live health checks;
the clean install, all root checks, production audit, stack smoke test, browser route
check, and independent GitHub CI pass without credentials or paid traffic.

## Section 2 - Schema, contracts, and security

Required work:

- Replace the draft migration chain with one verified MVP baseline and checksum
  journal.
- Introduce `/api/v1`, the OpenAPI document, generated contracts, and generated web
  client.
- Implement Cognito PKCE/BFF sessions, token validation, authentication-by-default,
  ownership-by-default, secure headers, CSRF protection, limits, and redacted logs.
- Remove public credit mutation and caller-supplied identity vulnerabilities.

Gate: clean-database migrations and generated contracts pass; cross-user access,
arbitrary credits, invalid tokens, and missing idempotency keys fail automated tests.

## Section 3 - Pricing, credits, and entitlements

Required work:

- Implement the CAD catalog and server-owned totals.
- Implement idempotent starter credits and the approved generation costs/refunds.
- Implement the three approved standalone CAD credit-pack offers and an idempotent
  deterministic mock purchase/grant path. Users may buy packs repeatedly.
- Implement physical-card entitlements and Big Sender reservations for 2-30 cards.
- Implement the five-day Try Risk-Free/fixed-CAD-$2 state machine in mock payment
  mode.
- Remove the first-send bonus and conflicting pricing/currency copy.

Gate: ledger, pricing, standalone-pack purchase/grant, reservation, refund,
transition, concurrency, and idempotency integration tests pass.

## Section 4 - Creation workflow with mocks

Required work:

- Refactor Personalize a Template and Build My Card behind the same secured backend
  journey while preserving presentation.
- Implement persisted drafts, uploads, rights attestation, moderation lifecycle,
  generation jobs, review/approval, individual regeneration, and library resume.
- Remove demo state, hardcoded users/balances, production debug globals, and
  authoritative `localStorage` behavior.
- Use deterministic local and CI providers only.

Gate: both creation routes complete locally through delivery with persistence,
failure/refund behavior, and responsive visual evidence, using no paid calls.

## Section 5 - Checkout and fulfillment mocks

Required work:

- Use Stripe test components so raw card data never enters Souvenote code or logs.
- Implement server-owned totals, payment state, verified/idempotent webhooks, and the
  Try Risk-Free resolution schedule.
- Convert standalone credit-pack checkout from deterministic mock capture to
  Stripe-hosted test collection, granting the selected pack exactly once only after
  verified capture.
- Implement the physical blank-card entitlement behavior.
- Implement a typed Scribeless adapter and mock/sandbox fulfillment state machine.

Gate: checkout, webhook, payment-resolution, fulfillment, duplicate, retry, failure,
reconciliation, and recovery integration tests pass.

## Section 6 - Approved AWS staging

Required work:

- Prepare an AWS/CDK resource and gross-cost approval packet.
- After explicit scoped approval, deploy the minimum staging resources.
- Keep every paid provider feature flag off.
- Run staging smoke, backup/restore, and rollback tests.

Gate: the user-approved staging envelope, resource diff, observability, restore, and
rollback evidence are recorded. Without approval, this section remains blocked and
no mutation occurs.

## Section 7 - Provider activation

Activate providers separately and in this order unless an approved decision changes
it:

1. S3 upload/storage.
2. Bedrock text.
3. GPT Image 2.
4. Lyria 3.
5. Stripe test integration.
6. Scribeless sandbox.
7. SendGrid sandbox.
8. PostHog and Sentry.

Each activation requires a separate approval where traffic is metered, plus cost
logging, feature flags, rate limits, moderation where applicable, bounded retries,
failure tests, sanitized observability, and rollback to mock/disabled mode.

Gate: one provider at a time passes its contract, cost, safety, failure, and rollback
checks before the next provider is considered.

## Section 8 - Production readiness

Required work:

- Complete Canadian tax, legal, privacy, payment, and fulfillment reviews.
- Confirm the complete Scribeless print specification and blank-card payload.
- Complete accessibility, responsive/mobile, security, secret, dependency,
  performance, route, and data-retention audits.
- Establish dashboards, alerts, backups, reconciliation, incident response, and
  rollback runbooks.
- Present separate production infrastructure and paid-provider approval packets.

Gate: every MVP acceptance criterion below has current evidence, every production
approval is explicit and scoped, and rollback/incident procedures have been tested.

## MVP completion contract

The MVP is not complete until current evidence proves all of the following:

- Email/password, Google, Apple, and Facebook authentication work through Cognito.
- First provisioning grants exactly two starter credits once.
- Authenticated users can repeatedly purchase the approved 10/CAD $2,
  80/CAD $10, and 250/CAD $25 standalone credit packs, with each captured purchase
  granting credits exactly once.
- Both creation routes use the same secured backend journey.
- First combined image/song generation costs two credits.
- Regenerating one paid asset costs one credit only for that asset.
- Provider failure refunds exactly once.
- Inside-message generation charges zero user credits.
- Try Risk-Free implements five-day CAD $9.99 authorization/capture or fixed CAD $2
  no-send behavior exactly once.
- Big Sender supports 2-30 cards at the approved CAD tiers.
- Raw card data never enters Souvenote inputs, APIs, logs, analytics, or storage.
- A print-ready physical order reaches the Scribeless sandbox with correct artwork,
  QR metadata, recipient address, and sender address.
- My Cards and Songs persists and resumes drafts, assets, cards, and orders.
- Future-feature routes cannot perform or simulate real actions.
- PostHog receives no PII and Sentry receives only sanitized failures.
- Critical tests, builds, audits, migrations, staging smoke tests, backup/restore, and
  rollback checks pass on the release candidate.

## Change control and status

- A section may not claim a later section's deliverable to close its own gate.
- Evidence from an older branch or section is not reusable as current completion
  evidence; rerun the applicable checks on the candidate commit.
- A failed gate is fixed in the same bounded section or recorded as an explicit,
  approved blocker. It is never hidden behind a green narrower check.
- Changes to this plan require an approved, dated decision-register entry explaining
  what changed, why, what it supersedes, and the affected gates.
- The repository policy tests verify that this document, its nine sections, task
  workflow, approval boundaries, and MVP completion contract remain wired into
  `AGENTS.md`, the root README, and CI.

Current section status:

| Section | Status                                       | Evidence                                                               |
| ------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 0       | Merged                                       | PR #1 and `docs/product/decision-register.md`                          |
| 1       | Merged                                       | PR #2 and `docs/engineering/section-1-audit.md`                        |
| 2       | Merged                                       | PR #3 and `docs/engineering/section-2-audit.md`                        |
| 3       | Merged; approved credit-pack correction open | PR #4 and `docs/engineering/section-3-credit-pack-correction-audit.md` |
| 4-8     | Not started                                  | Must follow this document in fresh PR-sized tasks                      |
