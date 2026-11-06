# Relay operations

Use the intended Compose variant and hostname. Only na1 is declared active in
[status](status.md). Commands assume the repository root unless specified.

## Public and host checks

```sh
H=na1.relay.gyblos.com
curl --noproxy '*' -fsS "https://$H/healthz"
curl --noproxy '*' -fsS -o /dev/null -w '%{http_code}\n' "https://$H/ping"
curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' "http://$H/generate_204"
openssl s_client -connect "$H:443" -servername "$H" </dev/null 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

Expect 200 for health/ping; probe 204 on standalone or currently 404 on Dokploy.
UDP scans are inconclusive; use Iroh tooling to verify QAD. These checks do
not prove authenticated relaying or consumer integration.

On standalone, run `docker compose ps` from `relay/`. On Dokploy, inspect the
actual deployed service/project. Expect init exit 0 and a healthy relay.
Inspect `http://127.0.0.1:9090/metrics` on the host; never publish it.

## End-to-end validation

From the repository root:

```sh
cd relay/check
npm ci --ignore-scripts --no-audit --no-fund
```

Load the token interactively in **Bash or Zsh** (`read -s` is not POSIX):

```bash
read -r -s GYBLOS_RELAY_TOKEN
printf '\n'
export GYBLOS_RELAY_TOKEN
RELAY_URL=https://na1.relay.gyblos.com node check.mjs
unset GYBLOS_RELAY_TOKEN
```

Require authenticated echo success. A no-token run cannot certify access
enforcement: timeouts can mean an unreachable relay. The optional
`control.mjs` contacts n0 relays and does not prove target reachability.
Record time, commit, image digest and results privately, never tokens.
Consumer behavior requires its own integration test.

## Monitoring

The [monitor workflow](../.github/workflows/relay-monitor.yml) checks public
health and optionally authenticated E2E using the Actions secret
`GYBLOS_RELAY_TOKEN`. An omitted echo is not complete validation. Workflows
are manual while runner quota is unavailable; there is no scheduled coverage.
Run `sh scripts/check.sh` locally before PRs.

Track aggregate relay counters, host interface transfer and provider billing
separately. Arrange alerts on certificate expiry, failed health, authenticated
traffic failures and transfer quota consumption. These operational requirements
are not installed alerting services. Keep logs minimal per the
[threat model](../relay/SECURITY.md).

## Backups and recovery

The `gyblos-relay-certs` volume contains private keys. Back up from a secure host
location outside the working tree into approved encrypted storage. A plain tar
archive is not encryption. Retain permissions and verify restoration on an
isolated host before relying on backups. Avoid deleting the live volume during
redeployment. Certificate re-issuance is subject to CA rate limits.

Keep environment values in the operator's secret store. Recovery requires
configuration, pinned image, environment, DNS/firewall setup and certificate
volume or successful re-issuance.

## Token rotation

1. Generate a new token outside Git with `openssl rand -hex 32`.
2. Set `old,new` on every active relay (currently na1 only) and redeploy.
3. Update authorized consumers and any separate monitor secret.
4. Validate authenticated echo with the new token.
5. Remove the old token after consumer migration, redeploy and validate again.

Rotate on suspected exposure and the agreed interval. Do not open production
access to migrate clients.

## Upgrades, rollback and troubleshooting

Follow the [version policy](../relay/README.md#version-policy). Roll back to the
previous reviewed image digest/configuration using the same deployment variant.
Repeat health, metrics and authenticated checks after upgrades or rollback.

For TLS failures check DNS and TCP passthrough before repeated issuance retries.
If health works but echo fails, check access mode, token and client relay map.
For rising transfer inspect aggregate counters and billing before changing limits.
Revert temporarily increased log verbosity after diagnosis.
