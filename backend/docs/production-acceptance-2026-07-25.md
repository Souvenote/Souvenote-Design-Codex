# Souvenote AWS Production Preview Acceptance - 2026-07-25

## Decision

The Souvenote application is accepted for private AWS production-preview
testing at:

<https://d2gh9cmv2togx4.cloudfront.net>

It is not approved for real customer traffic, payments, generation, printing,
mailing, transactional email, analytics, or third-party error reporting.
`www.souvenote.com`, its Google-hosted site, its DNS records, and Google
Workspace mail records were not changed.

## Deployed release

- AWS account: `654047456665`
- Region: `ca-central-1`
- CloudFormation stack: `souvenote-production`
- Stack state: `UPDATE_COMPLETE`
- Termination protection: enabled
- Release tag: `production-20260726T171358Z-6b0618a4`
- Source archive SHA-256:
  `6B0618A4C61F14E3E230D3231EC320DB4EE2DAAD39C87358D72C727DB3962900`
- Monitoring template SHA-256:
  `F6AEBADFED101880F894AE56345165A054F6BFCF9E6C218890A294B517BDCB21`
- Monitoring change set:
  `souvenote-production-monitoring-parity-20260725` (nine additions, zero
  replacements)
- ECS service: desired 2, running 2, pending 0
- ECS deployment: completed and at steady state
- Database migrations: applied from the same immutable release
- Custom domain parameter: empty
- CloudFront aliases: none
- CloudFront certificate: AWS default certificate
- The `www.souvenote.com` ACM certificate is issued in `us-east-1`, but it is
  deliberately not attached to this distribution.

The deployment workflow verifies the source archive, creates unique immutable
frontend, backend, and migration tags, applies migrations before service
rollout, waits for ECS stability, and then verifies the public health endpoint.

## Homepage scroll remediation

The production preview includes the homepage scroll-position fix. The gallery
carousel now scrolls only its horizontal track instead of calling
document-level `scrollIntoView`, and non-anchor homepage loads temporarily
disable browser scroll restoration while returning the page to the hero.
Explicit URL anchors remain unaffected.

Verification was completed against the built local application, the deployed
staging CloudFront URL, and the production CloudFront URL:

- a fresh homepage visit loaded at vertical position `0`;
- reloading after scrolling to vertical position `900` returned to `0`;
- navigating away from a scrolled homepage and using browser Back returned to
  `0`; and
- the gallery Next control changed track `scrollLeft` from `0` to `284`
  without changing the document's vertical position.

## Authentication-flow remediation

The email signup and login experience now separates new and returning users.
Successful new-account creation routes to `/first-login`, which displays
first-time copy and preserves the newly entered email address. The normal
`/login` route retains the returning-user copy ("Pick up where you left off").
Existing-account responses from the signup API also route to the returning
login rather than the first-time screen.

The signup, returning-login, and first-login layouts now share one balanced
desktop frame. They were verified against the deployed staging and production
CloudFront URLs at a `1280x720` browser viewport:

- `/signup`: `820x540` card, positioned from `y=55` to `y=595`;
- `/login`: `820x540` card, positioned from `y=55` to `y=595`; and
- `/first-login`: `820x540` card, positioned from `y=55` to `y=595`.

All three screens use identical outer-frame dimensions and fit without
vertical page overflow, including their top-level navigation and footer
content. The complete inner composition is centered with matching `22.8px`
top and bottom insets and matching `28.8px` left and right insets. The
`720px` form panel is centered with exactly `50px` from each outer side
border.

## Secondary authentication-card remediation

The remaining login-style account screens now use the same compact,
content-hugging frame treatment. The shared update covers `/forgot`, `/reset`,
`/verify`, `/verify/expired`, and `/recover`. At the `1280x720` acceptance
viewport, each route has a centered `680px` card, `28px` of padding on every
side, and no document-level vertical overflow:

- `/forgot`: `680x358` card;
- `/reset`: `680x485` card;
- `/verify`: `680x292` card;
- `/verify/expired`: `680x325` card; and
- `/recover`: `680x333` card.

All five cards begin at `y=55`, and their documents remain exactly `720px`
high. These exact measurements matched the built local application, staging
CloudFront deployment, and production CloudFront deployment. The reset form
uses two equal `305px` columns at desktop width and collapses to one column on
small screens. The distinct `/welcome` modal was audited separately and
deliberately left unchanged because its existing `820px` composition is
already balanced and does not use the secondary authentication-card component.

## Live safeguards

- RDS PostgreSQL 16.9 is available, encrypted, private, and protected from
  deletion.
- RDS uses `db.t4g.small`, Multi-AZ, 20 GB storage, and 14-day automated
  backups.
- The Application Load Balancer is protected from deletion and drops invalid
  HTTP headers.
- Production application and build logs are retained for 30 days.
- Eleven production CloudWatch alarms cover load-balancer and target 5xx
  responses, frontend and backend target health, ECS task count, ECS CPU and
  memory, RDS CPU, RDS storage, RDS connections, and structured backend-error
  logs. All eleven were in `OK` state at the final audit.
- A CloudWatch Logs metric filter publishes structured backend errors to
  `Souvenote/Observability / BackendErrorCount`, and a saved Logs Insights
  query provides a production backend-error view.
- The production SNS alarm topic email subscription for
  `cameron@souvenote.com` is confirmed.
- A controlled test moved `souvenote-production-backend-error-log` to `ALARM`
  and then restored it to `OK`. CloudWatch history recorded successful
  execution of the production SNS action at `2026-07-25T22:03:36Z` and
  `2026-07-25T22:04:04Z`.

## Backup restore drill

The automated snapshot
`rds:souvenote-production-2026-07-25-13-16` was restored into the isolated
target `souvenote-production-restore-drill-20260725`.

The restored target reached `available` and was verified as:

- PostgreSQL 16.9
- `db.t4g.micro`
- 20 GB
- encrypted
- not publicly accessible
- placed in the production database subnet group and security group
- tagged `Purpose=restore-drill`

The exact temporary target was then deleted without a final snapshot. The
original automated production snapshot was retained, and a final
`DBInstanceNotFound` check confirmed cleanup.

## Provider and traffic posture

Because no custom domain is configured, the stack sets
`PRODUCTION_PREVIEW_MODE=true`. The deployed backend therefore permits this
AWS-only preview configuration:

- generation: mock
- checkout and payment: mock
- fulfillment and physical mail: mock
- notifications and transactional email: mock
- analytics: disabled
- third-party error reporting: disabled
- operational provider alerts: disabled

The preview gate is deliberately tied to the absence of a custom domain. If a
custom domain is supplied, preview mode turns off and the backend rejects
disabled or mock production integrations. This prevents an accidental
customer-facing launch with placeholder providers.

## Verification

### Local release gates

- Backend lint: pass
- Backend unit tests: 45 suites, 247 tests
- Backend end-to-end tests: 2 suites, 22 tests
- Backend production build: pass
- Frontend unit tests: 8 files, 33 tests
- Frontend strict typecheck: pass
- Frontend production build: pass
- Built frontend route sweep: 34 expected routes returned `200`; the one
  intentional missing route returned `404`

### Live production smoke

- Thirty-four public routes completed without a smoke-test failure.
- `/api/health`, `/api/health/live`, and `/api/health/ready` returned `200`.
- `/api/retention-policy` returned `200`.
- `/api/docs`, `/api/docs-json`, and `/api/docs-yaml` returned `404`.
- A protected draft endpoint returned `401` without a token.
- HSTS, MIME sniffing prevention, frame denial, referrer policy, and
  permissions policy headers were present.
- `X-Powered-By` was absent.
- CORS allowed the production CloudFront origin and did not allow an unrelated
  origin.
- Browser testing loaded the landing and create experiences, accepted a
  synthetic description, and reached the account-required boundary.
- No real external provider was contacted.

## Cost controls

- The account-wide Souvenote project budget remains USD 400.
- The production budget is USD 225 and is filtered to
  `Environment=production`, excluding credits and refunds.
- Production budget notifications: actual spend at 25%, 50%, 80%, and 100%;
  forecast spend at 80%.
- `Project` and `Environment` cost-allocation tags are active.
- July 1-25 gross AWS usage was approximately USD 14.92 and was offset by an
  approximately equal AWS credit at the time of the audit.
- The saved staging calculator estimate is USD 67.67 per month. Scaling that
  known estimate for two production tasks, a Multi-AZ `db.t4g.small` database,
  one additional public IPv4 address, and longer production retention gives an
  approximate production baseline of USD 135-145 per month. The practical
  combined staging-plus-production expectation is approximately USD 210-230
  per month at low traffic, leaving headroom under the USD 400 project
  guardrail.

Budgets are alerts, not hard caps. Cost and usage data can be delayed, credits
do not guarantee that every AWS charge is eligible, and AWS cannot guarantee
that the payment card will never be charged.

## Deployment issues resolved

1. The first application rollout failed closed because mock and disabled
   providers were correctly rejected under `NODE_ENV=production`. The stack
   rolled back safely. The explicit no-custom-domain preview gate was then
   added with unit tests.
2. The next build attempted to reuse an ECR tag in immutable repositories. The
   workflow was corrected to derive a unique release tag from timestamp and
   verified source hash.
3. The corrected release built, migrated, deployed, stabilized, and passed all
   public health and smoke checks.

## Remaining launch gates

1. Complete legal review of the retention policy and approve destructive
   retention-job dry runs before enabling enforcement.
2. Configure and separately verify production credentials, webhooks,
   idempotency, reconciliation, and spend controls for generation, Stripe,
   Scribeless, SendGrid, analytics, and error reporting.
3. Complete accessibility, supported-browser, real-device, load, penetration,
   and disaster-recovery acceptance.
4. Obtain explicit launch approval before adding a CloudFront alias, attaching
   the custom certificate, or changing any `souvenote.com` DNS record.
