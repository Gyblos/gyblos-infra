#!/bin/sh
# Renders /config/config.toml (template) into /tmp/iroh-relay.toml and execs
# iroh-relay. Fails closed: any missing/invalid variable aborts startup, so the
# relay never runs with iroh-relay's silent built-in defaults.
#
# Env:
#   RELAY_HOSTNAME       e.g. na1.relay.gyblos.com (required)
#   ACME_CONTACT         e.g. ops@example.com        (required)
#   RELAY_ACCESS_MODE    shared_token (default) | open
#   RELAY_ACCESS_TOKENS  comma-separated tokens, [A-Za-z0-9_-] only,
#                        >= 32 chars each (required for shared_token)
#   RENDER_ONLY=1        print a redacted rendered config and exit (for validation)
set -eu

TEMPLATE="${RELAY_CONFIG_TEMPLATE:-/config/config.toml}"
OUT="${RELAY_CONFIG_OUT:-/tmp/iroh-relay.toml}"

die() { echo "relay-entrypoint: $*" >&2; exit 64; }

# POSIX sh has no portable escape for a literal newline in a case pattern.
# Build newline and carriage-return values without leaving a trailing newline
# for command substitution to strip.
NL=$(printf '\nx')
NL=${NL%x}
CR=$(printf '\rx')
CR=${CR%x}

has_line_break() {
  case "$1" in
    *"$NL"*|*"$CR"*) return 0 ;;
    *) return 1 ;;
  esac
}

[ -f "$TEMPLATE" ] || die "template $TEMPLATE not found"

host="${RELAY_HOSTNAME:-}"
contact="${ACME_CONTACT:-}"
mode="${RELAY_ACCESS_MODE:-shared_token}"

has_line_break "$host" && die "RELAY_HOSTNAME must not contain line breaks"
has_line_break "$contact" && die "ACME_CONTACT must not contain line breaks"
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
    has_line_break "$tokens" && die "RELAY_ACCESS_TOKENS must not contain line breaks"
    list=""
    old_ifs="$IFS"; IFS=','
    for t in $tokens; do
      case "$t" in
        REPLACE_ME|replace-with-*|replace_with-*)
          die "RELAY_ACCESS_TOKENS still contains a placeholder"
          ;;
      esac
      printf '%s\n' "$t" | grep -Eq '^[A-Za-z0-9_-]{32,}$' \
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

chmod 0400 "$OUT"

if [ "${RENDER_ONLY:-0}" = "1" ]; then
  # Keep the real rendered file available for validation, but never expose
  # access tokens in command output or CI logs.
  sed 's/\(shared_token[[:space:]]*=[[:space:]]*\)\[[^]]*\]/\1["<redacted>"]/g' "$OUT"
  exit 0
fi

exec /iroh-relay --config-path "$OUT"
