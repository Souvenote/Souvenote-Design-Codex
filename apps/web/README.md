# Souvenote Next.js Frontend

Production-ready Next.js App Router conversion of the Souvenote design handoff. The app uses imported React components, local assets in `public/assets`, and the original handoff CSS as global styles.

## Setup

```powershell
npm install
npm run dev
npm run build
```

The included `.npmrc` keeps npm's cache local to this project at `.npm-cache/`, which avoids Windows user-cache permission issues. On this Windows machine, `npm.cmd` is also safe to use if PowerShell blocks the npm shim:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## Converted Routes

- `/` from `landing-logged-out.html`
- `/home` from `landing-logged-in.html`
- `/signup` from `auth-signup.html`
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

## Remaining TODOs

- Wire auth forms to the real authentication provider and validation rules.
- Replace demo user, credits, cart, card-bank, and currency data with app state/API data.
- Connect card packs, credit packs, referral invites, checkout, delivery, and saved-card data to product APIs.
- Version 2: build Community Cards. The current create tile and footer mention are intentionally static and do not route to a missing page.
- Build future pages such as About and standalone community card detail pages once final UI source is provided.
