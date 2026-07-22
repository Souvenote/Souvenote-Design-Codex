# Souvenote API

This package is the NestJS HTTP process in the Souvenote modular monolith. Use it
through the root workspace commands; do not install dependencies or deploy from this
directory independently.

## Section 3 boundary

- All product and health routes use `/api/v1`.
- Authentication and repository ownership are default deny. Only explicitly public
  health, CAD pricing/share, and verified webhook routes bypass customer auth.
- Nest validates Cognito access-token signature, issuer, client, token use, time,
  and required scopes. Deterministic local auth is signed, development/test only,
  and loopback only.
- Controllers contain HTTP concerns, services contain domain behavior, and only
  repositories execute SQL.
- Startup and health never apply migrations. Use the root explicit runner and
  SHA-256 journal.
- OpenAPI is generated from the controllers and checked against
  `packages/contracts` by `npm.cmd run contracts:check`.
- The public catalog exposes only the approved Canada/CAD offers. Catalog
  visibility is distinct from checkout activation; all real checkout flags remain
  false.
- Generation action costs are server-owned: initial image/song costs two,
  image/song regeneration costs one, and inside-message generation costs zero.
- Big Sender reservations accept 2-30 cards and calculate totals from the active
  server catalog. They do not create a payment or grant an entitlement.
- Try Risk-Free authorization is available only in deterministic local/test mock
  payment mode. It is one-per-account and never creates a Stripe object.

## Commands

Run from the repository root with Node.js 22 and npm 10.9.8:

```powershell
npm.cmd run dev:api
npm.cmd run lint --workspace=@souvenote/api
npm.cmd run typecheck --workspace=@souvenote/api
npm.cmd run test --workspace=@souvenote/api
npm.cmd run test:database
npm.cmd run build --workspace=@souvenote/api
```

The accepted whole-repository gate is `npm.cmd run verify`. The complete local stack
is `npm.cmd run dev` or `npm.cmd run smoke:stack`.

No package command deploys or contacts a paid provider. Database application is a
separate explicit root command; ordinary API startup never invokes it.
