#!/usr/bin/env bash
set -euo pipefail

ORIGIN="${1:?Usage: smoke-staging.sh https://staging-origin}"
[[ "$ORIGIN" =~ ^https://[a-z0-9.-]+$ ]]

expect_status() {
  local expected="$1"
  local path="$2"
  local actual
  actual="$(curl --silent --show-error --output /tmp/souvenote-smoke-body --write-out '%{http_code}' "$ORIGIN$path")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected $expected from $path, received $actual" >&2
    exit 1
  fi
}

expect_status 200 /
expect_status 200 /api/health
expect_status 200 /api/v1/health/live
expect_status 200 /api/v1/health/ready
expect_status 200 /api/v1/pricing
expect_status 401 /api/v1/me
expect_status 401 /api/v1/capabilities

HEADERS="$(curl --silent --show-error --head "$ORIGIN/")"
grep -qi '^x-content-type-options: nosniff' <<<"$HEADERS"
grep -qi '^x-frame-options:' <<<"$HEADERS"
grep -qi '^referrer-policy:' <<<"$HEADERS"

echo 'Staging public health, pricing, authentication boundary, and security-header smoke passed.'
