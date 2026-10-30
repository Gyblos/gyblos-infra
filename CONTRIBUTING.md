# Contributing to gyblos-infra

Thanks for helping improve the public Gyblos relay infrastructure.

## Scope

This repository contains the public Docker, Compose, runtime-template and
operational material for Gyblos's self-hosted Iroh relays. It does not contain
client implementations, customer data, deployment credentials or host state.

Changes to `gyblos-payments` belong in that repository. Changes that affect a
deployed relay must also be validated with the release checklist in
[`docs/release-checklist.md`](docs/release-checklist.md).

## Prerequisites

- Git.
- Docker Engine with the Docker Compose plugin.
- Node.js compatible with the `relay/check` package (Node.js 20.3 or newer).
- A shell with standard POSIX utilities.

## Local setup

From the repository root, install the relay-check dependencies when you need
to run the Node-based check or control script:

```sh
cd relay/check
npm ci --ignore-scripts --no-audit --no-fund
cd ../..
```

Run the complete repository validation suite:

```sh
sh scripts/check.sh
```

The suite uses deterministic dummy values for Compose validation. It does not
contact `na1`, deploy containers, or require production secrets.

The real relay check is an operational validation and must use an explicit
`RELAY_URL`. Follow the release checklist and inject any token through the
environment; never put it in a committed file or a command copied into an
issue or pull request.

## Making changes

1. Start from the current `main` branch.
2. Keep changes focused and update the relevant documentation with behavior
   changes.
3. Run `sh scripts/check.sh` before opening a pull request.
4. Describe operational impact, rollback considerations and any manual test
   that could not run locally.
5. Keep credentials, `.env` files, private keys, certificates and certificate
   backups outside Git.

Do not change the deployed topology in `docs/status.md` until the deployment
has been verified. The public status page is a declaration of project intent,
not a live availability monitor.

## Pull requests

The repository's workflow runs the same validation command when a GitHub
runner is available. The workflow is intentionally non-deploying and does not
use production secrets. A queued or unavailable runner does not replace the
local validation requirement.

For infrastructure changes, include:

- the affected relay or deployment variant;
- the expected effect on clients, traffic or certificates;
- the validation performed;
- a rollback path; and
- documentation updates or an explicit reason none are needed.

## Security reports

Do not open a public issue for a vulnerability. Follow the private reporting
instructions in [`SECURITY.md`](SECURITY.md).

## License

Contributions are made under the repository's
[`Apache-2.0 license`](LICENSE).
