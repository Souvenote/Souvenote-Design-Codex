# Code review checklist

Use this checklist before marking any PR complete.

## Product and scope

- The change matches the MVP specification and decision register.
- Inactive features remain non-transactional and do not simulate success.
- Visual changes are intentional and have responsive screenshot evidence.
- No unrelated behavior was expanded or removed.

## Architecture and maintainability

- Dependencies follow `docs/engineering/architecture.md`.
- Controllers are thin; SQL is confined to repositories; provider SDKs are confined to adapters.
- Server state is not duplicated in Zustand, React state, or local storage.
- New modules have focused responsibilities and descriptive names.
- Existing oversized files did not grow without extracting behavior.
- New `any`, `@ts-ignore`, hidden fallbacks, dead code, and debug globals are absent.

Review triggers, not blind limits:

- Function over about 50 lines.
- New module over about 400 lines.
- More than three levels of nested control flow.
- Cyclomatic complexity above 10.
- Duplicate business rules across web and API.

## Security and privacy

- Authentication and ownership are enforced server-side.
- Customer input cannot set authoritative identity, money, credit, tax, payment, or lifecycle state.
- Secrets, tokens, card data, private URLs, prompts, messages, recipient names, and uploaded-photo references are absent from logs/analytics.
- Uploads and webhooks are verified before business processing.
- Rate, payload, and retry limits are defined where abuse or cost is possible.

## Money, credits, and external work

- Money uses integer minor units and ISO currency.
- Credit/payment/order/fulfillment changes are transactional and idempotent.
- External calls do not occur inside database transactions.
- Retry and duplicate delivery tests exist.
- Provider failures produce the correct terminal state and refund exactly once.
- No unapproved cost-incurring resource or traffic was enabled.

## Verification

- Relevant tests cover success, failure, authorization, ownership, concurrency, retry, and idempotency.
- Type check, lint check, tests, production build, and applicable audits pass.
- Migrations run from a clean database and preserve supported existing data.
- Public contracts and decisions are updated.
- Final diff contains no unrelated or generated noise.
