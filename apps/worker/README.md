# Souvenote worker

This package is the separately deployable NestJS worker process. Its normal local
profile remains idle: it does not consume queues, execute provider jobs, or import
provider SDKs.

The only HTTP endpoints are operational health checks:

- `GET /health/live` confirms that the process is running.
- `GET /health/ready` performs `SELECT 1` against the configured PostgreSQL
  database and returns `503` with a sanitized response when it cannot connect.

Local startup must use `AUTH_MODE=disabled` and provider modes set to `mock` or
`disabled`. Any live provider-mode value stops startup. The repository-level
development supervisor supplies an idle safe profile.

Section 3 adds one deterministic database schedule for expired mock Try Risk-Free
authorizations. It remains disabled by default and can run only in
development/test with `WORKER_MODE=schedules`, `PAYMENT_PROVIDER_MODE=mock`, and
`TRY_RISK_FREE_RESOLVER_ENABLED=true`. The repository calls the database-owned
exactly-once resolver; it does not call Stripe or any paid service.

No migrations or seed operations run when the worker starts.
