# Souvenote Backend Plan

## Current Goal

Build the backend and database foundation while frontend direction is being finalized. The backend should support the MVP physical-card flow end to end while keeping future V2 features dormant through schema readiness, feature flags, and documented API contracts.

## Initial Backend Priorities

1. Create PostgreSQL database schema
2. Add pricing catalog seed data
3. Set up NestJS backend
4. Add health check endpoint
5. Add pricing catalog endpoint
6. Add credit ledger logic
7. Add mock AI generation flow
8. Add upload and order API contracts

## MVP Rules

- All AI provider calls should support mock mode first.
- No secrets, API keys, or credentials should be committed.
- Credit grants, deductions, and refunds must go through the credit ledger.
- Backend responses should be documented before frontend fetch calls depend on them.

## Backend Tech Stack

The Souvenote backend stack is designed to support the MVP physical-card flow while keeping the system ready for future features. The backend will use NestJS for the API, PostgreSQL for persistent data, AWS services for authentication, storage, and AI support, and external providers for payments, fulfillment, notifications, analytics, and error tracking.

### Core Backend Technologies

- **NestJS** will be used for the backend API. It provides a structured way to organize backend logic into modules such as auth, users, credits, pricing, uploads, generation, checkout, orders, and fulfillment.

- **PostgreSQL** will be used as the main relational database. It will store users, credit ledger entries, pricing catalog items, cards, drafts, assets, orders, fulfillment records, referrals, and audit logs.

- **AWS Cognito** will handle authentication. Users will be able to sign up and log in with email/password and supported social login providers. The backend will trust Cognito for identity and then create or update the matching user record in PostgreSQL.

- **AWS S3** will store private uploaded and generated assets, including user-uploaded photos, generated card images, print-ready files, and QR-related assets. Uploads should use signed URLs so files do not pass directly through the backend server.

- **AWS Bedrock** will be used for Llama-based text generation and helper prompts, such as inside messages, card copy, theme support, and song prompt translation.

- **fal.ai** will be used for AI media generation. GPT Image 2 will generate or edit the front card image, and Lyria 3 will generate the custom short song.

- **Stripe** will handle checkout, payment holds, final charges, Stripe Tax, credit pack purchases, Big Sender reservations, and payment webhooks.

- **Scribeless** will handle physical card fulfillment. The backend will prepare the final print job payload, including artwork, inside message, QR code, recipient address, and sender address.

- **SendGrid** will handle transactional emails such as verification/welcome state, order confirmations, shipping updates, and possibly basic referral messages.

- **PostHog** will track product funnel events without storing PII. Events should track user actions like signup, checkout started, generation started, generation approved, and order confirmed, but should not include message text, recipient names, card text, or uploaded photo references.

- **Sentry** will track backend errors and exceptions so failures can be monitored during development, staging, and launch.

### Backend Stack Summary

Backend API: NestJS
Database: PostgreSQL
Authentication: AWS Cognito
File Storage: AWS S3
Text AI: AWS Bedrock / Llama
Image AI: GPT Image 2 through fal.ai
Music AI: Lyria 3 through fal.ai
Payments: Stripe
Fulfillment: Scribeless
Emails: SendGrid
Analytics: PostHog
Error Tracking: Sentry

## Core Backend Modules

The Souvenote backend will be organized into modules so each major responsibility is separated and easier to build, test, and maintain. Each module should expose clear API routes, service logic, database access, validation rules, and error handling where needed.

### Auth Module

The auth module connects AWS Cognito authentication to the backend. Cognito will handle user login and identity, while the backend will use the authenticated Cognito user to create or find the matching PostgreSQL user record.

Responsibilities:

- Validate authenticated requests from Cognito.
- Create the local user record on first authenticated request.
- Connect the user to a Stripe customer record.
- Trigger the starter credit grant after signup.
- Protect private backend routes.

### Users Module

The users module stores and manages user profile data needed by the backend. It should avoid storing unnecessary personal information and only keep data required for the MVP flow.

Responsibilities:

- Store local user records.
- Track account status.
- Store Stripe customer ID.
- Connect users to credits, drafts, cards, orders, and referrals.
- Support future account settings.

### Pricing Module

The pricing module stores the MVP pricing catalog and exposes pricing information to the frontend. This includes the Try Risk-Free one-card offer and Big Sender card tiers.

Responsibilities:

- Store pricing catalog seed data.
- Return active pricing options.
- Support Try Risk-Free and Big Sender rules.
- Keep dormant pricing support ready for future digital cards or gifts.

### Credits Module

The credits module controls all credit/token changes through a ledger. No credit grant, deduction, refund, correction, or pack draw should happen outside the ledger.

Responsibilities:

- Grant starter credits after signup.
- Deduct credits before generation.
- Refund credits when eligible generation failures happen.
- Track credit pack purchases.
- Support referral grants.
- Return the user's current credit balance.
- Ensure ledger writes are idempotent.

### Uploads Module

The uploads module handles private media uploads through S3 signed URLs. User photos and generated assets should be stored privately and should not be publicly accessible.

Responsibilities:

- Create signed upload URLs.
- Validate accepted file types and size rules.
- Track upload status.
- Store S3 keys.
- Capture image-rights attestation.
- Support moderation status.
- Clean up uncommitted uploads.

### Generation Module

The generation module manages AI generation jobs for the card image, custom song, and inside message. It should support mock mode first before real AI provider traffic is enabled.

Responsibilities:

- Create generation jobs.
- Track image, song, and message statuses.
- Support mock generation responses.
- Deduct credits before paid generation.
- Refund credits when provider failures qualify.
- Store generated asset references.
- Allow regeneration of individual assets.
- Mark approved assets for checkout and fulfillment.

### Cards and Drafts Module

The cards and drafts module stores the user's in-progress and completed card creations. This lets users leave the flow and resume later from the correct step.

Responsibilities:

- Create card drafts.
- Save occasion, relationship, prompt answers, upload references, and generation results.
- Track draft progress.
- Store approved card assets.
- Support My Cards and Songs.
- Support resume-at-furthest-step behavior.

### Checkout Module

The checkout module manages payment and checkout logic through Stripe. It should handle both Try Risk-Free and Big Sender checkout behavior.

Responsibilities:

- Create Stripe checkout sessions or payment flows.
- Support Try Risk-Free holds, finalization, and release.
- Support Big Sender card reservations.
- Apply Stripe Tax where needed.
- Handle promo or referral code logic.
- Process Stripe webhooks.
- Update order and credit state after payment events.

### Orders Module

The orders module creates and tracks physical card orders after checkout and approval. It connects the approved card, delivery details, payment state, and fulfillment state.

Responsibilities:

- Store recipient and sender delivery information.
- Validate supported delivery countries.
- Connect orders to approved card assets.
- Track order status.
- Store receipt and checkout result details.
- Connect order state to Scribeless fulfillment.

### Fulfillment Module

The fulfillment module handles the Scribeless physical-card handoff. It prepares the final print job payload and updates the order as fulfillment progresses.

Responsibilities:

- Prepare artwork, inside message, QR code, recipient address, and sender address.
- Send print job requests to Scribeless.
- Store Scribeless job IDs.
- Handle tracking webhooks.
- Track fulfillment status.
- Support retry or hold states if fulfillment fails.

### Notifications Module

The notifications module handles transactional emails through SendGrid.

Responsibilities:

- Send welcome or verification-related email states if needed.
- Send order confirmation emails.
- Send shipment update emails.
- Support basic referral messages if activated.
- Keep future lifecycle email support ready.

### Analytics Module

The analytics module records backend product events without storing PII. Analytics should help track the MVP funnel without saving card text, message text, recipient names, or uploaded photo references.

Responsibilities:

- Track backend funnel events.
- Send safe events to PostHog.
- Avoid PII in analytics payloads.
- Support launch monitoring.

### Observability Module

The observability module helps detect backend errors and system failures during development, staging, and production.

Responsibilities:

- Send backend errors to Sentry.
- Support structured logs.
- Track provider failures.
- Track webhook failures.
- Support health checks and monitoring.

### Admin and Internal Support Module

The admin/internal module should stay limited during MVP but can provide safe internal tools later for debugging, support, and corrections.

Responsibilities:

- Support manual credit corrections through the ledger only.
- Support order lookup for debugging.
- Support provider failure investigation.
- Keep admin actions auditable.

## Database Plan

The Souvenote database will use PostgreSQL and will be managed through versioned migration files. The first migration, `001_initial_schema.sql`, should create the MVP database foundation while also preparing dormant V2-ready tables and fields where useful.

The goal is to avoid rebuilding the database later. MVP features should be active through backend logic, while future features can remain inactive through feature flags, placeholder routes, and unused schema fields.

### Migration Strategy

The first migration should create the core schema required for the MVP physical-card flow. This includes users, pricing, credit ledger entries, uploads, generated assets, card drafts, orders, fulfillment records, referrals, and audit logs.

The migration should also include important database safety features such as:

- Primary keys
- Foreign keys
- Status enums
- Indexes for common lookup fields
- `created_at` and `updated_at` timestamps
- Soft-delete fields where useful
- Audit log support for important backend actions

The MVP source of truth says the first migration should create the MVP and dormant V2 schema, including tables, columns, indexes, foreign keys, enums, and audit fields.

### Core MVP Tables

The initial schema should include these main tables:

- `users`
- `pricing_catalog`
- `credit_ledger`
- `card_drafts`
- `uploads`
- `generated_assets`
- `generation_jobs`
- `orders`
- `order_items`
- `fulfillment_jobs`
- `referrals`
- `audit_logs`

### Table Responsibilities

#### users

Stores the local backend user record connected to the authenticated Cognito user.

Main purpose:

- Connect Cognito identity to PostgreSQL data.
- Store Stripe customer ID.
- Track account status.
- Connect the user to credits, drafts, orders, and referrals.

#### pricing_catalog

Stores active MVP pricing options such as Try Risk-Free and Big Sender tiers.

Main purpose:

- Let the backend return pricing options to the frontend.
- Keep pricing logic controlled by the database.
- Allow future pricing options to be added without rewriting the backend.

#### credit_ledger

Stores every credit/token change. This is one of the most important tables because no credit-changing action should bypass the ledger.

Main purpose:

- Track signup grants.
- Track generation deductions.
- Track refunds.
- Track pack purchases.
- Track referral grants.
- Track manual corrections.
- Support idempotency so duplicate requests do not double-charge or double-grant credits.

#### card_drafts

Stores in-progress card creation data.

Main purpose:

- Save the user's progress during Personalize a Template or Build My Card.
- Store occasion, relationship, prompt answers, upload references, and current step.
- Let users resume unfinished cards later.

#### uploads

Stores metadata for uploaded files.

Main purpose:

- Track S3 keys.
- Track upload status.
- Track moderation status.
- Track image-rights attestation.
- Support cleanup of uncommitted uploads.

#### generated_assets

Stores AI-generated output references.

Main purpose:

- Store generated image, song, and message records.
- Track S3 keys or provider result references.
- Track approval status.
- Connect generated assets to card drafts and orders.

#### generation_jobs

Tracks AI generation requests and their status.

Main purpose:

- Track whether generation is pending, running, succeeded, failed, refunded, canceled, or approved.
- Store mock provider results during development.
- Store provider job IDs when real integrations are enabled.
- Connect failed jobs to credit refund behavior.

#### orders

Stores completed or in-progress order records.

Main purpose:

- Connect a user, approved card, checkout status, delivery details, and fulfillment status.
- Track Try Risk-Free or Big Sender order behavior.
- Store receipt and payment state.

#### order_items

Stores individual card items inside an order.

Main purpose:

- Support one-card orders.
- Support Big Sender multi-card orders.
- Prepare for future digital cards or gift line items.

#### fulfillment_jobs

Tracks Scribeless fulfillment.

Main purpose:

- Store Scribeless job ID.
- Track print job status.
- Store tracking URL.
- Track retry or hold states.
- Sync fulfillment updates back to the order.

#### referrals

Stores referral-related records.

Main purpose:

- Track referral links.
- Track signup reward grants.
- Keep the future referral dashboard ready without activating the full referral loop during MVP.

#### audit_logs

Stores important backend actions.

Main purpose:

- Track credit changes.
- Track refund events.
- Track provider failures.
- Track checkout webhook handling.
- Track fulfillment webhook handling.
- Help debug production issues safely.

### Seed Data

The `backend/database/seeds/` folder should store seed data for required MVP configuration.

Seed data should include:

- Try Risk-Free pricing option
- Big Sender pricing tiers
- Starter credit grant rule
- Default feature flags
- Mock provider configuration where useful

### Database Rules

- Every credit change must be written to `credit_ledger`.
- Every important backend action should be traceable through `audit_logs`.
- Generated files should store S3 keys, not public URLs.
- Tables should use clear status values instead of random strings.
- Future V2 features can have dormant tables or fields, but inactive features should not appear as working user flows.
- Real secrets, API keys, and credentials should never be stored in migration or seed files.

## Remaining Backend Implementation Areas

The remaining backend work will be implemented through code instead of more planning documents.

### Auth and User Provisioning

Cognito will authenticate users. The backend will create a local PostgreSQL user on the first authenticated request, connect the user to a Stripe customer, and grant 2 starter credits through the credit ledger.

### Credit Ledger

All credit grants, deductions, refunds, pack purchases, referral grants, and manual corrections must go through the credit ledger. The backend should never directly edit a user's credit balance without writing a ledger entry.

### Upload Pipeline

Uploads will use signed S3 URLs. The backend will track upload status, file validation, moderation state, image-rights attestation, and whether the upload has been committed to a card draft.

### Mock AI Generation

The MVP backend should support mock AI generation before connecting real providers. Mock generation should return fake image, song, and inside-message results so the frontend can build against stable responses.

### API Contracts

Backend responses should be documented and stable before the frontend depends on them. The first contracts to build are health check, pricing catalog, credit balance, draft creation, upload request, generation start, generation status, and order creation.

### Backend Definition of Done

The backend MVP foundation is ready when the app can run locally, connect to PostgreSQL, return pricing data, manage credits through the ledger, create mock generation jobs, and expose documented API responses for the frontend.
