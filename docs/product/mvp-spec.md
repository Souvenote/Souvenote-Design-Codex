# Souvenote MVP specification

Status: approved engineering source of truth
Market: Canada first
Currency: CAD
Updated: 2026-07-21

This is the sanitized product specification for implementation. It reconciles the confidential June 2026 PRD with the approved current application. The source PDF is intentionally not committed.

## Product objective

Souvenote turns a recipient, occasion, creative brief, and optional photo into a mailed physical keepsake containing an AI-generated card image, personalized inside message, and optional 30-second song reached through a printed QR code.

The MVP proves the physical-card loop end to end: account creation, starter credits, guided creation, generation, review, delivery, payment, fulfillment, confirmation, and library persistence.

## Active customer journey

1. Register or sign in with email/password, Google, Apple, or Facebook through Cognito.
2. Provision the application user and grant two starter credits exactly once.
3. Choose Personalize a Template or Build My Card.
4. Enter occasion, relationship, creative brief, optional photo, and image-rights attestation.
5. Validate, normalize, privately store, and moderate any upload.
6. Generate an image, optional song, and inside message.
7. Review, regenerate individual paid assets, and approve the result.
8. Capture Canadian recipient and sender addresses and verify QR readiness.
9. Select Try Risk-Free or Big Sender pricing and complete Stripe-hosted checkout.
10. Submit print-ready artwork, message, QR metadata, and addresses to Scribeless.
11. Show receipt, shipment estimate, song playback, referral nudge, and next actions.
12. Persist drafts, generated assets, saved cards, sent cards, orders, and resume state in My Cards and Songs.

## Credits

- Signup trial grant: two free credits, exactly once per Cognito identity, so a new user can try the creation experience before purchasing.
- First combined image and song generation: two credits.
- Image generation or edit: one credit.
- Song generation or regeneration: one credit.
- Inside-message and prompt assistance: zero user credits.
- Reserve/deduct credits before paid generation begins.
- Refund exactly once when a paid provider call fails, times out, returns a 5xx, is policy-blocked, or produces an invalid empty/black result.
- Every grant, reservation, deduction, refund, correction, and future referral event goes through an idempotent ledger.
- No first-send bonus exists in MVP.

## Pricing and entitlements

All launch prices are CAD and include shipping and ten creation credits per physical card.

| Offer            |                            Price | Entitlement                                      |
| ---------------- | -------------------------------: | ------------------------------------------------ |
| Try Risk-Free    | $9.99 if sent; $2.00 if not sent | One physical card and ten provisional credits    |
| Big Sender 2-10  |                       $8.99/card | Purchased card quantity and ten credits per card |
| Big Sender 11-20 |                       $7.99/card | Purchased card quantity and ten credits per card |
| Big Sender 21-30 |                       $6.99/card | Purchased card quantity and ten credits per card |
| Credit pack      |                            $2.00 | Ten standalone creation credits                  |
| Credit pack      |                           $10.00 | Eighty standalone creation credits               |
| Credit pack      |                           $25.00 | Two hundred fifty standalone creation credits    |

### Standalone credit packs

- Authenticated users may purchase any pack repeatedly, independent of a physical-card purchase.
- Grant credits only after the corresponding payment reaches an approved captured state.
- Apply each successful purchase grant exactly once through the idempotent credit ledger.
- Keep quantities, prices, currency, payment state, and granted balance server-authoritative.
- Deterministic local/test purchase mode may capture and grant without external traffic.
- Stripe-hosted collection and production activation remain disabled until the Section 5 checkout gate passes.

### Try Risk-Free

- Place a five-day CAD $9.99 authorization.
- Grant ten provisional credits only after successful authorization.
- Capture CAD $9.99 if the card enters fulfillment.
- If it is not sent by the deadline, charge a fixed CAD $2.00 and release the remaining authorization.
- Do not calculate a pay-per-used-credit no-send fee.
- Resolve the authorization exactly once through an idempotent scheduled operation.
- Keep production activation disabled until Stripe and legal review approve the behavior and customer copy.

### Big Sender

- Minimum two and maximum thirty cards per MVP reservation.
- Allow one shared design or different designs per recipient.
- Preserve unused purchased card entitlements and creations for twelve months.
- Prices, currency, credits, tax, and entitlement quantities are server-owned.

## Blank-card handoff

A one-card Try Risk-Free customer may send a blank physical Souvenote to a recipient, who can later complete and send it onward.

- It consumes the purchased physical-card entitlement.
- It is part of the physical MVP.
- It is not the broader Gift a Souvenote product.
- It remains feature-flagged until the Scribeless payload and recipient completion contract are documented and tested.

## Creation and media

- Preserve the current Personalize a Template and Build My Card visual journeys.
- Treat the existing Build My Card route/components as the module to refactor behind shared contracts.
- GPT Image 2 through a fal adapter is the initial image provider.
- Lyria 3 through a fal adapter is the initial 30-second song provider.
- An approved Llama model through Bedrock is the initial message/prompt provider.
- Deterministic mocks are the default for local development, CI, and unapproved environments.
- All provider traffic is feature-flagged, rate-limited, moderated, audited, and cost-recorded.
- Customer analytics must not include prompts, messages, card copy, recipient names, or private photo references.

## Library, delivery, and fulfillment

- My Cards and Songs shows drafts, approved assets, saved cards, sent cards, order entry points, and resume state.
- Delivery supports Canadian recipient and sender addresses for launch.
- Stripe Address Element or equivalent validated Stripe-hosted address input is used where appropriate.
- Scribeless receives versioned print artwork, inside message, QR metadata, recipient address, sender address, and an idempotency key.
- Fulfillment status and tracking updates are synchronized through verified webhooks or bounded polling.

## Inactive MVP placeholders

These may have polished routes or tiles, but must not execute transactions or simulate real success:

- General Gift a Souvenote and gift redemption
- Digital cards
- Harte Hanks fulfillment
- Business B2B
- Community send, remix, and catalog
- Full referral dashboard, invite loop, and rewards
- Trust Circle
- Calendar and reminders
- Chatbot
- Recipient share rewards
- Animated downloads

Placeholder actions must clearly say that the feature is coming later, or be removed from navigation. They must not claim that payment, email, credit, reward, send, or fulfillment occurred.

## Analytics and observability

- PostHog records a PII-free funnel from signup through order confirmation.
- Sentry captures sanitized frontend and backend errors.
- Audit logs record security- and money-sensitive domain actions.
- Provider, queue, webhook, payment, fulfillment, and database failures have operational alerts before production.

## Launch acceptance

- Email and all three social providers work through Cognito.
- Signup grants two free trial credits exactly once.
- All three standalone CAD credit packs are purchasable independently and grant their exact credit quantity once per captured payment.
- Both creation routes complete the same secured backend journey.
- Credit costs and refunds remain correct under retries and concurrency.
- Try Risk-Free and Big Sender implement the approved CAD rules.
- Raw card information never enters Souvenote inputs, APIs, logs, analytics, or storage.
- A print-ready sandbox order reaches Scribeless with the correct QR and addresses.
- My Cards and Songs persists and resumes work.
- Inactive routes cannot perform real actions.
- All critical tests, builds, audits, migrations, staging smoke tests, and rollback checks pass.

## Explicitly unresolved launch gates

These require future user approval and must not be inferred:

- USD pricing and US launch date.
- Stripe/legal approval for Try Risk-Free production activation.
- Final Scribeless print dimensions, bleed, safe area, color profile, DPI, and blank-card payload.
- Paid provider activation and its cost envelope.
- AWS staging and production deployment approvals.
