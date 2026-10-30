#!/bin/sh
# Run the repository's local validation suite.
# Usage: sh scripts/check.sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

fail() {
  printf 'check: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_command docker
require_command git
require_command node
require_command rg

docker compose version >/dev/null 2>&1 || fail 'Docker Compose is required'

printf '%s\n' 'Checking shell syntax...'
sh -n relay/entrypoint.sh

printf '%s\n' 'Checking Node.js syntax...'
node --check relay/check/check.mjs
node --check relay/check/control.mjs

printf '%s\n' 'Running entrypoint regression tests...'
sh relay/test/entrypoint.sh

printf '%s\n' 'Validating Compose files...'
RELAY_HOSTNAME=ci.example.test \
ACME_CONTACT=ci@example.test \
RELAY_ACCESS_MODE=shared_token \
RELAY_ACCESS_TOKENS=ci-token-abcdefghijklmnopqrstuvwxyz123456 \
  docker compose -f relay/docker-compose.yml config -q

RELAY_HOSTNAME=ci.example.test \
ACME_CONTACT=ci@example.test \
RELAY_ACCESS_MODE=shared_token \
RELAY_ACCESS_TOKENS=ci-token-abcdefghijklmnopqrstuvwxyz123456 \
  docker compose -f relay/docker-compose.dokploy.yml config -q

printf '%s\n' 'Checking repository hygiene...'
git diff --check
git check-ignore -q relay-certs.tgz || fail 'relay-certs.tgz is not ignored'
grep -Fx 'RELAY_ACCESS_TOKENS=REPLACE_ME' relay/.env.example >/dev/null \
  || fail 'relay/.env.example must use the public placeholder'

if git ls-files | grep -Eq '(^|/)([^/]*\.(pem|key|crt)|relay-certs\.tgz)$'; then
  fail 'a certificate, key, or certificate backup is tracked by Git'
fi

for sensitive_path in .env relay/.env relay-certs.tgz; do
  if git ls-files --error-unmatch "$sensitive_path" >/dev/null 2>&1; then
    fail "$sensitive_path is tracked by Git"
  fi
done

if rg -n -i 'private Git repo' README.md relay docs SECURITY.md >/dev/null 2>&1; then
  fail 'documentation still refers to a private Git repo'
fi

grep -F 'https://na1.relay.gyblos.com/' docs/status.md >/dev/null \
  || fail 'docs/status.md must declare na1'
grep -F 'https://na2.relay.gyblos.com/' docs/status.md >/dev/null \
  || fail 'docs/status.md must declare na2'

printf '%s\n' 'All repository checks passed.'
