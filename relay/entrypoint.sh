#!/bin/sh
# Renders /config/config.toml (template) into /tmp/iroh-relay.toml and execs
# iroh-relay. Fails closed: any missing/invalid variable aborts startup, so the
# relay never runs with iroh-relay's silent built-in defaults.
#
# Env:
#   RELAY_HOSTNAME       e.g. sa1.relay.example.com (required)
#   ACME_CONTACT         e.g. ops@example.com        (required)
#   RELAY_ACCESS_MODE    shared_token (default) | open
#   RELAY_ACCESS_TOKENS  comma-separated tokens, [A-Za-z0-9_-] only,
#                        >= 32 chars each (required for shared_token)
#   RENDER_ONLY=1        print the rendered config and exit (for validation)
set -eu

TEMPLATE="${RELAY_CONFIG_TEMPLATE:-/config/config.toml}"
OUT="${RELAY_CONFIG_OUT:-/tmp/iroh-relay.toml}"

die() { echo "relay-entrypoint: $*" >&2; exit 64; }

[ -f "$TEMPLATE" ] || die "template $TEMPLATE not found"

host="${RELAY_HOSTNAME:-}"
contact="${ACME_CONTACT:-}"
mode="${RELAY_ACCESS_MODE:-shared_token}"

echo "$host" | grep -Eq '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' \
  || die "RELAY_HOSTNAME must be a lowercase DNS name"
echo "$contact" | grep -Eq '^[^@[:space:]"]+@[^@[:space:]"]+\.[^@[:space:]"]+$' \
  || die "ACME_CONTACT must be an email address"

case "$mode" in
  open)
    access='"everyone"'
    ;;
  shared_token)
    tokens="${RELAY_ACCESS_TOKENS:-}"
    [ -n "$tokens" ] || die "RELAY_ACCESS_TOKENS is required for shared_token mode"
    list=""
    old_ifs="$IFS"; IFS=','
    for t in $tokens; do
      echo "$t" | grep -Eq '^[A-Za-z0-9_-]{32,}$' \
        || die "each token must match [A-Za-z0-9_-]{32,}"
      list="${list:+$list, }\"$t\""
    done
    IFS="$old_ifs"
    access="{ shared_token = [$list] }"
    ;;
  *)
    die "RELAY_ACCESS_MODE must be 'shared_token' or 'open'"
    ;;
esac

# Values are validated above to contain no '|', '"', '\' or newlines.
sed -e "s|__RELAY_HOSTNAME__|$host|g" \
    -e "s|__ACME_CONTACT__|$contact|g" \
    -e "s|__ACCESS__|$access|g" \
    "$TEMPLATE" > "$OUT"

if grep -q '__[A-Z_]*__' "$OUT"; then
  die "unrendered placeholder left in $OUT"
fi

if [ "${RENDER_ONLY:-0}" = "1" ]; then
  cat "$OUT"
  exit 0
fi

chmod 0400 "$OUT"
exec /iroh-relay --config-path "$OUT"
