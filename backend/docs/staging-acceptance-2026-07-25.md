# Souvenote Staging Acceptance — 2026-07-25

## Scope

- Environment: `souvenote-staging-v2`
- Region: `ca-central-1`
- Frontend/API: `https://d2lbqxot54qnt4.cloudfront.net`
- Test window: `2026-07-25T14:08:09Z` to `2026-07-25T19:20:01Z`
- Provider posture: generation, checkout, fulfillment, and notifications
  remained mocked; analytics, error reporting, and operational alerts remained
  disabled.
- Production DNS and the Google-hosted `www.souvenote.com` site were not
  changed.
- The existing staging infrastructure was reused. No new AWS services were
  added during the remediation deployments.

This record intentionally excludes email addresses, Cognito tokens, test
passwords, customer content, postal addresses, signed URLs, and secrets.

## Results summary

| Area | Result | Evidence |
| --- | --- | --- |
| Public routes | Pass | Key landing, authentication, pricing, help, legal, create, and cart routes returned `200`; Community Cards remained the intentional `404`. |
| Health | Pass | `/api/health`, `/api/health/live`, and `/api/health/ready` returned `200` after the final deployment. |
| API documentation exposure | Pass | `/api/docs`, `/api/docs-json`, and `/api/docs-yaml` returned `404`. |
| CORS | Pass | The staging origin received an allow-origin response; an unrelated origin did not. |
| Authentication boundary | Pass | Protected API routes returned `401` without a valid token; a verified isolated Cognito staging account completed an authenticated journey. |
| Cross-user ownership isolation | Pass | A second verified Cognito staging account could not read or mutate the first account's draft, assets, order, checkout, generation, or fulfillment resources. Foreign owner reads returned `404`; the draft-assets collection returned an empty list without disclosing the owner. |
| Logout and session restoration | Pass | Sign-out returned to the public signed-out state. A fresh login restored the authenticated create page, and a browser reload retained the Cognito session. |
| Password-reset initiation privacy | Pass | Cognito-backed reset initiation returned the same generic response for a nonexistent address and an eligible isolated test account. The deployed confirmation form requires email, one-time code, and a policy-compliant new password. |
| Password-reset rejection safety | Pass | With a fresh Cognito reset challenge, an incorrect code produced “did not match”; an expired/no-longer-active challenge produced “expired.” The rejected candidate password could not log in, proving the failed confirmation did not change the account password. |
| Password-reset confirmation | Pass | Cognito accepted the mailbox-delivered one-time code, the app displayed reset completion, the new credential logged in to `/create`, a reload retained the authenticated session, and sign-out returned to the public state. A direct comparison against the pre-reset password was not available because that ephemeral test secret was lost when the CloudShell environment recycled. |
| Password-reset test cleanup | Pass | The isolated reset-test account was deleted from Cognito and the staging database after verification. Its single starter-credit row was removed by cascade; it had zero drafts, assets, and orders. |
| Retention policy publication | Pass | Public `GET /api/retention-policy` returned the canonical version `2026-07-25`, status `staging_baseline_pending_legal_review`, and all ten schedule entries. |
| Destructive retention enforcement | Intentionally disabled | Automated purge/redaction jobs remain disabled until legal review and approval of dry-run evidence; staging must not imply that unenforced deletion is already automatic. |
| Public-card failure privacy | Pass | An invalid public token returned a generic unavailable experience without exposing whether a card exists. |
| Unauthenticated creation funnel | Pass | A user can complete the free description step and is stopped by an account-required dialog before saving or spending credits. |
| Mobile overflow | Pass | Landing and signup pages had no document-level horizontal overflow at a `390 × 844` viewport. |
| Frontend HTTP security | Pass | HSTS, nosniff, frame denial, referrer policy, and permissions policy were present; `X-Powered-By` was absent. |
| Backend unit tests | Pass | 45 suites, 244 tests. |
| Backend end-to-end tests | Pass | 2 suites, 22 tests. |
| Backend lint/build | Pass | ESLint and the Nest production build completed successfully. |
| Frontend unit tests | Pass | 5 files, 27 tests. |
| Frontend typecheck/build | Pass | Strict TypeScript check and optimized Next.js build completed successfully. |
| Built frontend route sweep | Pass | 33 expected routes returned `200`; one intentional route returned `404`; required frontend security headers passed. |
| Authenticated mock journey | Pass | Login, initial credits, persisted draft, mock image/song/message generation, asset approval, delivery validation, mock checkout, mock payment, mock fulfillment, and the owner-scoped confirmation page completed. |
| External provider isolation | Pass | Confirmation explicitly reported that fulfillment completed locally without contacting an external print service. Stripe, Scribeless, Fal, and SendGrid were not called. |
| Credentialed real-provider gate | Not run | Real-provider staging credentials/resources are not configured. Mock success is not evidence that prompt fidelity, payment, print, mail, email, analytics, or error-reporting integrations work. |

## Deployed route smoke

Initial public smoke was observed at `2026-07-25T14:08:09Z`. The successful
password-reset, login, reload, sign-out, and isolated-account cleanup checks
completed by `2026-07-25T19:20:01Z`; the deployed service remained healthy.

- `200`: `/`, `/signup`, `/login`, `/forgot`, `/pricing`, `/faq`,
  `/contact`, `/legal/privacy-policy`, `/legal/terms-of-service`, `/create`,
  `/cart`, `/api/health`, `/api/health/live`, `/api/health/ready`, and
  `/api/pricing`
- `200`, public canonical policy:
  `/api/retention-policy` returned version `2026-07-25`, jurisdiction
  `British Columbia, Canada`, and ten versioned schedule entries.
- `404` as designed: `/api/docs`, `/api/docs-json`, `/api/docs-yaml`, and
  `/community-cards`
- Protected routes returned `401` without a valid ID token, including
  `/api/auth/me`, `/api/credits/balance`, `/api/card-drafts`, `/api/orders`,
  the mock-credit mutation, and the operations evidence endpoint.

## Authenticated journey evidence

- A synthetic, verified Cognito staging account was used. Its identifier and
  password are intentionally excluded from this report.
- The account received two staging starter credits. Mock image and song
  generation consumed the credits and the balance reached zero as expected.
- Draft `d0d756ff-1688-44ad-a36d-6784e7325383` persisted and resumed across
  the journey.
- Recipient and required return-address fields began blank after remediation;
  no seeded names or postal addresses remained.
- Order `ae2ca6cb-eeeb-493e-be73-b3b36049015d` completed mock checkout and
  mock payment.
- At `2026-07-25T16:09:09Z`, the final owner-scoped fulfillment refresh
  returned `201` in 27 ms with request ID
  `24608e75-afc6-41b1-bbba-5c400933d236`.
- At `2026-07-25T16:09:24Z`, the owner-scoped fulfillment record read returned
  `200` in 8 ms.
- The confirmation page reported order status `fulfilled_mock`, provider status
  `fulfilled_mock`, and stated that no external print service was contacted.

The mock generator returns fixed demonstration content. This verifies state,
credit, approval, persistence, checkout, and fulfillment plumbing only; it
does not verify that a real generation provider follows the user's prompt.

## Isolation, session, reset, and retention follow-up

- A second synthetic verified Cognito user began with zero drafts and zero
  orders. Requests for the first user's draft, order, and fulfillment record
  returned `404`; the draft-assets collection returned `200` with zero assets.
- Foreign upload, generation, checkout, and fulfillment mutations were
  rejected with `404`. No first-user content or state was changed.
- Sign-out removed the authenticated navigation and returned to the public
  landing state. Fresh login and a subsequent page reload restored and
  retained the expected authenticated account state.
- The old client-only password-reset placeholder was replaced with Cognito
  `forgotPassword` and `confirmPassword`. Reset initiation is
  account-enumeration safe. A fresh wrong code and an expired challenge
  produced distinct, accurate messages, and the rejected candidate password
  could not authenticate afterward. Cognito accepted the mailbox-delivered
  one-time code, the replacement credential logged in successfully, reload
  retained the session, and sign-out returned to the public state. A direct
  old-password comparison was not performed because the ephemeral pre-reset
  test secret was lost when the CloudShell environment recycled.
- After the reset checks, the exact isolated reset-test account was permanently
  removed from Cognito and the staging database. The deletion cascaded its one
  starter-credit row; read-only inspection confirmed that it had no drafts,
  assets, or orders. No customer account or content was in scope.
- The backend now publishes a machine-readable retention policy at
  `GET /api/retention-policy`. Customer-facing legal copy uses the same
  one-day, 30-day, 90-day, 180-day, one-year, six-year, and 35-day backup
  propagation windows.
- Automatic destructive purge and redaction jobs are not enabled. The policy
  is a staging baseline pending Canadian/BC legal review, retention dry-run
  evidence, legal-hold controls, and an approved account-deletion workflow.

## Acceptance defects and resolutions

### STG-001 — Unavailable social providers were advertised

**Resolution:** Remediated and live verified.

Social controls now render only for providers explicitly configured through
`NEXT_PUBLIC_COGNITO_SOCIAL_PROVIDERS`. Staging advertises none because its
Cognito client currently supports only native Cognito sign-in.

### STG-002 — Frontend security headers were incomplete

**Resolution:** Remediated and live verified.

The frontend now disables the Next.js powered-by header and returns HSTS,
`X-Content-Type-Options`, `X-Frame-Options`, referrer policy, and permissions
policy headers. Automated route smoke asserts the contract.

### STG-003 — Signup preference controls did not persist

**Resolution:** Remediated and live verified.

Birthday, country, and marketing controls were removed from signup because the
signup contract did not persist them. Marketing remains opt-in in the
server-backed account form.

### STG-004 — Marketing and terms consent started checked

**Resolution:** Remediated and live verified.

Terms consent now begins unchecked. The discarded signup marketing control was
removed, and the account marketing preference defaults to false.

### STG-005 — “Remember me” did not change session behavior

**Resolution:** Remediated and live verified.

The nonfunctional checkbox and unsupported 30-day session claim were removed.

### STG-006 — Saved-card retention copy conflicted

**Resolution:** Canonical staging policy implemented, deployed, and live
verified; enforcement and legal approval remain production gates.

Unsupported 30-day/12-month promises and the fabricated client-only countdown
were removed. The server now publishes a versioned canonical schedule and the
legal/product copy matches it. Destructive enforcement remains disabled until
legal review and approval of retention-job dry runs.

### STG-012 — Password reset was a client-only placeholder

**Resolution:** Remediated, deployed, and live verified for initiation privacy,
invalid and expired codes, successful mailbox-code confirmation, new-credential
login, session reload, sign-out, and isolated test-account cleanup.

Forgot-password previously displayed a success state without contacting
Cognito, while the reset button did nothing. The UI now invokes Cognito's
forgot-password and confirm-password operations, enforces the pool's password
policy, clears local auth state after confirmation, and avoids account
enumeration.

### STG-013 — Account recovery showed a fabricated countdown

**Resolution:** Remediated and deployed.

The recovery page no longer claims that a particular account has three days
remaining or exposes nonfunctional restore/finalize-deletion controls. It
accurately identifies self-service recovery as a production prerequisite and
routes the user to support.

### STG-007 — Unauthenticated `/home` navigation was inconsistent

**Resolution:** Remediated and live verified.

Signed-out `/home` visits now redirect to login with a return path, and the
authenticated hero CTA targets `/create`.

### STG-008 — Delivery displayed seeded personal names and addresses

**Resolution:** Remediated and live verified.

All recipient and return-address fallbacks were removed. Both address sections
begin blank, return address is visibly required, and validation blocks checkout
until required fields are supplied.

### STG-009 — Mock checkout failed with PostgreSQL parameter type `42P08`

**Resolution:** Remediated, regression-tested, deployed, and live verified.

`OrdersService.updateOrder` reused a status parameter as both `text` and
`character varying`. Explicit `::text` casts removed the ambiguity. Mock
checkout subsequently returned `201`, and mock payment completed.

### STG-010 — Mock fulfillment failed with PostgreSQL parameter type `42P08`

**Resolution:** Remediated, regression-tested, deployed, and live verified.

Fulfillment completion, failure, and reconciliation queries now cast reused
status parameters explicitly. The original failure was traced by support
request ID `d1ba79e3-0ac4-4e91-b039-51c78a505ed4`.

### STG-011 — Interrupted mock fulfillment could not resume

**Resolution:** Remediated, regression-tested, deployed, and live verified.

An interrupted local mock attempt remained in `submitting`. Mock-only recovery
now safely reuses the existing attempt and deterministic provider identifiers
when the visible refresh action is used. Real-provider ambiguous outcomes
retain the stricter no-replay/hold behavior to prevent duplicate physical mail.

## Remaining production gates

1. Obtain Canadian/BC legal review of policy version `2026-07-25`, implement
   idempotent dry-run retention jobs, approve dry-run evidence, and only then
   enable destructive purge/redaction enforcement.
2. Configure and test each real provider separately with approved staging
   credentials, test-mode billing where available, spending alarms, and a
   reviewed rollback plan.
3. Add operational alerting/error reporting and exercise payment,
   reconciliation, fulfillment-hold, notification, and provider-timeout paths.
4. Perform accessibility, cross-browser, mobile-device, load, backup/restore,
   and security review gates.
5. Obtain explicit approval before any production deployment, real-provider
   activation, or DNS change for `www.souvenote.com`.

## Acceptance decision

The AWS staging environment is accepted for continued mock-mode product
testing. It is not yet accepted for production traffic or real customer
payments, generation, email, printing, or mailing.
