# Relay release checklist

Procedures live in [operations](operations.md). Keep deployment evidence private.

## Prepare the PR

- [ ] Describe scope, operational impact and rollback.
- [ ] Run `sh scripts/check.sh` and `git diff --check` locally.
- [ ] Validate both Compose variants with dummy values (included in suite).
- [ ] Exclude credentials, certificates and backups.
- [ ] Keep na1 active and na2 planned in documentation.

## Before deployment

- [ ] Select [Dokploy](../relay/DOKPLOY.md) or [standalone](../relay/STANDALONE.md).
- [ ] Record current configuration commit and digest for rollback.
- [ ] Review image/client compatibility and migration requirements.
- [ ] Confirm DNS, firewall, TLS path and private metrics exposure.
- [ ] Confirm real environment values replace REPLACE_ME without publishing them.
- [ ] Prepare an encrypted certificate backup outside Git if needed.

## Deploy and verify

- [ ] Deploy na1 through its existing deployment method.
- [ ] Confirm init completion, container health and local metrics.
- [ ] Check /healthz, /ping, variant-specific /generate_204 and certificate validity
      using [operations](operations.md#public-and-host-checks).
- [ ] Run [authenticated E2E](operations.md#end-to-end-validation) with explicit
      URL and environment-only token; record whether it passed.
- [ ] Confirm client impact, transfer and logs after deployment.
- [ ] Record time, commit, digest and results privately.
- [ ] On failure restore previous digest/configuration and verify recovery.

## Follow-up

- [ ] Complete [rotation](operations.md#token-rotation) when required, with overlap,
      consumer migration and removal of the previous token.
- [ ] Record monitoring coverage: manual workflows provide no scheduled coverage.

## Activating na2 later

- [ ] Select an independent provider/region and deployment method.
- [ ] Verify DNS, firewall, TLS, metrics and authenticated E2E independently.
- [ ] Coordinate consumer relay set and token policy.
- [ ] Test failover before claiming redundancy.
- [ ] Update [status](status.md) only after verified deployment.
