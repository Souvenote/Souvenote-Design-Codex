# Souvenote Database

This folder contains the PostgreSQL migrations and seed data used by the
Souvenote backend.

## Structure

- `migrations/001_initial_schema.sql` creates the core schema.
- `migrations/002_phase1_mock_backend.sql` adds the local MVP flow tables.
- `migrations/003_account_profile_payments.sql` adds account and payment fields.
- `migrations/004_s3_upload_pipeline.sql` adds provider-aware upload tracking.
- `migrations/005_generation_job_lifecycle.sql` adds durable generation state.
- `migrations/006_asset_moderation_lifecycle.sql` adds moderation jobs and decisions.
- `migrations/007_server_authoritative_order_pricing.sql` adds catalog-derived order pricing snapshots.
- `migrations/008_stripe_checkout_lifecycle.sql` adds Stripe attempts, authorization state, and webhook dedupe.
- `migrations/009_scribeless_fulfillment_lifecycle.sql` adds multi-recipient orders, durable fulfillment attempts, and provider polling state.
- `migrations/010_public_card_links.sql` adds hashed public keepsake links for stable printed song QR codes.
- `migrations/011_transactional_notifications.sql` adds the idempotent order-email outbox and signed delivery-event dedupe state.
- `migrations/012_canadian_pricing_and_credit_packs.sql` aligns Canada-first
  CAD pricing, adds durable standalone credit-pack purchases, and records the
  deadline/lease fields used to finalize expired five-day authorizations.
- `migrations/013_card_entitlement_ledger.sql` adds the append-only physical-card
  balance used by paid checkout and fulfillment.
- `migrations/014_card_pack_purchases.sql` adds durable standalone Big Sender
  purchases and links their payment attempts to atomic card-and-credit grants.
- `migrations/015_prepaid_card_delivery.sql` makes each card-bank entitlement a
  fully paid printed-and-delivered card and adds retry-safe reservation state.
- `migrations/016_gifts_and_referrals.sql` adds delivery-included one-card gift
  escrow/redemption and first-send-qualified referral attribution.
- `seeds/001_pricing_catalog.sql` inserts the Canada-first card and credit-pack catalog.

## Local setup

Create the local database, apply every migration in order, and then seed it:

```powershell
createdb -U postgres souvenote_dev
psql -U postgres -d souvenote_dev -f migrations/001_initial_schema.sql
psql -U postgres -d souvenote_dev -f migrations/002_phase1_mock_backend.sql
psql -U postgres -d souvenote_dev -f migrations/003_account_profile_payments.sql
psql -U postgres -d souvenote_dev -f migrations/004_s3_upload_pipeline.sql
psql -U postgres -d souvenote_dev -f migrations/005_generation_job_lifecycle.sql
psql -U postgres -d souvenote_dev -f migrations/006_asset_moderation_lifecycle.sql
psql -U postgres -d souvenote_dev -f migrations/007_server_authoritative_order_pricing.sql
psql -U postgres -d souvenote_dev -f migrations/008_stripe_checkout_lifecycle.sql
psql -U postgres -d souvenote_dev -f migrations/009_scribeless_fulfillment_lifecycle.sql
psql -U postgres -d souvenote_dev -f migrations/010_public_card_links.sql
psql -U postgres -d souvenote_dev -f migrations/011_transactional_notifications.sql
psql -U postgres -d souvenote_dev -f migrations/012_canadian_pricing_and_credit_packs.sql
psql -U postgres -d souvenote_dev -f migrations/013_card_entitlement_ledger.sql
psql -U postgres -d souvenote_dev -f migrations/014_card_pack_purchases.sql
psql -U postgres -d souvenote_dev -f migrations/015_prepaid_card_delivery.sql
psql -U postgres -d souvenote_dev -f migrations/016_gifts_and_referrals.sql
psql -U postgres -d souvenote_dev -f seeds/001_pricing_catalog.sql
```

Run those commands from `backend/database`. For an existing database with
migration `001` already installed, the backend helper applies migrations
`002` through `016`:

```powershell
cd ../server
npm run db:migrate:phase1
```

## Verification

For a disposable, empty database, the backend validator applies every numbered
migration and seed in order, verifies the continuous migration sequence and
required tables, and confirms that the pricing seed is nonempty:

```powershell
cd ../server
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/souvenote_validation"
$env:DATABASE_VALIDATION_ALLOW_FRESH_DATABASE = "true"
npm run test:database
```

The validator refuses to run without the explicit safety flag or when the
database already contains a public table. Never point it at a development,
staging, production, or otherwise shared database. GitHub Actions runs it only
against a fresh PostgreSQL 16 service database.

For manual inspection of a normal local development database:

```powershell
psql -U postgres -d souvenote_dev
```

```sql
\dt

SELECT offer_code, name, price_cents
FROM pricing_catalog;
```

Expected pricing offer codes include `try_risk_free_one_card`,
`big_sender_2_10`, `big_sender_11_20`, `big_sender_21_30`,
`credit_pack_starter_10`, `credit_pack_creator_80`, and
`credit_pack_power_250`, plus `gift_souvenote_one_card`. All launch prices are
denominated in CAD, and the gift/card offers include printing and standard
delivery.

Do not commit database passwords, real connection strings, secret keys, or
local `.env` files. Apply migrations in filename order in every environment.
Production diagnostics must follow `../docs/operations-runbook.md`: use a
read-only transaction and never repair payment, credit, moderation, public-link,
notification, or fulfillment state with ad hoc SQL.
