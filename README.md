# gyblos-infra

Open-source infrastructure configuration for Gyblos.

## Scope

This repository contains the container configuration, runtime configuration
template, deployment instructions and operational checks for Gyblos's
self-hosted Iroh relay service. It does not contain the Gyblos client
implementation, customer data, host credentials or deployment state.

## Current topology

The declared topology is documented in [`docs/status.md`](docs/status.md):
`na1` is the active relay and `na2` is planned redundancy.

## Documentation

- [`relay/README.md`](relay/README.md): deployment, verification, monitoring and upgrades.
- [`relay/DOKPLOY.md`](relay/DOKPLOY.md): deployment on an existing Dokploy server.
- [`relay/node-config.md`](relay/node-config.md): proposed client integration contract.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): local setup and contribution workflow.
- [`docs/release-checklist.md`](docs/release-checklist.md): deployment, rollback and rotation checklist.
- [`SECURITY.md`](SECURITY.md): private vulnerability reporting policy.
- [`LICENSE`](LICENSE): Apache-2.0 license.

## Validate changes

Install the relay check dependencies when needed, then run the complete local
validation suite from the repository root:

```sh
cd relay/check && npm ci --ignore-scripts --no-audit --no-fund && cd ../..
sh scripts/check.sh
```

The checks use dummy values for Compose validation. They do not contact a
deployed relay or use production credentials. Follow the
[`release checklist`](docs/release-checklist.md) for manual infrastructure and
E2E validation.

Secrets never go in this repo: tokens and contact details live in the
deployment's environment (Dokploy variables or a local `.env`, which is
gitignored). Certificate backups contain private keys and must remain outside
Git.
