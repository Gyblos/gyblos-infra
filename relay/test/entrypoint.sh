#!/bin/sh
# Local regression checks for relay/entrypoint.sh.
# Run from the repository root with: sh relay/test/entrypoint.sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
ENTRYPOINT="$REPO_ROOT/relay/entrypoint.sh"
TEMPLATE="$REPO_ROOT/relay/config.toml"
TEST_TMP_DIR=$(mktemp -d)

fail() {
  echo "entrypoint-test: $*" >&2
  exit 1
}

run_render() {
  RELAY_CONFIG_TEMPLATE="$TEMPLATE" RELAY_CONFIG_OUT="$TEST_TMP_DIR/$1.toml" RELAY_HOSTNAME=na1.relay.gyblos.com ACME_CONTACT=ops@example.com RELAY_ACCESS_MODE=shared_token RELAY_ACCESS_TOKENS="$2" RENDER_ONLY=1 "$ENTRYPOINT" > "$TEST_TMP_DIR/$1.out"
}

TOKEN=abcdefghijklmnopqrstuvwxyz123456
run_render valid "$TOKEN"
grep -Fq 'shared_token = ["<redacted>"]' "$TEST_TMP_DIR/valid.out" || fail "RENDER_ONLY output was not redacted"
if grep -Fq "$TOKEN" "$TEST_TMP_DIR/valid.out"; then
  fail "RENDER_ONLY output exposed the token"
fi
grep -Fq "$TOKEN" "$TEST_TMP_DIR/valid.toml" || fail "rendered file did not contain the validated token"

if run_render placeholder REPLACE_ME 2>/dev/null; then
  fail "REPLACE_ME placeholder was accepted"
fi

MULTILINE_TOKEN=$(printf '%s\n%s' "$TOKEN" invalid)
if run_render multiline "$MULTILINE_TOKEN" 2>/dev/null; then
  fail "multiline token was accepted"
fi

echo "entrypoint tests passed"
