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

The repository is currently organized as:

- `front end/`: Next.js 15 and React 19 frontend.
- `backend/server/`: NestJS 11 API.
- `backend/database/`: draft PostgreSQL migrations and seeds.
- `backend/docs/`: legacy backend notes that may be stale.

The approved target workspace layout is documented in `docs/engineering/architecture.md`. Do not perform broad moves as part of an unrelated feature.

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

## Task start protocol

Each PR-sized task must begin by:

1. Confirming this Desktop repository, current branch, commit, and clean/dirty status.
2. Reading this file, the MVP specification, decision register, and relevant architecture section.
3. Inspecting the implementation before making claims.
4. Running relevant baseline checks.
5. Restating goal, scope, evidence, risks, affected interfaces, and done conditions.
6. Asking about unresolved product decisions instead of guessing.

Use a fresh task for each PR-sized change. Stay in the same task for testing, debugging, and review of that same change.

## Current verification commands

Frontend:

```powershell
Set-Location 'front end'
npm.cmd ci
npm.cmd exec -- next typegen
npm.cmd exec -- tsc --noEmit --incremental false
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=critical
```

Backend:

```powershell
Set-Location 'backend/server'
npm.cmd ci
npm.cmd exec -- tsc --noEmit --incremental false
npm.cmd test -- --runInBand --no-cache
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=critical
```

Run frontend commands sequentially because both type generation and the production build update `.next`. Do not use `npm run lint` in CI while it contains `--fix`; CI checks must not rewrite source files. The current lint and dependency-audit debt is documented in `docs/engineering/current-baseline.md` and must be fixed in Section 1 before those checks become blocking.

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
