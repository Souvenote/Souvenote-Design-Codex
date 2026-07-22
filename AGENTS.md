# Souvenote agent guide

This file is the durable entry point for every human or coding agent working in this repository. Read it before inspecting implementation files or proposing changes.

## Authority order

When sources disagree, use this order:

1. Explicit user decisions recorded in `docs/product/decision-register.md`.
2. The reconciled specification in `docs/product/mvp-spec.md`.
3. The product PRD for scope and intent. The confidential source PDF is not stored in Git.
4. The current application for approved visual design and route journey.
5. `docs/engineering/architecture.md` and security rules for implementation decisions.
6. Legacy repository documentation only where it does not conflict with the sources above.

Do not silently choose between conflicting requirements. Record the conflict and obtain a decision before implementing it.

## Canonical workspace and current layout

The canonical local clone is `C:\Users\wilso\Desktop\Souvenote_Design_Codex`.

The canonical npm-workspace layout is:

- `apps/web/`: Next.js 15 and React 19 frontend.
- `apps/api/`: NestJS 11 HTTP API.
- `apps/worker/`: asynchronous worker process; intentionally idle except for health behavior until later sections add jobs.
- `packages/contracts/`: contract-package placeholder until Section 2 generates the OpenAPI client and shared schemas.
- `packages/config/`: shared workspace configuration.
- `database/`: legacy draft SQL plus the future verified migration baseline. Legacy migrations are never run automatically.
- `infra/`: infrastructure boundary and documentation placeholder. Its presence is not deployment approval.
- `docs/`: authoritative product, engineering, and operational guidance plus explicitly non-authoritative legacy material.

Use Node.js 22 as the canonical local and CI runtime. Local PostgreSQL is version 16 and binds only to `127.0.0.1:55432`. See `docs/engineering/local-development.md` before starting or stopping the stack.

## Locked MVP rules

- Canada launches first and checkout is CAD-only until a separately approved USD catalog exists.
- Try Risk-Free is a five-day CAD $9.99 authorization. Capture CAD $9.99 when sent; otherwise charge a fixed CAD $2.00 and release the remainder.
- Big Sender starts at two cards with 2-10 at $8.99/card, 11-20 at $7.99/card, and 21-30 at $6.99/card.
- Signup grants two starter credits exactly once.
- The first combined image and song generation costs two credits. Image or song regeneration costs one credit per regenerated asset. Inside-message generation costs zero user credits.
- The first-send bonus is removed.
- Standard MVP songs are 30 seconds.
- Preserve the current visual design and route journey. Do not migrate the application to Tailwind.
- Gift, redemption, community, B2B, full referral, Trust Circle, calendar, chatbot, recipient reward, and digital-card transactions are inactive placeholders for MVP.
- The one-card blank-card handoff is part of the physical MVP and is not the broader Gift a Souvenote flow.
- Build a complete MVP schema plus stable extension points. Do not speculate full V2 feature schemas.

## Engineering boundaries

- Keep a modular monolith. Do not introduce microservices without an approved architecture decision.
- Web code may depend on generated contracts, never API implementation files.
- Controllers handle transport concerns; domain services own business rules; repositories alone execute SQL.
- Provider SDKs belong only in adapter modules.
- Credits, prices, orders, payments, entitlements, users, assets, and fulfillment are server-authoritative.
- Use integer minor units and ISO currency codes for money. Never use floating-point arithmetic for monetary decisions.
- User identity comes from validated authentication. Customer APIs must not accept authoritative user IDs, prices, credits, currency, tax, or payment state.
- Monetary, credit, generation, webhook, and fulfillment mutations must be idempotent.
- Slow or failure-prone external work runs asynchronously and supports retry and duplicate delivery.
- Do not expose tokens, passwords, card data, private asset URLs, message text, recipient names, or uploaded-photo references in logs or analytics.
- No new `any`, `@ts-ignore`, public debug globals, hardcoded production users, or simulated production success states.
- Existing oversized frontend files must not grow. Extract new behavior into focused modules when touching them substantially.

## Paid action and infrastructure prohibition

AWS inspection and local mock development are allowed. Do not create, update, deploy, scale, purchase, subscribe, enable paid traffic, or delete external resources without an explicit scoped user approval matching `docs/operations/cost-approval.md`.

This includes:

- `cdk deploy`, CloudFormation execution, and mutating AWS CLI or console actions.
- Real Bedrock, fal, Stripe, Scribeless, SendGrid, PostHog, Sentry, OpenAI API, or other metered traffic.
- Live payments, print jobs, email/SMS batches, domains, Marketplace products, support plans, reserved capacity, or trials that convert to paid plans.

Silence is denial. Approval for one action is not reusable.

Section 1 is local-only and has no AWS or paid-provider cost. Authentication is disabled only in the explicit local environment and the API must reject that mode in any non-local environment. Provider modes remain deterministic mock or disabled. Do not add a permissive fallback when configuration is missing.

## Task start protocol

Each PR-sized task must begin by:

1. Confirming this Desktop repository, current branch, commit, and clean/dirty status.
2. Reading this file, the MVP specification, decision register, and relevant architecture section.
3. Inspecting the implementation before making claims.
4. Running relevant baseline checks.
5. Restating goal, scope, evidence, risks, affected interfaces, and done conditions.
6. Asking about unresolved product decisions instead of guessing.

Use a fresh task for each PR-sized change. Stay in the same task for testing, debugging, and review of that same change.

## Current workspace commands

Run workspace commands from the repository root. `npm run verify` is the aggregate non-deploying quality gate; the individual commands remain available for focused diagnosis.

```powershell
npm.cmd ci
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run audit:prod
npm.cmd run verify
```

Local-stack lifecycle commands are:

```powershell
npm.cmd run dev
npm.cmd run health
npm.cmd run smoke:stack
npm.cmd run dev:down
```

`dev:down` preserves the PostgreSQL Docker volume during normal shutdown. Never improvise a reset, volume deletion, or legacy migration command. The Section 1 branch-level checks and stack smoke test are recorded in `docs/engineering/current-baseline.md`.

The API retains its transitional `/api` prefix during Section 1. Section 2 owns the authenticated `/api/v1` contract and generated client migration.

## Definition of done

A change is not complete until:

- Required checks for the current milestone pass. A known baseline exception must be documented and assigned to a bounded follow-up milestone rather than hidden.
- New behavior has automated coverage appropriate to its risk.
- The diff has been reviewed for security, ownership, idempotency, PII, and cost implications.
- Public contract or schema changes are documented.
- No unrelated user changes are overwritten.
- No secret or credential is committed.
- Any external action and its approval ID are recorded.
- The handoff format in `docs/engineering/task-handoff.md` is completed.

Use `docs/engineering/code-review.md` for final review.
