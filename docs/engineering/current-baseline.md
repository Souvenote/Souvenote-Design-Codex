# Current engineering baseline

Recorded: 2026-07-21
Base commit: `84654d79c023fe4a6c65733ac470a3c38637aa1e`

This document records verified facts about the pre-reconciliation repository. It is evidence for planning, not permission to preserve unsafe behavior.

## Passing local checks

Frontend, from `front end/`:

```powershell
npm.cmd ci
npm.cmd exec -- next typegen
npm.cmd exec -- tsc --noEmit --incremental false
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=critical
```

Backend, from `backend/server/`:

```powershell
npm.cmd ci
npm.cmd exec -- tsc --noEmit --incremental false
npm.cmd test -- --runInBand --no-cache
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=critical
```

The verified backend suite contains one unit suite with five tests. It mocks database behavior and is not full integration coverage.

## Known quality and security debt

- Backend non-fixing ESLint reports 169 findings (168 errors and one warning). The current `npm run lint` command contains `--fix` and must not run in CI.
- Frontend has no lint or test command.
- A high-severity production-dependency audit currently fails both packages. Frontend advisories flow through Next/sharp/libvips; backend advisories flow through body-parser, js-yaml, and multer.
- The audit gate is temporarily critical-only. Section 1 must review dependency upgrades, remove high-severity findings, add non-mutating lint commands, and raise CI to a high-severity gate.
- Backend end-to-end tests are stale and require database configuration. The mock-flow script requires live database/API state and exercises insecure legacy behavior. Neither belongs in credential-free Section 0 CI.
- There is no root workspace, shared lockfile, worker, local database orchestration, generated contract package, or root verification command yet.

Never use `npm audit fix --force` or bulk formatting as an unattended remedy. Review upgrades and source rewrites as bounded changes.

## Verified product conflicts in current code

- Try Risk-Free copy contains seven-day and pay-per-credit variants alongside the approved five-day/fixed-$2 rule.
- Backend seeds and order defaults use USD while the approved launch is CAD-only.
- Frontend Big Sender fallback data begins at one card rather than two.
- Checkout still advertises a first-send two-credit bonus.
- Gift and referral screens simulate transactions or rewards that are inactive for MVP.
- Community commercial definitions remain in frontend code despite the inactive MVP boundary.
- One creation screen promises a 45-second song rather than the approved 30 seconds.
- The backend generation service always charges two credits and creates all assets, rather than charging one per requested paid asset and zero for message generation.

These conflicts are superseded by `docs/product/decision-register.md`. Their remediation belongs in the relevant implementation sections; they must not be copied into new code.

## CI constraints

- Use Node.js 22.x in CI. Current Next.js and NestJS packages require Node.js 20 or newer.
- Generate Next.js types before standalone frontend type checking on a fresh clone.
- Run frontend type generation, type checking, and build sequentially because they share `.next` output.
- CI must not require AWS credentials, Cognito configuration, a database, or provider secrets.
- CI must not deploy or call paid providers.
