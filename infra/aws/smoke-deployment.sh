#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"
if [[ ! "$BASE_URL" =~ ^https://[^/]+/?$ ]]; then
  echo "Usage: $0 https://deployment-host" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

BODY_FILE="$(mktemp)"
HEADER_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE" "$HEADER_FILE"' EXIT

status_for() {
  local path="$1"
  shift
  curl --silent --show-error \
    --output "$BODY_FILE" \
    --dump-header "$HEADER_FILE" \
    --write-out '%{http_code}' \
    "$@" \
    "$BASE_URL$path"
}

expect_status() {
  local path="$1"
  local expected="$2"
  shift 2
  local actual
  actual="$(status_for "$path" "$@")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Smoke check failed: $path returned $actual, expected $expected." >&2
    sed -n '1,12p' "$BODY_FILE" >&2
    exit 1
  fi
  echo "PASS $expected $path"
}

for path in \
  / \
  /gift \
  /gift/redeem \
  /refer \
  /r/not-a-real-referral; do
  expect_status "$path" 200
done

for path in /api/health /api/health/live /api/health/ready; do
  expect_status "$path" 200
done

for path in \
  /api/gifts \
  /api/referrals/me \
  /api/card-entitlements/balance; do
  expect_status "$path" 401
done

for path in \
  /api/gifts/claim/not-a-real-gift \
  /api/referrals/claim/not-a-real-referral; do
  expect_status "$path" 404
done

expect_status /api/health 200 --header "Origin: $BASE_URL"
if ! grep -Fqi "access-control-allow-origin: $BASE_URL" "$HEADER_FILE"; then
  echo "Smoke check failed: the deployment origin was not allowed by CORS." >&2
  exit 1
fi
echo "PASS deployment-origin CORS"

expect_status /api/health 200 --header 'Origin: https://untrusted.invalid'
if grep -Fqi 'access-control-allow-origin:' "$HEADER_FILE"; then
  echo "Smoke check failed: an unrelated origin received a CORS allow header." >&2
  exit 1
fi
echo "PASS unrelated-origin CORS denial"

expect_status /api/health 200
for required_header in \
  'content-security-policy:' \
  'referrer-policy:' \
  'x-content-type-options: nosniff'; do
  if ! grep -Fqi "$required_header" "$HEADER_FILE"; then
    echo "Smoke check failed: missing security header $required_header" >&2
    exit 1
  fi
done
echo "PASS security headers"

echo "Deployment smoke checks passed for $BASE_URL"
