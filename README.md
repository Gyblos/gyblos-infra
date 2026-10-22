# gyblos-infra

Infrastructure configuration for Gyblos.

- [`relay/`](relay/): self-hosted Iroh relays (`na1`, `na2` in North America on two providers). Start with [`relay/DOKPLOY.md`](relay/DOKPLOY.md) on a Dokploy server, or [`relay/README.md`](relay/README.md) on a dedicated VPS.

Secrets never go in this repo: tokens and contact details live in the deployment's environment (Dokploy variables or a local `.env`, which is gitignored).
