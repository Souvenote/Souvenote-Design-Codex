# Souvenote Next.js Frontend

Production-ready Next.js App Router conversion of the Souvenote design handoff. The app uses imported React components, local assets in `public/assets`, and the original handoff CSS as global styles.

## Setup

```powershell
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run test:routes
npm run verify
```

The included `.npmrc` keeps npm's cache local to this project at `.npm-cache/`, which avoids Windows user-cache permission issues. On this Windows machine, `npm.cmd` is also safe to use if PowerShell blocks the npm shim:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:routes
npm.cmd run verify
```

`test` runs the focused Vitest regression suite for authenticated API contracts
and durable checkout state. `typecheck` runs strict TypeScript without emitting
files. `test:routes` starts the built production server on a temporary local
port, verifies every supported route returns `200`, verifies Community Cards
remains an intentional `404`, and then stops that server. `verify` runs the unit
tests, typecheck, production build, and route sweep together. Browser-only QA
controls are registered only in development builds and are removed when their
component unmounts.

Backend error responses include a validated `X-Request-ID`. The API client adds
that value to the visible error as a support code, allowing a customer-reported
failure to be matched to the backend's PII-safe structured log without exposing
request bodies, card content, addresses, authentication headers, or query data.

## Converted Routes

- `/` from `landing-logged-out.html`
- `/home` from `landing-logged-in.html`
- `/signup` from `auth-signup.html`
- `/first-login` for the dedicated first sign-in after email account creation
- `/login` from `auth-login.html`
- `/welcome` from `auth-welcome.html`
- `/forgot` from `auth-forgot.html`
- `/reset` from `auth-reset.html`
- `/verify` from `auth-verify.html`
- `/verify/expired` from `auth-verify-expired.html`
- `/recover` from `auth-recover.html`
- `/create` from `create-options.html`
- `/pricing` from `pricing.html`
- `/create/build-my-card` from `build-my-card.html`
- `/create/personalize-a-template` from `personalize-template.html`
- `/create/my-cards-and-songs` and `/my-cards` from `my-cards.html`
- `/cart` from `cart.html`
- `/delivery` from `delivery.html`
- `/listen/[token]` is the private, non-indexed artwork and song experience
  opened by a printed Souvenote QR code
- `/account/profile` from `profile.html`
- `/account/settings` from `account-settings.html`
- `/account/top-up` points to the pricing/top-up surface
- `/gift` from `gift-a-souvenote.html`
- `/gift/redeem` from `gift-redeem.html`
- `/refer` from `refer-a-friend.html`
- `/faq` from `faq.html`
- `/contact` from `contact-us.html`
- `/legal/privacy-policy` from `privacy-policy.html`
- `/legal/terms-of-service` from `terms-of-service.html`
- `/legal/refund-policy` from `refund-policy.html`
- `/legal/cookie-policy` from `cookie-policy.html`

## Saved Cards & Songs

Authenticated library routes load owner-scoped drafts and assets from the API.
A card appears as finished only when its selected generation contains an
approved, moderation-cleared image; its matching approved song and message stay
scoped to that same generation. Real private media is rendered through
short-lived signed reads. Mock-only asset records keep the designed fallback
artwork and do not expose unusable `mock://` links as playback or downloads.

Delivery confirmation URLs carry only the opaque order ID. After authentication,
the confirmation page reloads the owner-scoped order and its latest durable
fulfillment attempt from the API, so a refresh does not depend on browser-local
checkout state. The backend remains responsible for ownership enforcement and
provider reconciliation.

The account profile derives approved card/song totals and recent order activity
from owner-scoped APIs. The card-bank display remains zero until the product
model and corresponding server-authoritative API are approved; it is not
inferred from local cart purchases.

Account settings expose only backed actions. Cognito owns password recovery and
the current browser can sign out; unconfigured MFA, global session revocation,
notification schedules, tax-display preferences, and destructive account
mutations are presented as unavailable instead of as working controls.

## Remaining TODOs

- Add browser-level coverage for the configured Cognito email and hosted-UI flows.
- Replace the remaining demo cart, card-bank, and currency state with product API data.
- Connect card packs, credit packs, and referral invites to product APIs.
- Version 2: build Community Cards. The current create tile and footer mention are intentionally static and do not route to a missing page.
- Build future pages such as About and standalone community card detail pages once final UI source is provided.

Footer destinations without approved URLs (About, Community Cards, and social
profiles) render as non-interactive coming-soon items instead of fake fragment
links or routes that resolve to `404`.
