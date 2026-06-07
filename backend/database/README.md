# Souvenote Database

This folder contains the PostgreSQL database setup for the Souvenote backend.

## Structure

- `migrations/` contains SQL files that create or update the database structure.
- `seeds/` contains starter data, such as pricing plans.

## First Migration

`001_initial_schema.sql` will create the first version of the database schema.

Planned core tables:
- users
- credit_ledger
- card_drafts
- generation_jobs
- assets
- orders
- payments
- pricing_catalog
- audit_logs

## Local Development

Start with local PostgreSQL first.

After the schema works locally, the same migration can later be run against AWS RDS PostgreSQL.

## Important

Do not commit database passwords, connection strings with real credentials, or secret keys.

````md
# Souvenote Local Database Setup

This folder contains the local PostgreSQL database setup for the Souvenote backend.

## Purpose

The database migration and seed files allow every developer to create the same local database structure before connecting the NestJS backend.

The local database is used for development and testing before the project is deployed to AWS.

## Required Database Name

Each developer should create a local PostgreSQL database named:

```txt
souvenote_dev
````

## Folder Structure

```txt
database/
  migrations/
    001_initial_schema.sql
  seeds/
    001_pricing_catalog.sql
  README.md
```

## Setup with psql

From the `backend/` folder, run:

```bash
createdb -U postgres souvenote_dev
psql -U postgres -d souvenote_dev -f database/migrations/001_initial_schema.sql
psql -U postgres -d souvenote_dev -f database/seeds/001_pricing_catalog.sql
```

## Setup with pgAdmin 4

1. Open pgAdmin 4.
2. Right-click `Databases`.
3. Select `Create` → `Database`.
4. Name the database `souvenote_dev`.
5. Open the Query Tool for `souvenote_dev`.
6. Run the contents of:

```txt
database/migrations/001_initial_schema.sql
```

7. Then run the contents of:

```txt
database/seeds/001_pricing_catalog.sql
```

## Verify Setup

Using `psql`, connect to the database:

```bash
psql -U postgres -d souvenote_dev
```

List tables:

```sql
\dt
```

Check the pricing catalog:

```sql
SELECT offer_code, name, price_cents
FROM pricing_catalog;
```

Expected pricing rows include:

```txt
try_risk_free_one_card
big_sender_2_10
big_sender_11_20
big_sender_21_30
```

## Reset Local Database

If the schema changes during development and there is no important local data to keep, reset the database:

```bash
dropdb -U postgres souvenote_dev
createdb -U postgres souvenote_dev
psql -U postgres -d souvenote_dev -f database/migrations/001_initial_schema.sql
psql -U postgres -d souvenote_dev -f database/seeds/001_pricing_catalog.sql
```

## Important Notes

* Do not commit real database passwords.
* Do not commit `.env` files.
* Migration files define the database structure.
* Seed files insert starting data needed for development.
* AWS deployment will use the same migration concept later, but local development should be tested first.




# Souvenote Local Database Setup

This folder contains the local PostgreSQL database setup for the Souvenote backend.

## Purpose

The database migration and seed files allow every developer to create the same local database structure before connecting the NestJS backend.

The local database is used for development and testing before the project is deployed to AWS.

## Required Database Name

Each developer should create a local PostgreSQL database named:

```txt
souvenote_dev
```

## Folder Structure

```txt
database/
  migrations/
    001_initial_schema.sql
  seeds/
    001_pricing_catalog.sql
  README.md
```

## Setup with psql

From the `backend/` folder, run:

```bash
createdb -U postgres souvenote_dev
psql -U postgres -d souvenote_dev -f database/migrations/001_initial_schema.sql
psql -U postgres -d souvenote_dev -f database/seeds/001_pricing_catalog.sql
```

## Setup with pgAdmin 4

1. Open pgAdmin 4.
2. Right-click `Databases`.
3. Select `Create` → `Database`.
4. Name the database `souvenote_dev`.
5. Open the Query Tool for `souvenote_dev`.
6. Run the contents of:

```txt
database/migrations/001_initial_schema.sql
```

7. Then run the contents of:

```txt
database/seeds/001_pricing_catalog.sql
```

## Verify Setup

Using `psql`, connect to the database:

```bash
psql -U postgres -d souvenote_dev
```

List tables:

```sql
\dt
```

Check the pricing catalog:

```sql
SELECT offer_code, name, price_cents
FROM pricing_catalog;
```

Expected pricing rows include:

```txt
try_risk_free_one_card
big_sender_2_10
big_sender_11_20
big_sender_21_30
```

## Reset Local Database

If the schema changes during development and there is no important local data to keep, reset the database.

From the `backend/` folder, run:

```bash
dropdb -U postgres souvenote_dev
createdb -U postgres souvenote_dev
psql -U postgres -d souvenote_dev -f database/migrations/001_initial_schema.sql
psql -U postgres -d souvenote_dev -f database/seeds/001_pricing_catalog.sql
```

## Important Notes

* Do not commit real database passwords.
* Do not commit `.env` files.
* Migration files define the database structure.
* Seed files insert starting data needed for development.
* AWS deployment will use the same migration concept later, but local development should be tested first.
