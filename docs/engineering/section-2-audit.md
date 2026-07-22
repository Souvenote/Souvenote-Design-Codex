# Section 2 completion audit

Audited: 2026-07-21

Branch: `codex/section-2-schema-contracts-security`

Base: `7449088f199bb6291069dfe7788668a4876eb589`

Status: local implementation and every local gate pass; draft PR #3 is published and final GitHub checks must pass on its final head before this gate is closed.

## Scope and authority

This audit maps every Section 2 requirement to current implementation evidence. It does not claim Section 3 pricing/entitlement state machines, Section 4 provider workflow completion, or Section 5 checkout/fulfillment completion.

Authoritative sources read for this task:

- `AGENTS.md`
- `docs/engineering/build-plan.md`
- `docs/product/mvp-spec.md`
- `docs/product/decision-register.md`
- `docs/engineering/architecture.md`
- `docs/operations/cost-approval.md`
- `docs/engineering/section-1-audit.md`
- `docs/engineering/code-review.md`
- `docs/engineering/task-handoff.md`
- `docs/engineering/local-development.md`

## Acceptance matrix

| Requirement                            | Result                                 | Implementation and verification evidence                                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One pre-launch baseline                | Pass                                   | Deleted the three unapproved draft migrations and seed; `database/migrations/0001_mvp_baseline.sql` contains only the approved physical-card MVP schema.                                                                                                                               |
| Immutable SHA-256 journal              | Pass                                   | `database/migrate.mjs` verifies `checksums.sha256`, the database journal, exact bytes, version/name uniqueness, and an advisory lock before applying a transaction.                                                                                                                    |
| Complete MVP schema                    | Pass                                   | Users, auth identities, hashed sessions, idempotency, price books/offers, atomic credits, entitlements, drafts/revisions, uploads, jobs/attempts, assets/share metadata, orders/items, payments/webhooks, fulfillment/shipments, notifications, audit events, and feature flags exist. |
| No speculative future schema           | Pass                                   | SQL contract tests reject Gift, Trust Circle, chatbot, calendar, Harte Hanks, digital-card, and community-catalog tables.                                                                                                                                                              |
| Database constraints and ownership     | Pass                                   | Composite owner foreign keys, owner indexes, state triggers, minor-unit/ISO checks, provider uniqueness, idempotency uniqueness, append-only triggers, and 24-hour upload expiry are verified against PostgreSQL 16.                                                                   |
| Clean/repeat/tamper migration behavior | Pass                                   | `database/verify.mjs` uses a unique volume-free PostgreSQL container, proves clean apply, second-run no-op, SQL invariants, manifest tamper rejection, and exact-container cleanup.                                                                                                    |
| `/api/v1` contract                     | Pass                                   | Product and health routes use `/api/v1`; controllers publish every approved resource group.                                                                                                                                                                                            |
| Generated OpenAPI client               | Pass                                   | Nest emits `packages/contracts/openapi.json`; `openapi-typescript` emits the checked-in client types; web uses `openapi-fetch` through `@souvenote/contracts`; `contracts:check` fails on drift.                                                                                       |
| Stable errors and states               | Pass                                   | OpenAPI protects `ApiError`, upload states, asset generation states, and aggregate generation states; exception handling returns a request ID without sensitive data.                                                                                                                  |
| Bounded collection contracts           | Pass                                   | Owner-scoped cursor pagination with limits 1-100 covers drafts, entitlements, assets, jobs, and orders.                                                                                                                                                                                |
| Cognito PKCE/BFF                       | Pass in code; activation gate recorded | Next BFF implements authorization code + S256 PKCE, state, nonce, ID-token verification, code exchange, refresh rotation, logout, bounded timeouts/responses, and fail-closed configuration. No live Cognito call was made.                                                            |
| Browser token isolation                | Pass                                   | Access/refresh tokens exist only inside encrypted HttpOnly SameSite cookies and server requests; policy tests reject browser token persistence, public Cognito config, direct SDK usage, and hardcoded identities.                                                                     |
| Deterministic local auth               | Pass                                   | Signed HMAC access token uses the same BFF cookie/API/repository boundary, requires explicit development/test mode and secrets, and is loopback-only in web and API.                                                                                                                   |
| API token validation                   | Pass                                   | Cognito access tokens require RS256 signature, bounded JWKS, issuer, client, `token_use=access`, subject, email, `iat`, `exp`, optional `nbf`, and required scopes. Invalid claim/signature/JWKS cases are tested.                                                                     |
| Authentication/default deny            | Pass                                   | A global guard protects every route except explicit health, public pricing/share, and signature-verified webhooks. OpenAPI and source policy tests verify the boundary.                                                                                                                |
| Idempotent provisioning                | Pass                                   | Principal identity is derived from the token; concurrent first requests create one user and one exactly-once two-credit signup grant.                                                                                                                                                  |
| CSRF, CORS, headers, limits            | Pass                                   | BFF enforces exact same-origin metadata plus `x-souvenote-csrf`; API rejects BFF cookies, uses exact-origin CORS, production HSTS, hardened headers, 1 MiB bodies, bounded validation, bounded in-memory rate-limit keys, and safe trust-proxy configuration.                          |
| Redacted logs/errors                   | Pass                                   | Structured request logs contain only request metadata; unit tests prove bodies, tokens, users, prompts, recipient data, and unexpected exception messages are absent.                                                                                                                  |
| Caller authority removed               | Pass                                   | Customer DTOs contain no `userId`, price, currency, credit, payment, owner, or lifecycle authority. Validation rejects extra fields.                                                                                                                                                   |
| Public credit mutations removed        | Pass                                   | Only authenticated `GET /credits` exists; arbitrary credit POST is 404. Ledger mutation remains repository/database controlled.                                                                                                                                                        |
| Owner-scoped SQL                       | Pass                                   | Controllers are transport-only, services contain domain rules, and repositories alone execute SQL. Cross-user tests cover drafts, uploads, assets, jobs, orders, checkout, fulfillment, and absent payment-method APIs without existence disclosure.                                   |
| Sensitive mutation idempotency         | Pass                                   | Upload request/complete, generation, order, checkout, and fulfillment require a 16-128 character header and database uniqueness. Webhooks use signature-verified provider event IDs as their provider-native idempotency key.                                                          |
| Later-section honesty                  | Pass                                   | Checkout and fulfillment return explicit conflicts; payment methods, Gift, redemption, referral, contact send, regeneration, checkout, fulfillment, and confirmation UI are clearly coming soon and cannot simulate success.                                                           |
| No paid/external action                | Pass                                   | Deterministic mocks and local Docker only. No AWS mutation, Cognito console/provider call, Stripe payment, Scribeless job, email, analytics, or other metered traffic occurred.                                                                                                        |

## Security-test coverage

Automated coverage includes:

- clean database, repeat/no-op, checksum journal, manifest tamper, schema shape, state/owner/money constraints, and append-only history;
- generated-contract drift and contract-policy checks;
- default-deny/public routes, signed local cookie boundary, PKCE/state/nonce, sealed-cookie tamper, and non-loopback rejection;
- invalid JWT signature, issuer, client, token use, issued/expiry/not-before times, scopes, JWKS failures, and Cognito key caching;
- CSRF, CORS, secure headers, request IDs, stable validation/parser errors, payload limits, bounded rate limits, and log redaction;
- missing/reused idempotency keys and duplicate generation/order/upload/webhook requests;
- cross-user access for each currently exposed owned resource;
- arbitrary credit mutation and caller-supplied identity/price/currency rejection;
- exactly-once starter credits under eight concurrent provisioning requests;
- verified webhook signatures, duplicate delivery, payload-hash storage, and payload non-retention;
- bounded, owner-scoped pagination.

## Intentionally deferred behavior

- Section 3 owns the approved active CAD catalog, provisional credits, credit refund state machine, card reservations, and Try Risk-Free resolution. Section 2 creates constrained storage and server-owned totals but no active catalog seed.
- Section 4 owns complete mock provider jobs, persisted upload bytes/moderation, generation outputs, per-asset regeneration/refunds, library resume, and responsive visual acceptance.
- Section 5 owns Stripe test components, payment state machines, blank-card payload, and Scribeless mock/sandbox fulfillment. Section 2 routes fail closed instead of simulating them.
- The worker remains idle. Slow provider work does not run synchronously in this section.

## Activation risks and gates

- No real Cognito environment was called. Before staging, the approved user-pool access token must expose the verified email claim expected by idempotent provisioning, and email/password plus Google, Apple, and Facebook flows must be exercised end to end.
- The API rate limiter is bounded per process and is defense in depth. Staging/production require a separately approved shared edge limit before horizontal scale.
- No shared database exists. Once this baseline is applied to a shared environment it becomes immutable; future schema changes require append-only migrations and upgrade-path tests.
- Section 2 is stacked on the unmerged Section 1 branch. Its draft PR must target `codex/section-1-workspace` until the base is merged.

## Cost and external actions

- AWS resources created/updated/deleted: none.
- Paid-provider calls: none.
- Live payments, fulfillment, email/SMS, analytics, or error reporting: none.
- External service cost: CAD $0 / USD $0.
- Allowed tooling only: npm registry, local Docker/PostgreSQL, Git/GitHub, and local browser verification.

## Final gate evidence

The local candidate passed on Windows with Node 22.22.0 and npm 10.9.8:

| Gate                      | Result                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean install             | `npm ci` installed 913 packages from the single lockfile                                                                                                                                                                                                                                                    |
| Contracts                 | generation/drift checks passed with deterministic checked-in OpenAPI artifacts                                                                                                                                                                                                                              |
| Aggregate quality         | `npm run verify` passed formatting, lint, type checks, 20 script tests, 31 API tests, 9 web tests, 8 worker tests, all builds, and the production audit                                                                                                                                                     |
| Web build                 | Next.js built all 40 routes                                                                                                                                                                                                                                                                                 |
| Dependency security       | production and full dependency audits reported zero vulnerabilities                                                                                                                                                                                                                                         |
| Database                  | `npm run test:database` passed clean apply, repeat no-op, journal/checksum tamper, schema, constraint, and cleanup verification against isolated PostgreSQL 16                                                                                                                                              |
| Integrated stack          | `npm run smoke:stack` passed after an explicit migration; web, API, worker, and PostgreSQL health checks passed and ordinary cleanup preserved `souvenote-local-postgres-data`                                                                                                                              |
| Browser/security boundary | Local signed-cookie login reached the same authenticated API boundary; `/profile` showed exactly two starter credits and no fabricated holdings; Gift, Referral, payment methods, contact, confirmation, checkout, and fulfillment surfaces remained disabled, fail-closed, or explicitly non-transactional |
| Raw payment-card boundary | Removed the legacy raw card-number/CVC React form and added a repository policy test that rejects raw payment-card fields in application source                                                                                                                                                             |
| Cleanup                   | Web/API/worker ports were released and the PostgreSQL container was stopped without deleting the normal local volume                                                                                                                                                                                        |

The published final head must additionally pass both required GitHub jobs:

- Workspace quality gate.
- Credential-free local stack.
