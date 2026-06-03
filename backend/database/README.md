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