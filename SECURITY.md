# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities through GitHub's private vulnerability
reporting or Security Advisories feature for
[`Gyblos/gyblos-infra`](https://github.com/Gyblos/gyblos-infra/security).

Do not open a public issue or disclose the vulnerability publicly before the
maintainers have had an opportunity to investigate it.

Include, when possible:

- a concise description of the impact;
- steps or configuration needed to reproduce the issue;
- the affected commit, release or deployment variant;
- logs or proof of concept with secrets and personal data removed; and
- a suggested mitigation, if one is known.

## Scope and support

The scope includes the current `main` branch, Docker and Compose
configuration, shell and Node scripts, dependency manifests and lockfiles,
operational documentation, and the configuration currently deployed for
Gyblos relays. Older revisions are best effort.

There is no formal response-time SLA. Reports are reviewed and handled
reasonably according to maintainer capacity and severity.

For the relay's operational threat model, metadata exposure and hardening
assumptions, see [`relay/SECURITY.md`](relay/SECURITY.md).
