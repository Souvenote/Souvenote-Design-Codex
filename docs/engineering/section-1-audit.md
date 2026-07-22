# Section 1 completion audit

Audited: 2026-07-21

Branch: `codex/section-1-workspace`

Starting head: `186d08ed780bbf343e15730fdf80a56d1c3b676b`

Status: pass after the corrections in this audit, conditional on both required
GitHub checks succeeding on the final PR #2 head.

This audit re-proves Section 1 from the current Desktop worktree and external PR
state after an interrupted computer session. It does not use the earlier chat or an
older CI run as completion evidence.

## Scope and authority

Audited sources:

- `AGENTS.md`
- `docs/engineering/build-plan.md`
- `docs/product/mvp-spec.md`
- `docs/product/decision-register.md`
- `docs/engineering/architecture.md`
- `docs/operations/cost-approval.md`
- Section 1 implementation, root scripts, package graph, Compose definition, CI,
  API/worker health boundaries, and approved browser routes

Section 2 authentication, ownership, `/api/v1`, generated OpenAPI contracts, and
verified schema work remain out of Section 1. Sections 3-5 own conflicting product
copy, server-authoritative pricing/credits, demo workflow removal, checkout, and
fulfillment behavior.

## Findings corrected

| ID     | Finding                                                                                                                                                                                                            | Risk                                                                                 | Correction                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1-A01 | The repository did not contain the complete approved Sections 0-8 build sequence, gates, model/concurrency rules, and final acceptance contract.                                                                   | Future tasks could skip or reinterpret the plan.                                     | Added mandatory `docs/engineering/build-plan.md`, decision `MVP-020`, task-entry links, and governance tests.                                                                                |
| S1-A02 | `.prettierignore` used an unanchored `database/` pattern, silently excluding API and worker source folders named `database`. Two ignored files contained formatting debt, including committed trailing whitespace. | Green formatting checks did not cover all governed TypeScript.                       | Anchored the ignore to `/database/`, formatted both source folders, and added a tracked-file whitespace policy test.                                                                         |
| S1-A03 | The package engines allowed Node 22-24 and npm 10-11 while the approved toolchain is Node 22/npm 10.9.8. The host default was Node 24/npm 11.                                                                      | Local results could diverge from CI and be described as canonical.                   | Narrowed engines, added a fail-closed runtime/toolchain check to verification and the supervisor, and documented version checks.                                                             |
| S1-A04 | API and web package READMEs still contained generic starter commands; the API README advertised an unrelated AWS deployment product.                                                                               | Contributors could create a second dependency graph or bypass cost/deployment rules. | Replaced both with Souvenote-specific root-workspace and milestone-boundary guidance.                                                                                                        |
| S1-A05 | A separate Documents clone remains at pre-governance commit `84654d7`.                                                                                                                                             | A future task could edit or test the wrong repository.                               | `AGENTS.md` now requires the exact Desktop clone on the user's Windows computer and explicitly rejects the stale Documents clone as a fallback. The stale clone was not modified or deleted. |

## Requirement-by-requirement result

| Section 1 requirement                 | Result             | Evidence                                                                                                                                                                 |
| ------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical workspace layout            | Pass               | Root workspaces are `apps/*` and `packages/*`; repository policy proves the old `front end` and `backend/server` paths are absent.                                       |
| One root dependency graph             | Pass               | Clean npm 10.9.8 install from the single root `package-lock.json`; policy rejects nested npm/yarn/pnpm locks.                                                            |
| Canonical toolchain                   | Pass               | Node 22.22.0 and npm 10.9.8 passed the fail-closed toolchain gate; other versions fail unit tests.                                                                       |
| Root quality commands                 | Pass               | Formatting, zero-warning lint, all TypeScript checks, 39 tests, all workspace builds, and production audit passed.                                                       |
| PostgreSQL 16 local orchestration     | Pass               | Compose validated; PostgreSQL bound to `127.0.0.1:55432`, reached healthy state, and its named volume survived cleanup.                                                  |
| Separately runnable worker            | Pass               | Idle NestJS worker started, rejected live/non-local modes in tests, and returned database-backed readiness.                                                              |
| One-command local lifecycle           | Pass               | `npm run smoke:stack` started PostgreSQL, web, API, and worker; all readiness targets passed; owned processes/containers stopped.                                        |
| Health and real web pipeline          | Pass               | Web health, native Next.js image optimization, API database readiness, and worker database readiness all passed.                                                         |
| No automatic legacy migration         | Pass               | Root lifecycle, health, test, build, and CI scripts contain no migration/seed execution; readiness proves connectivity only.                                             |
| Credential/provider boundary          | Pass               | Supervisor neutralizes inherited credentials, forces mock/disabled modes, and sends no paid traffic. Repository contains no live provider adapter activation.            |
| High-severity dependency debt removed | Pass               | Production and full dependency audits both reported zero vulnerabilities. Sharp 0.35.3 image optimization passed locally and in the prior Linux stack run.               |
| Non-deploying CI                      | Pass               | Workflow permissions are read-only and jobs only install, verify, validate Compose, and run the credential-free stack.                                                   |
| Visual route preservation             | Pass for Section 1 | Browser loaded all five approved routes and found no console warning/error. No CSS or public asset is changed by this audit.                                             |
| Whole-build plan is durable           | Pass               | Build plan contains Sections 0-8, nine gates, mandatory workflow, approval boundaries, and the final MVP contract; CI tests enforce its structure and entry-point links. |

## Verification evidence

Canonical clean install:

```text
Node.js 22.22.0
npm 10.9.8
npm ci --no-audit: 913 packages installed successfully
```

Aggregate verification:

```text
Prettier: pass
ESLint: pass with zero warnings
TypeScript: API, web, worker, contracts pass
Tests: 11 supervisor/governance + 20 API + 8 worker = 39 pass
Builds: API, web, worker, contracts pass
Next.js: 34 pages plus /api/health generated
Production audit: 0 vulnerabilities
Full audit including dev dependencies: 0 vulnerabilities
```

Integrated stack:

```text
PostgreSQL 16 healthy
Web /api/health ready
Next.js image optimizer ready
API /api/health/ready connected
Worker /health/ready connected in idle mode
All owned ports free after cleanup
souvenote-local-postgres-data preserved
```

Browser route audit:

| Route                            | Heading                        | Rendered height | Console warning/error |
| -------------------------------- | ------------------------------ | --------------: | --------------------- |
| `/`                              | A card worth keeping           |         3532 px | None                  |
| `/pricing`                       | Pricing surface rendered       |        12460 px | None                  |
| `/create`                        | Choose how to create your card |         1447 px | None                  |
| `/create/build-my-card`          | Bring your card to life        |         9702 px | None                  |
| `/create/personalize-a-template` | Personalize a template         |         9738 px | None                  |

The browser viewport differed from the historical comparison capture, so current
heights are route-health evidence rather than pixel-regression baselines. The
historical before/after dimensions remain in `current-baseline.md`.

## Non-blocking dependency observations

- npm reports deprecated `inflight@1.0.6`, `glob@7.2.3`, and `glob@10.5.0` through
  the current Jest coverage/tooling graph. They are development-only transitive
  packages and produce no current audit advisory. Review them when Jest/ts-jest
  releases remove the chain; do not force an incompatible override.
- npm 10 on Windows labels the installed optional `@img/sharp-wasm32` artifact as
  extraneous while resolving the required `@img/sharp-win32-x64`. It is untracked,
  is reproduced by a clean install, has no audit advisory, and does not affect the
  passing native image-optimizer check.

## Intentionally deferred risks

- Transitional `/api` routes still expose caller-supplied identity and credit
  mutations. They are local-only debt and block any shared environment until
  Section 2 replaces them.
- Current prototype copy still contains USD, seven-day/pay-per-credit, referral,
  shipping, and other reconciled conflicts. Sections 3 and 4 must replace them
  without a visual rewrite.
- Demo balances, libraries, mock successes, and oversized frontend components remain
  Section 4/5 debt.
- Some responsive routes exhibit existing horizontal overflow at the audit viewport.
  Section 8 owns the complete responsive/accessibility audit; any earlier touched
  route must avoid worsening it and provide visual evidence.

None of these deferred risks is promoted as safe or complete by Section 1.

## Security, privacy, cost, and external actions

- No secret or credential was committed.
- No legacy migration was applied by the audit.
- No AWS resource was created, updated, or deleted.
- No Bedrock, fal, Stripe, Scribeless, SendGrid, PostHog, Sentry, or other paid/live
  provider traffic occurred.
- Local Docker, npm registry access, GitHub reads, and browser verification were the
  only external/tooling actions.
- External service cost: CAD $0 / USD $0.

## Merge gate

PR #2 may be marked ready only after its final head has both required GitHub checks
green:

1. Workspace quality gate.
2. Credential-free local stack.

It remains a draft until the user explicitly asks to mark or merge PR #2.
