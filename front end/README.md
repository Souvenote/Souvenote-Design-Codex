# Souvenote Next.js Frontend

Production-ready Next.js App Router conversion of the Claude Designs handoff in `handoff/html`. The app uses imported React components, local assets in `public/assets`, and the original handoff CSS as global styles.

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

## Remaining TODOs

- Wire auth forms to the real authentication provider and validation rules.
- Replace demo user, credits, cart, card-bank, and currency data with app state/API data.
- Connect create-option tiles, card packs, credit packs, referral invites, and checkout CTAs to product flows.
- Build future pages currently represented by `#todo-*` placeholders: profile, my cards, gift, referral, account settings, FAQ, contact, privacy, terms, cookie policy, refund policy, and individual card creation flows.
