# Souvenote

Souvenote is a Canada-first physical-card MVP. This repository is a TypeScript npm-workspace modular monolith with a Next.js web app, NestJS API, idle NestJS worker boundary, PostgreSQL, shared contracts, and non-deploying local tooling.

Before changing implementation code, read [AGENTS.md](./AGENTS.md), the [MVP specification](./docs/product/mvp-spec.md), the [decision register](./docs/product/decision-register.md), and the relevant [architecture](./docs/engineering/architecture.md) section.

## Workspace

```text
apps/
  web/          Next.js customer application
  api/          NestJS HTTP API
  worker/       Asynchronous worker process boundary
packages/
  contracts/    Shared API schemas and status contracts
  config/       Shared TypeScript configuration
database/       Database source and pre-Section-2 migration evidence
docs/           Product, engineering, and legacy documentation
infra/          Reserved for separately approved infrastructure work
```

## Local start

Prerequisites are Node.js 22, npm 10, and Docker Desktop with Linux containers. From the repository root:

```powershell
npm.cmd ci
npm.cmd run dev
```

This starts the web app on `3000`, API on `4000`, worker on `4001`, and a project-scoped PostgreSQL 16 container on host port `55432`. It neutralizes provider credentials, uses mock or disabled adapters, and does not deploy or contact paid providers.

See [local development](./docs/engineering/local-development.md) for health endpoints, smoke tests, shutdown behavior, and troubleshooting.

## Verification

```powershell
npm.cmd run verify
npm.cmd run smoke:stack
```

CI performs the same credential-free checks on Node.js 22. AWS mutations, paid-provider activation, and production deployment remain manual approval gates.
