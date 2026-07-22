# Souvenote worker

This package is the separately deployable NestJS worker process. In Section 1 it
is intentionally an **idle scaffold**: it does not consume queues, execute jobs,
or import provider SDKs.

The only HTTP endpoints are operational health checks:

- `GET /health/live` confirms that the process is running.
- `GET /health/ready` performs `SELECT 1` against the configured PostgreSQL
  database and returns `503` with a sanitized response when it cannot connect.

Local startup must use `AUTH_MODE=disabled`, `WORKER_MODE=idle`, and provider
modes set to `mock` or `disabled`. Any live provider-mode value stops startup.
The repository-level development supervisor supplies this safe profile.

No migrations or seed operations run when the worker starts.
