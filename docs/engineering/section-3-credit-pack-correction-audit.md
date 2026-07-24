# Section 3 standalone credit-pack correction audit

Audited: 2026-07-23

Branch: `codex/section-3-standalone-credit-packs`

Base: `140145ae4aef6536678aee29828e96d063a0b677`

Status: implementation and local acceptance complete. Production payment collection
remains disabled until the Section 5 Stripe gate.

## Scope and authority

Approved decision `MVP-022` corrects the earlier interpretation that the three
standalone credit packs were placeholders. They are real, repeat-purchasable MVP
products:

| Credits | Price   | Market |
| ------- | ------- | ------ |
| 10      | CAD $2  | Canada |
| 80      | CAD $10 | Canada |
| 250     | CAD $25 | Canada |

Every newly provisioned account also receives two free trial credits exactly once.
Section 3 owns the catalog and deterministic local/test purchase and ledger state.
Section 5 owns Stripe-hosted collection and production activation.

## Acceptance matrix

| Requirement                      | Result | Evidence                                                                                                                                                                                                                                                    |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact standalone catalog         | Pass   | Additive migration `0003_standalone_credit_packs.sql` seeds the exact 10/200, 80/1000, and 250/2500 CAD minor-unit pairs in the active Canada price book.                                                                                                   |
| Real repeat-purchasable products | Pass   | Authenticated users may create multiple captured purchases with distinct idempotency keys. Browser acceptance bought the 10-credit pack twice, moving the trial balance from 2 to 12 to 22.                                                                 |
| Two-credit signup trial          | Pass   | Existing atomic signup provisioning remains authoritative. Browser acceptance showed 2 credits immediately after local signup; the disposable database recorded one `signup_grant` of +2.                                                                   |
| Server-owned money and quantity  | Pass   | The API selects an active CA/CAD offer. A database trigger overwrites caller-supplied currency, amount, and quantity with the catalog snapshot. SQL coverage attempts USD/1/999 and proves CAD/200/10 is stored.                                            |
| Exactly-once grants              | Pass   | Purchase creation uses a per-user/idempotency advisory lock, durable request hash, unique database key, one captured-purchase source, and the existing atomic credit-ledger function. Eight concurrent same-key requests return one purchase and one grant. |
| Reused-key conflict              | Pass   | Reusing an idempotency key with a different offer is rejected with `IDEMPOTENCY_KEY_REUSED`. Distinct keys permit repeat purchases.                                                                                                                         |
| Ownership                        | Pass   | Purchase reads require the authenticated owner; a second user receives not found.                                                                                                                                                                           |
| Safe provider boundary           | Pass   | Mock capture is allowed only in development/test with `PAYMENT_PROVIDER_MODE=mock`. Production or a disabled provider fails closed. No external provider call exists in this correction.                                                                    |
| Production activation off        | Pass   | All catalog `checkoutEnabled` values and `payments.credit_packs.production` remain false. Real Stripe collection is deferred to Section 5.                                                                                                                  |
| Public contract                  | Pass   | Pricing now returns a separate `creditPacks` collection. Authenticated mock purchase and owner-scoped read routes are generated in OpenAPI with bearer and idempotency requirements.                                                                        |
| Customer experience              | Pass   | Pricing and the creation modal use the backend catalog, show the exact CAD packs, explain the two free trial credits, and keep each purchase button available after success.                                                                                |
| CSRF boundary                    | Pass   | The BFF accepts a legitimate local same-origin mutation when Next.js reports an internal `localhost` URL but the validated browser Host/Origin is `127.0.0.1`; cross-site requests remain rejected.                                                         |

## Database and concurrency evidence

The disposable PostgreSQL/API gate verifies:

- clean application and repeat no-op of migrations 0001 through 0003;
- migration checksum and journal tamper rejection;
- all three exact catalog rows with production checkout disabled;
- server-owned offer snapshots at insert time;
- one grant under eight concurrent same-key purchase requests;
- conflict when one key is reused for different input;
- two independent captured purchases and a final balance of 92 after buying 10
  and 80 credits from the initial two-credit trial balance;
- owner isolation and invalid-offer rejection.

The migration checksum is
`7a4de59c73051f7d08e86874ee136dfe88ef05a56c3c2d2dd658f861cb8295c3`.
Applied migrations 0001 and 0002 were not edited.

## Browser acceptance

The web and API were run with Node 22.22.0 against a fresh disposable PostgreSQL
16 database. All paid providers were disabled or mocked.

Browser inspection verified:

- public pricing showed 10 credits for `$2.00 CAD`, 80 for `$10.00 CAD`, and 250
  for `$25.00 CAD`;
- signup visibly granted `2 CREDITS`;
- the first local mock 10-credit purchase reported a balance of 12;
- the same enabled button permitted another purchase and reported a balance of 22;
- a 390 by 844 mobile viewport presented the trial explanation, exact price,
  purchase action, and success state without layout loss;
- browser console warnings and errors were empty.

The disposable database independently contained one +2 signup ledger row, two +10
purchase ledger rows, two captured CAD $2 purchase snapshots, and balance 22. The
owned app processes and disposable container were removed afterward. The normal
local named database volume was preserved.

## Verification evidence

| Gate                     | Result                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Toolchain                | Node 22.22.0 and npm 10.9.8 recognized as canonical.                                                                                                                     |
| Aggregate quality        | Contract drift, formatting, lint, type checks, 20 script tests, 35 API tests, 13 web tests, 10 worker tests, all workspace builds, and production dependency audit pass. |
| Database/API integration | `npm run test:database` passes clean/repeat/tamper migration verification, three SQL suites, API concurrency/ownership coverage, and disposable-container cleanup.       |
| Browser/runtime          | Desktop and mobile pricing, signup +2, repeat +10 purchases, balance publication, and console inspection pass.                                                           |
| Source scan              | Active credit-pack surfaces contain no disabled/Coming soon pack copy, USD launch price, or client-owned pack price.                                                     |

## Security, privacy, and cost

- Authentication and owner scoping remain default-deny.
- Money and credit quantities use integer minor units and server/database authority.
- The browser never submits a price, currency, balance, captured state, or granted
  quantity.
- No raw card fields, payment credentials, customer content, or private customer
  data were added to logs or analytics.
- No AWS, Stripe, paid-provider, email, analytics, error-reporting, deployment, or
  shared-environment action occurred.
- External-service cost: CAD $0 / USD $0.

## Deferred behavior and risks

- Section 5 must replace the local/test mock purchase route with an approved
  Stripe-hosted checkout and verified webhook-driven capture before production
  activation.
- Legal, tax, refund, and payment reconciliation review remain part of the Section
  5 gate.
- The correction does not change the approved Try Risk-Free or Big Sender terms.
- The pre-existing normal local database volume remains intentionally untouched;
  disposable databases are the clean verification authority.
