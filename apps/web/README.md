# Souvenote web

This package is the Next.js 15/React 19 customer application. It preserves the
approved Souvenote design handoff and route journey while using the secured BFF and
generated API contract.

Use it through the root npm workspace. Do not install a second dependency graph or
create another lockfile in this directory.

## Section 2 boundary

- `/api/health` is the web process health route used by the local supervisor.
- The visual system remains custom CSS; Tailwind is not approved.
- Cognito authorization-code/PKCE and deterministic loopback auth terminate in the
  Next.js BFF. Access and refresh tokens remain inside encrypted HttpOnly cookies.
- Browser product calls use `@souvenote/contracts` through `/api/bff/api/v1/*`.
- Cookie-backed mutations require exact same-origin metadata and the BFF CSRF token.
- Gift, referral, contact-form, payment, checkout, and fulfillment surfaces are
  honest non-transactional placeholders. Section 4 still owns complete persisted
  workflow replacement and responsive visual evidence.

## Commands

Run from the repository root with Node.js 22 and npm 10.9.8:

```powershell
npm.cmd run dev:web
npm.cmd run lint --workspace=@souvenote/web
npm.cmd run typecheck --workspace=@souvenote/web
npm.cmd run test --workspace=@souvenote/web
npm.cmd run build --workspace=@souvenote/web
```

The accepted whole-repository gate is `npm.cmd run verify`. Use
`npm.cmd run smoke:stack` to verify the web route, native Next.js image optimizer,
API, worker, and PostgreSQL together without credentials or paid traffic.
