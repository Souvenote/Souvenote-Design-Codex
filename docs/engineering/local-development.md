# Local development

Status: verified Section 2 local lifecycle and security contract.

This guide covers the credential-free local workspace only. It does not authorize AWS deployment, paid-provider traffic, live payments, email, or physical fulfillment.

## Prerequisites

- Windows PowerShell.
- Node.js 22 and npm 10.9.8.
- Docker Desktop running with Linux containers available.
- The canonical clone at `C:\Users\wilso\Desktop\Souvenote_Design_Codex`.
- Required loopback ports available: `3000`, `4000`, `4001`, and `55432`.

Confirm the canonical toolchain from the repository root:

```powershell
node --version
npm.cmd --version
```

The versions must report `v22.x` and `10.9.8`. Switch toolchains before
continuing if they do not; the root verification and supervisor fail closed on a
different major/version.

Install the exact workspace dependency graph from the repository root:

```powershell
npm.cmd ci
```

Do not add AWS or provider credentials for local startup. Provider modes remain deterministic mock or disabled. Local authentication uses a short-lived, signed loopback-only access token through the same BFF cookie and API ownership boundary as Cognito. Both web and API reject local mode outside development/test, and the API refuses to bind local auth to a non-loopback host.

## One-command stack lifecycle

On the first start, or after an approved migration is added, explicitly apply the verified journal and start PostgreSQL, web, API, and worker:

```powershell
npm.cmd run dev:setup
```

For later starts when the journal is current:

```powershell
npm.cmd run dev
```

`dev` performs preflight checks, starts PostgreSQL, verifies that no migration is pending, starts the owned local processes, and polls their health. It never applies a migration automatically. `dev:setup` is the explicit migration action. The worker is intentionally idle except for health behavior until later sections add real jobs.

Check an already-running stack:

```powershell
npm.cmd run health
```

Stop the processes and Docker Compose services owned by the workspace:

```powershell
npm.cmd run dev:down
```

Normal shutdown preserves the named PostgreSQL volume. There is intentionally no documented database-reset or volume-deletion command. Never improvise one: a destructive reset needs an exact target, a backup/data-loss assessment, and explicit user direction.

For a self-contained lifecycle check, use:

```powershell
npm.cmd run smoke:stack
```

`smoke:stack` owns start, explicitly applies the verified baseline, verifies the full local boundary, and shuts down what it starts. It never deletes the PostgreSQL volume.

## Local endpoints

| Service       | Liveness                                   | Readiness or customer endpoint              |
| ------------- | ------------------------------------------ | ------------------------------------------- |
| Web           | `http://127.0.0.1:3000/api/health`         | `http://127.0.0.1:3000`                     |
| API           | `http://127.0.0.1:4000/api/v1/health/live` | `http://127.0.0.1:4000/api/v1/health/ready` |
| Worker        | `http://127.0.0.1:4001/health/live`        | `http://127.0.0.1:4001/health/ready`        |
| PostgreSQL 16 | Checked by the root health command         | `127.0.0.1:55432`                           |

The API product contract and health routes use `/api/v1`. The worker may retain `http://127.0.0.1:4001/health` as a compatibility health route. Browser product calls use the generated client through `/api/bff/api/v1/*`; browser code never receives Cognito access or refresh tokens.

Liveness answers whether a process is running. Readiness answers whether it can serve its current local responsibility; API readiness includes a bounded database connectivity check. Migration status is checked separately before ordinary startup and is never inferred from health.

## Quality checks

Run the aggregate credential-free gate from the root:

```powershell
npm.cmd run verify
```

For focused diagnosis, the accepted root checks are:

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run audit:prod
npm.cmd run contracts:check
npm.cmd run test:database
```

`contracts:check` regenerates the Nest OpenAPI document and TypeScript client in memory and fails on drift. `test:database` uses an isolated, volume-free PostgreSQL 16 container to prove clean apply, repeat/no-op behavior, checksum tamper rejection, schema constraints, ownership, idempotency, and the API integration boundary.

These checks must not deploy, mutate AWS, call paid providers, require production credentials, or rewrite source. Current milestone evidence is recorded in `current-baseline.md`; every later section must produce fresh evidence for its own branch.

The build-plan and repository-policy tests run inside `npm.cmd run verify`. They
protect the Sections 0-8 plan, canonical entry-point links, single lockfile,
untracked-secret boundary, and governed-text hygiene.

## Port ownership and collisions

The lifecycle owns only processes that it starts. If `3000`, `4000`, `4001`, or `55432` is already occupied, preflight stops with a diagnostic instead of terminating or reusing an unrelated process.

When a collision occurs:

1. If an earlier Souvenote run owns the port, use `npm.cmd run dev:down` and start again.
2. If another application owns it, stop that application manually or keep Souvenote stopped.
3. Do not kill a process solely by port number unless its identity and ownership have been verified.
4. Do not change the canonical ports in an unreviewed local-only workaround; scripts, health checks, and CI smoke behavior must stay aligned.

## Troubleshooting

### Docker Desktop is not available

Start Docker Desktop, wait until its engine reports ready, then run `npm.cmd run dev` again. Local development must fail closed rather than silently substitute an external database.

### Migrations are pending

Read the pending migration and checksum diff. If it belongs to the current reviewed branch, run `npm.cmd run dev:setup`. Never edit an applied baseline or bypass the journal.

### PostgreSQL is running but the API is not ready

Run `npm.cmd run health` and use the reported failing check. A database connection failure can mean Docker is still starting, port `55432` is occupied, or the local configuration is inconsistent. Do not bypass the verified runner or apply SQL manually as a readiness fix.

### A process from an interrupted run remains

Run `npm.cmd run dev:down`, confirm the conflicting application is understood, and retry `npm.cmd run dev`. Normal shutdown preserves database data.

### Web is ready but API pricing or product calls fail

Use the API liveness and readiness URLs above. Product routes authenticate by default. Open `/api/auth/login?returnTo=/create` on loopback to establish the deterministic local BFF session, then retry through the web application. Pricing remains intentionally public.

### Worker is healthy but no jobs run

The worker is still an idle process boundary. Generation, payment resolution, and fulfillment job handling are later deliverables.

### Authentication appears unavailable

Confirm the stack was started through the root supervisor so its exact local secrets and loopback configuration align between web and API. Never introduce a shared fallback user, expose the loopback server, or copy local secrets into another environment. Real Cognito activation requires an independently configured user pool/client and is not exercised by local tests.

## Safety summary

- No migration auto-run during ordinary startup or health.
- SHA-256 journal verification before any explicit migration.
- No provider credentials or paid traffic.
- No AWS mutation.
- No permissive non-local or non-loopback auth fallback.
- No browser-managed access or refresh tokens.
- No automatic port killing.
- No database reset or volume deletion in the normal lifecycle.
- No later milestone completion claim may reuse Section 1 evidence; each branch must rerun its applicable verification and approval gates.
