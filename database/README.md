# Souvenote database

This directory owns the PostgreSQL 16 schema and its verification boundary. The
Section 2 baseline is for a clean pre-launch database, and Section 3 adds
immutable migrations for the approved catalog and mock lifecycles. This is not an upgrade from
the deleted legacy draft migrations, which were never approved or applied to a
shared environment.

No repository startup, health check, build, or ordinary test command applies a
migration automatically. Applying a migration is always an explicit operation.

## Layout

```text
database/
  migrations/
    0001_mvp_baseline.sql
    0002_pricing_credits_entitlements.sql
    0003_standalone_credit_packs.sql
    checksums.sha256
  tests/
    0001_mvp_baseline.test.sql
    0002_pricing_credits_entitlements.test.sql
    0003_standalone_credit_packs.test.sql
  migrate.mjs
  verify.mjs
```

- `migrate.mjs` is the only supported migration entry point. It verifies the
  committed SHA-256 manifest, obtains a PostgreSQL advisory lock, validates the
  append-only journal, and applies each pending file in its own transaction.
- `verify.mjs` creates a uniquely named, volume-free PostgreSQL 16 container,
  applies the migration twice, runs the SQL contract tests, proves checksum drift
  is rejected, and removes the exact disposable container in a `finally` block.
- The SQL contract tests roll their fixture data back. They check atomic
  credit behavior, idempotency, ownership boundaries, state transitions, upload
  expiry, provider/webhook uniqueness, exact CAD tiers, generation costs,
  entitlement reservations, and Try Risk-Free resolution.

The scripts use only the workspace's existing `pg` dependency and the local Docker
CLI. They do not contact AWS or a paid provider.

## Applying migrations explicitly

Use the canonical Node.js 22/npm 10.9.8 workspace and set `DATABASE_URL` in the
current process. Never put a credential or connection string in Git.

```powershell
$env:DATABASE_URL = '<approved PostgreSQL connection string>'
node.exe database/migrate.mjs
```

The runner refuses to continue when:

- a migration is missing from `checksums.sha256`;
- a file's SHA-256 differs from the committed manifest;
- the database journal contains an unknown migration;
- an applied checksum differs from the current verified checksum; or
- a migration version/name conflicts with its journal entry.

Do not apply this clean-start baseline to a database that contains legacy
Souvenote tables. Section 2 assumes no shared or production database exists.

## Isolated verification

With Docker running and no important database selected:

```powershell
node.exe database/verify.mjs
```

The verifier never uses the normal `souvenote-local-postgres-data` volume and never
connects to the normal local database. Its container name begins with
`souvenote-db-verify-` and includes a random suffix. Cleanup targets only the exact
name created by that process.

## Schema scope

The verified migrations include only approved physical-card MVP data:

- migration journal and lifecycle transition rules;
- users, Cognito identities, and hashed application sessions;
- idempotency records;
- price books and physical-card offers;
- atomic credit accounts and append-only credit ledger;
- physical-card entitlements;
- drafts and append-only revisions;
- private uploads and 24-hour uncommitted-upload expiry;
- generation jobs, sanitized provider attempts, and assets;
- hashed public-share/QR metadata;
- orders and immutable order items;
- payment records and payload-free webhook receipts;
- fulfillment jobs and shipments;
- notifications, append-only audit events, and feature flags.

There are no Gift, Trust Circle, chatbot, calendar, community-catalog, Harte Hanks,
digital-card, or other speculative future-feature tables. Section 3 makes four
Canada/CAD offers catalog-visible while leaving every `checkout_enabled` value
false. It also adds 2-30-card quote reservations, action-specific generation
credit constraints, and deterministic mock Try Risk-Free authorizations. The
mock offer is limited to one authorization per account and resolves to either a
999-minor-unit fulfillment capture or a fixed 200-minor-unit five-day capture.
The approved correction adds three standalone CAD credit-pack offers and
owner-scoped purchase snapshots. Local/test mock capture grants the selected
quantity through the idempotent ledger; production checkout remains disabled until
Section 5 activates Stripe-hosted collection.

## Database invariants

- Money is an integer minor-unit amount paired with an uppercase ISO currency.
- Customer-owned relationships use composite `(resource_id, user_id)` foreign
  keys, preventing a valid UUID from being attached across owners.
- `credit_ledger` inserts lock the user's `credit_accounts` row and update the
  nonnegative balance atomically. The supported function is
  `apply_credit_ledger_entry(...)`; an identical retry returns the original result.
- A partial unique index permits one `signup_grant` per user.
- Migration, credit, revision, order-item, lifecycle-rule, and audit rows are
  append-only where business history must not be rewritten.
- Initial lifecycle states and allowed transitions are checked by database
  triggers for uploads, generation, assets, entitlements, orders, payments,
  webhooks, fulfillment, shipments, and notifications.
- Sensitive mutations carry database-unique idempotency keys. Provider request,
  payment, fulfillment, shipment, notification, and webhook IDs are unique in
  their provider scope.
- Session/share tokens are stored only as SHA-256 hashes. Provider request and
  webhook bodies are represented by hashes rather than duplicated sensitive
  payloads.
- Upload cleanup can use the partial `uploads_expiry_idx`; uncommitted rows cannot
  be created with an expiry later than 24 hours.
- Raw card numbers, CVV values, and billing vault records are not stored. Stripe-
  hosted integration belongs to Section 5; `payments` stores provider references
  and lifecycle amounts only.

## Adding a later migration

After this baseline has been applied anywhere shared, never edit it. Add the next
zero-padded SQL file, regenerate `checksums.sha256` in a reviewed change, and verify
both a clean apply and upgrade from the latest journaled schema. Applied journal
rows and transition rules are immutable.

Normal local shutdown preserves the shared development volume. Do not improvise a
database reset or volume deletion; follow the repository's approved lifecycle
instructions and obtain explicit direction before any destructive operation.
