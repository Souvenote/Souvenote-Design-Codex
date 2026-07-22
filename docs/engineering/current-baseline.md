# Historical engineering baseline and Section 1 status

Recorded: 2026-07-21
Base commit: `84654d79c023fe4a6c65733ac470a3c38637aa1e`

The first part of this document records verified facts about the pre-reconciliation repository at the base commit above. Those paths, commands, advisories, and results are historical evidence, not current instructions and not permission to preserve unsafe behavior. Current commands live in `AGENTS.md` and `docs/engineering/local-development.md`.

## Historical passing local checks

At the recorded base commit, the frontend checks below passed from the former `front end/` path:

```powershell
npm.cmd ci
npm.cmd exec -- next typegen
npm.cmd exec -- tsc --noEmit --incremental false
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=critical
```

At the recorded base commit, the backend checks below passed from the former `backend/server/` path:

```powershell
npm.cmd ci
npm.cmd exec -- tsc --noEmit --incremental false
npm.cmd test -- --runInBand --no-cache
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=critical
```

The historically verified backend suite contained one unit suite with five tests. It mocked database behavior and was not full integration coverage. These results do not prove the Section 1 workspace passes.

## Historical quality and security debt

- Backend non-fixing ESLint reports 169 findings (168 errors and one warning). The current `npm run lint` command contains `--fix` and must not run in CI.
- Frontend has no lint or test command.
- A high-severity production-dependency audit currently fails both packages. Frontend advisories flow through Next/sharp/libvips; backend advisories flow through body-parser, js-yaml, and multer.
- The audit gate is temporarily critical-only. Section 1 must review dependency upgrades, remove high-severity findings, add non-mutating lint commands, and raise CI to a high-severity gate.
- Backend end-to-end tests are stale and require database configuration. The mock-flow script requires live database/API state and exercises insecure legacy behavior. Neither belongs in credential-free Section 0 CI.
- There is no root workspace, shared lockfile, worker, local database orchestration, generated contract package, or root verification command yet.

Never use `npm audit fix --force` or bulk formatting as an unattended remedy. Review upgrades and source rewrites as bounded changes.

## Product conflicts verified at the historical base

- Try Risk-Free copy contains seven-day and pay-per-credit variants alongside the approved five-day/fixed-$2 rule.
- Backend seeds and order defaults use USD while the approved launch is CAD-only.
- Frontend Big Sender fallback data begins at one card rather than two.
- Checkout still advertises a first-send two-credit bonus.
- Gift and referral screens simulate transactions or rewards that are inactive for MVP.
- Community commercial definitions remain in frontend code despite the inactive MVP boundary.
- One creation screen promises a 45-second song rather than the approved 30 seconds.
- The backend generation service always charges two credits and creates all assets, rather than charging one per requested paid asset and zero for message generation.

These conflicts are superseded by `docs/product/decision-register.md`. Their remediation belongs in the relevant implementation sections; they must not be copied into new code.

## Durable CI constraints

- Use Node.js 22.x in CI. Current Next.js and NestJS packages require Node.js 20 or newer.
- Generate Next.js types before standalone frontend type checking on a fresh clone.
- Run frontend type generation, type checking, and build sequentially because they share `.next` output.
- CI must not require AWS credentials, Cognito configuration, a database, or provider secrets.
- CI must not deploy or call paid providers.

## Section 1 workspace status

Status: implementation and local verification completed on `codex/section-1-workspace` on 2026-07-21. GitHub CI remains the independent Node.js 22 merge gate.

Implemented baseline:

- Canonical Node.js runtime: 22.
- One root npm workspace and one root lockfile.
- Canonical paths: `apps/web`, `apps/api`, `apps/worker`, `packages/contracts`, `packages/config`, `database`, `infra`, and `docs`.
- `packages/contracts` remains a placeholder until Section 2 generates the OpenAPI client.
- The worker remains idle except for process health until a later section adds asynchronous job behavior.
- Local PostgreSQL 16 binds to `127.0.0.1:55432`.
- Local auth-disabled mode is allowed only in the explicit local environment and must be rejected in every non-local environment.
- The API keeps `/api` during Section 1; the authenticated `/api/v1` contract begins in Section 2.
- Legacy draft migrations are not run automatically by startup, health, verification, smoke tests, or CI.
- Provider modes remain deterministic mock or disabled.
- Normal `dev:down` preserves the PostgreSQL Docker volume.
- Section 1 creates no AWS resources and sends no paid-provider traffic; external cost is CAD $0 and USD $0.

### Verification evidence

The clean install used the repository-pinned npm 10.9.8 and one root lockfile. The aggregate gate passed:

```powershell
npx.cmd --yes npm@10.9.8 ci --no-audit
npx.cmd --yes npm@10.9.8 run verify
```

Results:

- Prettier check passed for every governed file.
- ESLint passed with zero warnings for root scripts, API, web, and worker.
- TypeScript passed for API, web, worker, and contracts.
- Tests passed: 20 API, 8 worker, and 3 supervisor tests; 31 total.
- Builds passed for API, web, worker, and contracts.
- The Next.js build generated all 34 pages plus the `/api/health` route.
- The production dependency audit reported zero vulnerabilities at the high-severity gate.

The integrated `npm.cmd run smoke:stack` passed after starting the project-scoped PostgreSQL 16 container, web, API, and worker. It verified:

- Web health at `http://127.0.0.1:3000/api/health`.
- The native Next.js image optimizer against `/assets/LogoMark.png`.
- API database readiness at `http://127.0.0.1:4000/api/health/ready`.
- Worker database readiness at `http://127.0.0.1:4001/health/ready`.
- Owned process/container cleanup without deleting `souvenote-local-postgres-data`.

### Route and visual evidence

The Browser workflow loaded and captured the five approved comparison routes after relocation:

| Route                            | Full-page pixels before | Full-page pixels after |
| -------------------------------- | ----------------------: | ---------------------: |
| `/`                              |            `506 × 4697` |           `506 × 4697` |
| `/pricing`                       |            `622 × 3327` |           `622 × 3327` |
| `/create`                        |            `506 × 4346` |           `506 × 4346` |
| `/create/build-my-card`          |            `506 × 2694` |           `506 × 2694` |
| `/create/personalize-a-template` |           `506 × 11165` |          `506 × 11165` |

The application CSS and public assets were not changed. Customer-page TSX changes were produced exclusively by the repository's Prettier baseline; product copy and behavior were not intentionally edited. Pixel deltas are not used as an identity claim because existing animation and full-page capture behavior is nondeterministic: two unchanged `/create` captures differed by approximately 73% while retaining identical structure and dimensions.

### Security, cost, and remaining risk

- Local startup neutralizes inherited AWS and third-party credentials and permits only mock or disabled provider modes.
- Disabled authentication and the Section 1 idle worker are rejected outside the explicit development/test boundary.
- API startup validates ports, uses exact-origin CORS, hides Swagger in production, enables shutdown hooks, and applies bounded database readiness timeouts.
- No legacy migration, AWS mutation, paid-provider call, payment, email, or fulfillment action occurred. External cost was CAD $0 and USD $0.
- The transitional legacy API still exposes insecure caller-supplied identity and credit behavior. Section 2 must replace it with `/api/v1`, authentication and ownership by default, generated contracts, and a verified schema baseline before any shared environment exists.
- Demo frontend authorities remain isolated debt for Section 4 and are not promoted as production-safe behavior by this milestone.
