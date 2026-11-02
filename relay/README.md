# Relay configuration reference

Read the [architecture](../docs/architecture.md) for traffic and trust boundaries.

## Choose a deployment

| Environment | Compose file | Guide |
| --- | --- | --- |
| Shared Dokploy server; Traefik owns host 80/443 | `docker-compose.dokploy.yml` | [Dokploy](DOKPLOY.md); current na1 variant |
| Dedicated VPS; relay owns host 80/443 | `docker-compose.yml` | [Standalone](STANDALONE.md) |

Do not deploy both on one host: UDP/metrics ports and the certificate volume overlap.

## Files

| File | Purpose |
| --- | --- |
| `docker-compose*.yml` | Image pin, networking, volume and container limits |
| `config.toml` | Runtime template, not ready-to-run configuration |
| `entrypoint.sh` | Validates environment, renders template and starts relay |
| `.env.example` | Public placeholders; configure only on deployment host |
| `check/` | Operational Node tools using binding 1.2.0 |
| `test/` | Local entrypoint regression tests |
| `node-config.md` | Proposed consumer integration and historical review |

## Environment

| Variable | Requirement / default |
| --- | --- |
| `RELAY_HOSTNAME` | Required lowercase DNS name resolving to this host |
| `ACME_CONTACT` | Required operator email for certificate issuance |
| `RELAY_ACCESS_MODE` | `shared_token` by default; `open` allows everyone |
| `RELAY_ACCESS_TOKENS` | Required for shared_token; comma-separated tokens, each 32+ characters from A-Za-z0-9_- |
| `RUST_LOG` | `warn`; increase temporarily during incidents |

Generate a token with `openssl rand -hex 32`. Never commit the result.
The example `REPLACE_ME` is rejected at startup. `RENDER_ONLY=1` prints redacted
output but leaves the secret in the rendered file; use dummy values locally.

## Version policy

Both Compose files pin relay v1.4.1 by tag and digest. The operational checker
pins `@number0/iroh` 1.2.0. These are separate version numbers, not proof of
consumer interoperability. The proposal records a historical binding 1.1.0
review; current consumer commits have not been verified here.

Review upstream release notes and the relay configuration struct before updates.
Update both image pins together, validate locally, then check authenticated
traffic. Prioritize security fixes; coordinate protocol-major changes with
consumers. Retain the previous digest and configuration for rollback.

Use [operations](../docs/operations.md) for verification, monitoring, backups and
rotation and the [release checklist](../docs/release-checklist.md) for sign-off.
[Status](../docs/status.md) declares na1 active and na2 planned.
