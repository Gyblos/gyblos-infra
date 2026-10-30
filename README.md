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
- [`SECURITY.md`](SECURITY.md): private vulnerability reporting policy.
- [`LICENSE`](LICENSE): Apache-2.0 license.

Secrets never go in this repo: tokens and contact details live in the
deployment's environment (Dokploy variables or a local `.env`, which is
gitignored). Certificate backups contain private keys and must remain outside
Git.
