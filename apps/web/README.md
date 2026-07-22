# Souvenote web

This package is the Next.js 15/React 19 customer application. It preserves the
approved Souvenote design handoff and route journey while later sections replace
prototype authorities with secured backend contracts.

Use it through the root npm workspace. Do not install a second dependency graph or
create another lockfile in this directory.

## Section 1 boundary

- `/api/health` is the web process health route used by the local supervisor.
- The visual system remains custom CSS; Tailwind is not approved.
- Existing demo balances, libraries, payments, and future-feature actions remain
  documented debt for Sections 3-5 and are not evidence of production behavior.
- Section 2 introduces the generated `/api/v1` client and secure BFF session
  boundary. Section 4 replaces demo workflow authority with persisted drafts and
  deterministic provider jobs.

## Commands

Run from the repository root with Node.js 22 and npm 10.9.8:

```powershell
npm.cmd run dev:web
npm.cmd run lint --workspace=@souvenote/web
npm.cmd run typecheck --workspace=@souvenote/web
npm.cmd run build --workspace=@souvenote/web
```

The accepted whole-repository gate is `npm.cmd run verify`. Use
`npm.cmd run smoke:stack` to verify the web route, native Next.js image optimizer,
API, worker, and PostgreSQL together without credentials or paid traffic.
