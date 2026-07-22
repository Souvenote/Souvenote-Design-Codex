# MVP decision register

This register contains product and engineering decisions that override conflicting PRD, prototype, or legacy-document statements. Add future decisions chronologically; do not rewrite history.

## Decision format

```text
ID:
Date:
Status: proposed | approved | superseded
Decision:
Reason:
Supersedes:
Consequences:
Approval reference:
```

## Approved decisions

### MVP-001 - Authority order

- Date: 2026-07-21
- Status: approved
- Decision: Explicit user decisions and this register take precedence, followed by the sanitized MVP specification, PRD product intent, current approved visual journey, engineering/security rules, and finally legacy documents.
- Consequence: Conflicts are surfaced rather than silently resolved.

### MVP-002 - Confidential PRD handling

- Date: 2026-07-21
- Status: approved
- Decision: Keep the original confidential PDF outside Git and commit only a sanitized implementation specification.
- Consequence: Fresh tasks read `docs/product/mvp-spec.md`; they do not require the PDF.

### MVP-003 - Visual and frontend strategy

- Date: 2026-07-21
- Status: approved
- Decision: Preserve the current visual design and route journey. Do not rewrite the application into Tailwind. Add server-state and ephemeral workflow-state tools only where they clarify ownership.
- Supersedes: PRD prescription of Tailwind as a required frontend technology.

### MVP-004 - MVP/future feature boundary

- Date: 2026-07-21
- Status: approved
- Decision: Gift, redemption, digital cards, B2B, Community, full referrals, Trust Circle, calendar, chatbot, recipient rewards, and animated downloads remain inactive placeholders. The one-card blank-card handoff remains part of the physical MVP.
- Consequence: Functional-looking prototype actions must be disabled or clearly labeled.

### MVP-005 - Canada-first pricing

- Date: 2026-07-21
- Status: approved
- Decision: PRD prices are CAD. Canada launches first. US checkout remains disabled until an independent USD catalog and unit economics are approved.
- Supersedes: USD seed currency and any assumption that matching face values apply in both markets.

### MVP-006 - Try Risk-Free

- Date: 2026-07-21
- Status: approved
- Decision: Five-day CAD $9.99 authorization; capture $9.99 when sent; otherwise charge a fixed CAD $2.00 and release the remainder.
- Supersedes: Seven-day copy and $0.20-per-used-credit behavior in the prototype.
- Gate: Production activation requires Stripe and legal approval.

### MVP-007 - Credits and bonus

- Date: 2026-07-21
- Status: approved
- Decision: Signup grants two credits once; combined first image/song generation costs two; individual image/song regeneration costs one; inside-message generation costs zero; remove the first-send +2 bonus.

### MVP-008 - Big Sender

- Date: 2026-07-21
- Status: approved
- Decision: Big Sender begins at two cards and supports 2-30 cards using the approved CAD tiers.
- Supersedes: Prototype copy that begins the first tier at one card.

### MVP-009 - Build My Card module

- Date: 2026-07-21
- Status: approved
- Decision: Treat the existing Build My Card route and components as the module. Refactor it behind the same draft, upload, generation, delivery, and checkout contracts as Personalize a Template.

### MVP-010 - Song duration

- Date: 2026-07-21
- Status: approved
- Decision: Thirty-second Lyria 3 output is acceptable for MVP.
- Supersedes: PRD target of 40-50 seconds.

### MVP-011 - Database scope

- Date: 2026-07-21
- Status: approved
- Decision: Build a complete, constrained MVP schema plus stable product-neutral extension points. Do not create a speculative complete V2 schema.
- Supersedes: PRD requirement to place all dormant V2 tables in migration 001.

### MVP-012 - Cost and external action approvals

- Date: 2026-07-21
- Status: approved
- Decision: Preserve at least $1,000 of AWS credit and require explicit scoped approval for every action that can create/increase cost or activate a paid provider.
- Consequence: Local mocks and read-only inspection precede external mutations. Silence is denial.

### MVP-013 - Prototype behavior is not product approval

- Date: 2026-07-21
- Status: approved
- Decision: Existing UI presentation is not evidence that a feature is approved for transaction or persistence. Where current behavior conflicts with this register, preserve the styling and journey while replacing the behavior and copy.
- Consequence: Functional-looking Gift, referral, Community, US, bonus, pricing, and duration behavior remains subject to this register.

### MVP-014 - Section 0 CI baseline

- Date: 2026-07-21
- Status: approved implementation decision
- Decision: Section 0 CI is credential-free and non-deploying. It blocks type, unit-test, production-build, and critical dependency-audit failures. Existing non-fixing lint failures and high dependency advisories are recorded debt for Section 1, not silently waived.
- Consequence: CI starts green without rewriting source, touching a database, or requiring secrets; Section 1 must remediate the debt and raise the gates.
