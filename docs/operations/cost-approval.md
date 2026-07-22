# Cost and external-action approval policy

AWS credit and paid-provider access are budgets, not standing authorization.

## Current envelope

- Original AWS Activate credit: $5,000.
- Estimated remaining when this policy was approved: approximately $4,932.
- Credit expiration: 2028-03-31.
- Required reserve: at least $1,000.
- Planned cumulative AWS gross-cost ceiling: approximately $3,900 unless explicitly changed.

Billing and budget data are delayed. All estimates must include a buffer and quote gross service cost before credits.

## Allowed without cost approval

- Repository reads and local edits.
- Public-documentation research.
- Read-only AWS inventory and billing inspection.
- Local tests using deterministic mocks.
- Local PostgreSQL/Docker development.
- Builds, type checks, lint checks, audits, and static infrastructure synthesis.
- `cdk synth` and non-executing infrastructure diffs/change-set preparation.
- Confirmed free test/sandbox modes that cannot convert automatically to paid usage.

## Explicit approval required

- Any AWS create, update, deploy, scale, purchase, subscription, or destructive delete.
- Executing CDK or CloudFormation changes.
- Real or metered Bedrock, fal, Stripe, Scribeless, SendGrid, PostHog, Sentry, OpenAI API, or other provider traffic.
- Live transactions, physical fulfillment, paid email/SMS, domain registration, Marketplace products, support-plan changes, reserved capacity, or auto-converting trials.
- Increasing size, desired count, retention, throughput, storage, logging, backup, or service quotas.

## Approval request template

```text
Approval ID:
Purpose:
Account and region:
Environment:
Resources/services affected:
Exact command or action:
Infrastructure/configuration diff:
One-time gross cost estimate:
Monthly gross cost estimate:
Worst-case cost before billing refresh:
AWS credit eligibility:
Possible cash exposure:
Duration:
Rollback/shutdown procedure:
Data-loss risk:
Approval expiry:
```

Valid approval must be explicit and scoped, for example:

```text
APPROVE AWS-STAGING-001 UP TO $40 GROSS THROUGH 2026-08-31
```

Silence, an expired approval, a different action, or an exceeded amount is denial. Stop and request a new approval.

## CI and IAM enforcement target

- Ordinary CI can test, build, audit, and synthesize, but cannot deploy.
- AWS access uses short-lived OIDC credentials.
- Staging and production deployment jobs require the user as protected-environment reviewer.
- Separate read-only, plan, staging-deploy, production-deploy, and user-controlled break-glass roles.
- Deploy roles deny Marketplace purchases, reserved capacity, paid support changes, domain registration, large/accelerated compute, provisioned model capacity, IAM escalation, and modification of billing controls.
- Gross-cost budgets exclude credits and alert at 25%, 50%, 75%, 90%, and 100%.
- A deny-new-provisioning action is prepared for the approved envelope, with only the user-controlled break-glass role exempt.
