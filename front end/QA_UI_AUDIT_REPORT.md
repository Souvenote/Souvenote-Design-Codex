# Souvenote Frontend QA & UI Audit Report

Date: 2026-06-13  
Workspace audited: `C:\Users\wilso\Downloads\Souvenote Design System (8)\frontend\front end`  
Repo root: `C:\Users\wilso\Downloads\Souvenote Design System (8)\frontend`

This is the requested Phase 1 and Phase 2 stop-point report. I did not push to GitHub and did not start Phase 3 refactoring.

## Executive Status

- The app is a real Next.js App Router project, not a static HTML prototype.
- TypeScript strict mode is enabled: `strict: true`, `allowJs: false`, `isolatedModules: true`.
- Current source inventory: 65 `.tsx` files, 7 `.ts` files, and 27 `page.tsx` route files.
- No source `.html`, `.js`, or `.jsx` files were found outside generated/dependency folders.
- No source hits were found for React CDN runtime patterns: `ReactDOM`, browser Babel, `Object.assign(window, ...)`, or inline `<script>` app mounting.
- `.env.example` exists and documents that no env vars are required for the current mock-data frontend.
- No GitHub push was performed.

## Verification Commands

Run from `C:\Users\wilso\Downloads\Souvenote Design System (8)\frontend\front end`:

```powershell
npm.cmd install --cache .\.npm-cache
npx.cmd tsc --noEmit --pretty false
npm.cmd run build
```

Results:

- `npm install`: passed, 0 vulnerabilities.
- Strict TypeScript check: passed.
- Production build: passed.
- Next generated 33 app routes.
- Dev server was restarted afterward and returned HTTP 200 on `http://127.0.0.1:3000`.

## Phase 1: Visual & Code Audit

### Typography And Design System

- Outfit is the app-wide UI typeface.
- Lobster remains the wordmark font.
- No source references remain for Cormorant, Lora, or Georgia.
- Legacy semantic font tokens `--font-serif` and `--font-serif-alt` have been removed. Former usages now point to `--font-sans`, which is the Outfit app font.
- The app still loads Outfit and Lobster through a Google Fonts `@import` in `colors_and_type.css`. This is fine for local frontend work, but self-hosting fonts would be cleaner before launch if the goal is fewer external render dependencies.

### Layout And Semantics

- Checked rendered pages use a `main` landmark.
- Primary navigation uses a shared Next/React navbar component and renders route links through `next/link`.
- The app uses shared global CSS files for the inherited Claude design system. This preserves the look well, but the CSS surface is large and should be pruned carefully only after routes and flows are stable.

### Largest Maintainability Hotspots

The following components are large enough that future API wiring will be easier if they are split into smaller units:

- `Personalize.tsx` ~59.7 KB
- `Options.tsx` ~43.5 KB
- `BmcSteps.tsx` ~36.3 KB
- `Auth.tsx` ~33.3 KB
- `AttestationGate.tsx` ~27.3 KB
- `BmcReview.tsx` ~22 KB
- `CartPage.tsx` ~20.7 KB

This is not blocking the build, but it is the main structural risk.

### Assets

Compressed public assets:

- `bmc-souve-rosegold-back.jpg`: ~1847 KB to ~573 KB.
- `pt-comic-cover.jpg` and `comic-card-cover.jpg`: ~808 KB each to ~766 KB each.
- `pt-comic-back.jpg` and `comic-card-page.jpg`: ~783 KB each to ~743 KB each.
- `LogoMark.png`: ~654 KB to ~436 KB.
- `souve-logo-mark.png`: ~638 KB to ~439 KB.
- `bmc-fathers-day-cover.jpg`: ~562 KB to ~534 KB.
- `bmc-fathers-day-card.jpg`: ~522 KB to ~499 KB.

Recommendation: the duplicate comic cover/back files are still intentionally kept under both filenames for compatibility. If future cleanup is desired, consolidate references after a visual QA pass.

### Dead Or Prototype-Only Code

No static handoff runtime was found. The main remaining prototype/development surface is debug helpers attached to `window`, including:

- `window.__souvSetDemoBalance`, `window.__souvZeroDemoBalance`, `window.__souvClearDemoBalance`
- `window.__bmcGoStep`, `window.__bmcSetCredits`, `window.__bmcShowInvite`
- `window.__dlvSetCards`, `window.__dlvOpenCheckout`
- `window.__mcsSetMode`

These are useful for local QA, but should either be removed or gated behind development-only checks before production launch.

## Phase 2: Functional, State & Route Audit

### Verified Route Map

All of these returned HTTP 200:

- `/`
- `/home`
- `/signup`
- `/login`
- `/welcome`
- `/forgot`
- `/reset`
- `/verify`
- `/verify/expired`
- `/recover`
- `/create`
- `/create/build-my-card`
- `/create/personalize-a-template`
- `/create/my-cards-and-songs`
- `/my-cards`
- `/pricing`
- `/cart`
- `/delivery`
- `/account/profile`
- `/account/settings`
- `/account/top-up`
- `/gift`
- `/gift/redeem`
- `/refer`
- `/faq`
- `/contact`
- `/legal/privacy-policy`
- `/legal/terms-of-service`
- `/legal/refund-policy`
- `/legal/cookie-policy`

Community Cards exception:

- `/community-cards` returns 404, intentionally.
- The create page Community Cards option is disabled and displays Coming soon.
- Footer Community Cards is static disabled text.
- No checked live UI path routes the user to a Community Cards 404.

### Navigation And Top-Level Links

- Navbar links: Personalize a Template, Build My Card, Saved Cards & Songs, Pricing.
- Navbar card/credit balance links to `/create/my-cards-and-songs`.
- Logged-out landing shows Souvenote branding, `Log In`, and `Start for Free`.
- Sign out link in the account menu points to `/`.
- Footer social links still use `#todo-social`; About still uses `#todo-about`. These are safe placeholders, but should become real links or non-links later.

### State Matrix Breakdown

Generation path means Personalize a Template or Build My Card.

| Credits | Cards | Observed behavior |
| --- | --- | --- |
| 0 | 0 | Create option is locked. Clicking Personalize routes to `/pricing`. |
| 0 | 1 | Create option is locked. Clicking Personalize opens the credits-only `Top up credits` modal and stays on `/create`. |
| 1 | 0 | Current generation rules require 2 credits, so this should be treated as insufficient credits. Code path routes to pricing/full top-up when no cards are banked. |
| 1 | 1 | Current generation rules still treat this as insufficient for generation and should open credits-only top-up. |
| 2+ | 0 | Generation route opens successfully. User can create with credits, then must buy/send a card afterward if card bank is empty. |
| 2+ | 1+ | Generation route opens successfully. User can generate and has enough card bank for at least one send. |

Important product note: the code currently defines generation as requiring 2 total credits. This matches the "1 image + 1 song" signup-credit idea, but backend integration needs to preserve the same accounting explicitly.

### Create Page

Verified:

- `0 credits / 0 cards`: Personalize routes to `/pricing`.
- `0 credits / 1 card`: Personalize opens the credits-only modal.
- `2 credits / 0 cards`: Personalize opens `/create/personalize-a-template`.
- Community Cards is disabled and non-routing.
- No console errors were captured during these checks.

### Build My Card

Verified:

- `/create/build-my-card#photo` renders without runtime overlay.
- The Describe My Card action reveals the inline textarea.
- Clicking Continue with Describe My Card selected but empty opens a small validation dialog: `Describe your idea first`.
- No React console errors were captured in that flow.

Code-reviewed:

- Build My Card upload uses `URL.createObjectURL`.
- Uploaded object URLs are revoked during removal and cleanup.
- Browser automation did not drive the operating-system file picker, so final human upload QA is still recommended.

### Personalize A Template

Verified earlier in this pass:

- With enough credits, Personalize opens the template flow.
- With no credits/no cards, it routes to pricing.
- With no credits/one card, the credits-only modal opens.

Code-reviewed:

- Caption Generator limits generated captions to 8 words.
- Message Generator updates text inline rather than opening a modal.
- Upload preview uses object URLs and cleanup.

### Saved Cards & Songs

Verified:

- `/create/my-cards-and-songs` renders with 0/0 and 0/1 demo balances.
- Page shows mock saved cards and songs.
- The in-page Build My Card and Personalize a Template CTA buttons are not present.
- No runtime overlay or console errors were captured.

Current limitation:

- Saved cards/songs are mock local frontend data. Generated cards are not yet reliably persisted from every generation path into Saved Cards & Songs because backend/API integration is still missing.

### Pricing And Cart

Verified:

- Pricing page renders the visible tiers:
  - 2-10 cards at $8.99/card
  - 11-20 cards at $7.99/card
  - 21-30+ cards at $6.99/card
- `Choose Try Risk-Free` adds a locked cart item.
- Try Risk-Free cart line cannot be incremented; it only exposes Remove.
- Cart footer says `Shipping is always included.`
- `Add more cards` links back to `/pricing`.
- Proceed to checkout opens the blank Souvenote gift add-on modal.
- Gift modal title: `Add a blank Souvenote to your order for $6.99?`
- Gift modal has `No thanks` and `Add gift` actions.

### Delivery

Verified:

- `/delivery?demoCredits=0&demoCards=0` renders cleanly.
- Delivery shows a `Top up cards` action when card bank is empty.
- Clicking `Top up cards` routes to `/pricing`.
- No console errors were captured.

### Auth And Welcome

Verified:

- `/signup` renders the updated side-by-side social/email structure.
- Signup headline says `2 credits are in your account!`.
- Signup sections include `Sign up with social` and `Sign up with email`.
- `/login` renders side-by-side social/email sections.
- `/welcome` renders the welcome modal content and create options.
- No console errors were captured on these routes.

## Strategic Recommendations For Phase 3

1. Remove or dev-gate `window.__...` test helpers before launch.
2. Split `Personalize.tsx`, `Options.tsx`, `BmcSteps.tsx`, and `Auth.tsx` into smaller client components.
3. Create typed mock service modules for balance, cart, library, and gift state so localStorage is isolated behind one API-like interface.
4. Add npm scripts for `type-check` and `lint` so the expected validation flow is explicit.
5. Add a small automated route smoke test for all 200 routes plus the intentional `/community-cards` 404.
6. Add interaction tests for the credit/card state matrix.
7. Compress and deduplicate public assets after visual comparison.
8. Decide whether to self-host Outfit/Lobster instead of using Google Fonts `@import`.
9. Replace `#todo-social` and `#todo-about` placeholders with final footer behavior.
10. Keep Community Cards as a disabled component state until the real feature is designed.

## Blockers And Human Decisions

- Confirm whether debug helpers on `window` should remain during API integration or be removed now.
- Confirm whether `1 credit / 1 card` should remain blocked for generation because the current generation rule requires 2 credits.
- Confirm whether `/account/top-up` should remain as a pricing alias or be removed from the user-facing route map.
- Confirm whether Google Fonts external loading is acceptable for launch, or if fonts should be self-hosted.
- Final visual QA against the latest Claude reference still needs human review after Phase 3 fixes, especially for card art and image-upload previews.

## Sign-Off State

Current status: Phase 1 and Phase 2 audit complete.

Pre-refactor checks:

- Install: passed.
- Strict TypeScript: passed.
- Production build: passed.
- Dev route status sweep: passed for all expected routes.
- `/community-cards`: intentionally 404.

Phase 3 Debug & Refactor: not started yet.  
Phase 4 Sweep 1 Build: pending after Phase 3.  
Phase 4 Sweep 2 UX: pending after Phase 3.

This is the correct stop point before refactoring.
