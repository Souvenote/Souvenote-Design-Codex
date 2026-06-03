# Souvenote — Frontend

Production frontend for Souvenote, built with **Next.js 15 (App Router)**, **React 19**,
**TypeScript (strict)**, and **Tailwind CSS** layered over the hand-authored Souvenote
design system.

## Getting started

```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:3000**.

> Requires Node.js 18.18+ (Node 20 LTS recommended).

## Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the dev server (Turbopack off) |
| `npm run build` | Production build                     |
| `npm run start` | Serve the production build           |
| `npm run lint`  | Run ESLint                           |

## Routes (App Router)

| Path           | Page                                            |
| -------------- | ----------------------------------------------- |
| `/`            | Marketing landing (Hero · How it works · Gallery · FAQ · Footer) |
| `/options`     | "Choose how to create your card" + AI credit packs + pricing-intercept modal |
| `/pricing`     | Card packs + AI credit packs                    |
| `/login`       | Sign in (email + social)                        |
| `/signup`      | Create account → welcome popup                  |
| `/personalize` | Template gallery + occasion filter + personalization wizard |
| `/review`      | Generated card review + format/checkout modal   |
| `/cards`       | Community cards *(styled placeholder)*          |
| `/create`      | Build My Card *(styled placeholder)*            |
| `/library`     | My Cards & Songs *(styled placeholder)*         |

## Project structure

```
frontend/
├─ public/assets/            Brand logos & card imagery
├─ src/
│  ├─ app/                   App Router — one folder per route
│  │  ├─ globals.css         Tailwind layers + design tokens + base/keyframes
│  │  ├─ layout.tsx          Root layout (fonts, page background)
│  │  └─ <route>/page.tsx
│  ├─ components/            React components
│  │  ├─ auth/  hero/  landing/  layout/  options/  personalize/  review/  ui/
│  │  └─ Navbar, CardCarousel, GallerySection, FAQAccordion, …
│  ├─ data/                  mock-cards.ts (swap for the backend API)
│  ├─ lib/                   utils (cn, formatters)
│  ├─ styles/                landing.css, app.css (component styles)
│  └─ types/                 shared TypeScript types
└─ tailwind.config.ts        Design tokens → Tailwind theme
```

## Styling

Two complementary layers, as requested:

- **`globals.css` + `styles/*.css`** — the Souvenote design tokens (CSS variables) and the
  `souv-*` component classes ported from the original prototypes.
- **Tailwind utilities** — wired to the same tokens in `tailwind.config.ts`
  (`text-gold`, `bg-warm`, `font-display`, …) for ad-hoc layout.

Fonts (Outfit + Lobster) load from Google Fonts in `app/layout.tsx`.

## Data

Everything runs on mock data in `src/data/mock-cards.ts`. When the backend
(`../backend/`) is ready, replace those exports with real API calls.
