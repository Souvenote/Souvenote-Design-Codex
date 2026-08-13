# Souvenote Section 13 staging release - 2026-08-12

## Decision

The Section 13 release is deployed and accepted for continued mock-mode product
testing in the existing AWS staging environment:

<https://d2lbqxot54qnt4.cloudfront.net>

This acceptance does not enable real payments, generation, printing, mailing,
transactional email, analytics, or third-party error reporting.

## Deployed release

- AWS account: `654047456665`
- Region: `ca-central-1`
- CloudFormation stack: `souvenote-staging-v2`
- Stack state: `UPDATE_COMPLETE`
- Source commit: `b463808`
- Source archive SHA-256:
  `5f9a419908126327848956a321ed3957123b775a300d9acbb2c592df8fcddae3`
- ECS task definition: `souvenote-staging:4`
- ECS service: desired 1, running 1, pending 0
- ECS rollout: completed
- Release workflow exit: `0`

The source archive was built into staging images, migrations completed before
application rollout, ECS reached steady state, and the deployment smoke suite
passed through CloudFront.

## Database evidence

The successful migration task applied:

- `013_card_entitlement_ledger.sql`
- `014_card_pack_purchases.sql`
- `015_prepaid_card_delivery.sql`
- `016_gifts_and_referrals.sql`
- repeatable seed `001_pricing_catalog.sql`

The staging database contained historical byte checksums for migrations 001,
009, and 010. Each stored checksum was traced to the retained July 27 staging
source archive. After comment-only lines, blank lines, trailing whitespace, and
line-ending differences were removed, the archived and current executable SQL
matched. The runner therefore accepts only those exact audited hashes and
canonicalized their ledger entries; it continues to reject any executable SQL
change to an applied migration.

## Live smoke evidence

The deployment workflow verified:

- `200`: `/`, `/gift`, `/gift/redeem`, `/refer`, and
  `/r/not-a-real-referral`
- `200`: `/api/health`, `/api/health/live`, and `/api/health/ready`
- `401` without a token: `/api/gifts`, `/api/referrals/me`, and
  `/api/card-entitlements/balance`
- `404` for invalid public claims: `/api/gifts/claim/not-a-real-gift` and
  `/api/referrals/claim/not-a-real-referral`
- the staging origin receives the expected CORS allow-origin response
- an unrelated origin receives no allow-origin response
- required frontend security headers are present

A browser check of the deployed pricing page also confirmed the card-pack copy
states: `Printing and standard delivery included`.

## Local release verification

- Frontend: 54 unit tests, strict TypeScript check, optimized Next.js build,
  35 expected route responses, and one intentional `404` passed.
- Backend: 52 unit suites / 291 tests, 2 end-to-end suites / 23 tests, lint,
  typecheck, and production build passed.
- Both staging and production CloudFormation templates passed AWS
  `validate-template`.

## Provider and cost posture

- Checkout remains mocked; Stripe is not called.
- Generation remains mocked; no generation provider is called.
- Fulfillment remains mocked; no print or mail provider is called.
- Notifications remain mocked; no email provider is called.
- No paid third-party service was activated.
- The release reused the existing AWS staging stack and its established budget
  controls. No production or DNS change was made.

This record intentionally excludes customer data, email addresses, Cognito
tokens, passwords, postal addresses, signed URLs, and secrets.
