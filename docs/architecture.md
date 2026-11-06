# Relay architecture

This repository configures Iroh relay infrastructure. Consumer integration is
still a [proposal](../relay/node-config.md).

## Traffic and trust

Endpoints keep a home-relay connection over HTTPS/WebSocket for rendezvous and
address exchange. Iroh tries a direct UDP path; when unavailable, the relay
forwards end-to-end encrypted packets. Measure the fraction of relayed sessions
rather than assuming a fixed success rate.

The relay cannot read application payloads but can observe public addresses,
endpoint identifiers, timing and traffic volume. It does not establish buyer,
seller or payment identity. Shared tokens limit casual abuse; tokens embedded
in public clients are extractable. Handle deployed tokens as credentials.

The proposed client setup retains n0 DNS/pkarr discovery. Self-hosting relays
alone does not remove that dependency.

## Network paths

| Port | Dedicated VPS | Shared Dokploy |
| --- | --- | --- |
| TCP 443 | Direct to relay TLS | Traefik SNI TCP passthrough to relay TLS |
| TCP 80 | Relay probe returns 204 | Traefik owns port; current probe returns 404 |
| UDP 7842 | Direct to QAD listener | Direct to QAD listener |
| TCP 9090 | Host loopback metrics mapping | Host loopback metrics mapping |

The relay obtains its certificate using ACME TLS-ALPN-01. A proxy terminating
TLS is incompatible with this setup. Metrics listen on all interfaces inside
the container: peers on the same container network may reach them. Host
loopback publication does not isolate that network.

## Availability and limits

Only na1 is declared active. Independent-provider redundancy is planned and
provides no current failover guarantee. See [status](status.md).

Compose configures a non-root relay, read-only root filesystem, dropped
capabilities, temporary rendered configuration, log rotation and resource
limits. A one-shot root container initializes the certificate volume without
network access. Syntax checks do not prove these controls on a particular host.

Receive-side limits constrain each connection, not total host bandwidth.
Track host transfer alongside relay counters and provider billing.
See [operations](operations.md) and the [threat model](../relay/SECURITY.md).
