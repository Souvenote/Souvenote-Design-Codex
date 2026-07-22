# Local development

Status: verified Section 1 local lifecycle contract.

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

Do not add AWS or provider credentials for local startup. Provider modes remain deterministic mock or disabled. Authentication is disabled only in the explicit local environment; the API rejects that setting outside local development.

## One-command stack lifecycle

Start PostgreSQL, web, API, and worker from the repository root:

```powershell
npm.cmd run dev
```

`dev` performs preflight checks, starts the owned local processes, and polls their health. It does not apply the legacy SQL migrations. The worker is intentionally idle except for health behavior until later sections add real jobs.

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

`smoke:stack` owns start, verification, and shutdown for its run. It must stop what it starts and must never delete the PostgreSQL volume.

## Local endpoints

| Service       | Liveness                                | Readiness or customer endpoint           |
| ------------- | --------------------------------------- | ---------------------------------------- |
| Web           | `http://127.0.0.1:3000/api/health`      | `http://127.0.0.1:3000`                  |
| API           | `http://127.0.0.1:4000/api/health/live` | `http://127.0.0.1:4000/api/health/ready` |
| Worker        | `http://127.0.0.1:4001/health/live`     | `http://127.0.0.1:4001/health/ready`     |
| PostgreSQL 16 | Checked by the root health command      | `127.0.0.1:55432`                        |

The API keeps `http://127.0.0.1:4000/api/health` as a Section 1 compatibility health route. The worker may expose `http://127.0.0.1:4001/health` for the same purpose. New product APIs must wait for the Section 2 `/api/v1` contract rather than extending the transitional prefix casually.

Liveness answers whether a process is running. Readiness answers whether it can serve its current local responsibility; API readiness includes the database connectivity check. Readiness does not prove migrations or an MVP schema were applied.

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
```

These checks must not deploy, mutate AWS, call paid providers, require production credentials, or rewrite source. The verified Section 1 evidence is recorded in `current-baseline.md`; every later section must produce fresh evidence for its own branch.

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

### PostgreSQL is running but the API is not ready

Run `npm.cmd run health` and use the reported failing check. A database connection failure can mean Docker is still starting, port `55432` is occupied, or the local configuration is inconsistent. Do not apply legacy migrations as a readiness fix; Section 1 readiness requires connectivity only.

### A process from an interrupted run remains

Run `npm.cmd run dev:down`, confirm the conflicting application is understood, and retry `npm.cmd run dev`. Normal shutdown preserves database data.

### Web is ready but API pricing or product calls fail

Use the API liveness and readiness URLs above. Section 1 proves workspace health, not a production-safe API. The existing product endpoints still contain documented legacy behavior and remain subject to Sections 2 through 5.

### Worker is healthy but no jobs run

That is expected in Section 1. The worker is a process boundary and health surface only; generation, payment resolution, and fulfillment handlers are later deliverables.

### Authentication appears unavailable

That is expected only in the explicit local environment. Do not weaken non-local startup or introduce a fake authenticated user. Secure Cognito/BFF authentication and ownership enforcement are Section 2 work.

## Safety summary

- No legacy migration auto-run.
- No provider credentials or paid traffic.
- No AWS mutation.
- No permissive non-local auth fallback.
- No automatic port killing.
- No database reset or volume deletion in the normal lifecycle.
- No later milestone completion claim may reuse Section 1 evidence; each branch must rerun its applicable verification and approval gates.
