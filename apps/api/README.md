# Souvenote API

This package is the NestJS HTTP process in the Souvenote modular monolith. Use it
through the root workspace commands; do not install dependencies or deploy from this
directory independently.

## Section 1 boundary

- The API retains the transitional `/api` prefix.
- `/api/health/live` proves process liveness.
- `/api/health/ready` proves current PostgreSQL connectivity only.
- Authentication may be disabled only in the explicit local/test environment.
- The legacy draft migrations are never run by startup or health checks.
- Existing product routes remain transitional and include documented identity,
  credit, and ownership debt. They are not approved for a shared environment.
- Section 2 owns `/api/v1`, Cognito/BFF security, ownership-by-default, the verified
  MVP schema, and generated OpenAPI contracts.

## Commands

Run from the repository root with Node.js 22 and npm 10.9.8:

```powershell
npm.cmd run dev:api
npm.cmd run lint --workspace=@souvenote/api
npm.cmd run typecheck --workspace=@souvenote/api
npm.cmd run test --workspace=@souvenote/api
npm.cmd run build --workspace=@souvenote/api
```

The accepted whole-repository gate is `npm.cmd run verify`. The complete local stack
is `npm.cmd run dev` or `npm.cmd run smoke:stack`.

No package command deploys, applies migrations, or contacts a paid provider.
