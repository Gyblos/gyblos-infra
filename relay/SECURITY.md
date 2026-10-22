# Relay security notes

Scope: the two Gyblos `iroh-relay` hosts. Anonymous access to the relays is an
abuse mitigation, not a confidentiality guarantee.

## Access mode decision (v1: `shared_token`)

| Mode | Pros | Cons |
| --- | --- | --- |
| `open` (`access = "everyone"`) | Zero client config; any iroh app can interoperate | Anyone on the internet can use our egress as a free relay (iroh users can point any app at a relay URL) |
| `shared_token` (**v1**) | Only clients carrying the Gyblos token can relay; trivial to run; two tokens allow rotation | Token ships in the open client, so it is extractable: this is a speed bump against drive-by use, not authentication |
| `http` callout (`access.http.url`) | Per-endpoint-id decisions (e.g. registered sellers, deny lists, quotas) | Needs a highly available auth service on the relay hot path; buyers are anonymous, so it cannot be a strict allowlist without also gating buyers; callout only receives the endpoint id |
| `allowlist`/`denylist` | Static, local | Allowlist does not fit an open market; denylist only after abuse is seen |

Recommendation: **v1 `shared_token` + per-client rate limits**, with
`denylist` added reactively for abusive endpoint ids. Revisit an `http`
callout once there is a seller registry and per-endpoint quotas are needed.
Note access control only gates *relaying*; QAD (UDP 7842) and probe routes
stay open by design and carry negligible traffic.

## Threats

**Abuse as a free proxy / bandwidth sink.** Relayed traffic is opaque, so we
cannot tell inference from file sharing. Mitigations: token gate;
`[limits.client.rx]` 500 kB/s with 2 MB burst per connection; egress alerts
at 50/80% of quota; provider-level hard cap where available; denylist the
endpoint ids that dominate `bytes_recv` (requires debug-level inspection
during an incident, then back to `warn`). A token leak is expected over time:
rotate it (README), do not treat it as secret material.

**DoS.** Connection floods and many concurrent clients exhaust file
descriptors/memory. Mitigations: container limits (1 CPU, 512 MB, 256 pids,
65536 fds); host firewall per-IP connection rate (`accept_conn_limit` is not
enforced in 1.x); two independent providers so one being down or null-routed
does not stop the market; clients fail over by latency. Volumetric attacks
beyond the VPS link need the provider's DDoS protection; no CDN can front a
raw relay (TLS-ALPN + UDP).

**Metadata exposure.** The relay cannot decrypt payloads (end-to-end QUIC
between endpoint keys) but sees client IPs, endpoint ids, who talks to whom,
timing and volume. Mitigations: minimal logs (below); metrics only on
127.0.0.1; no access logs or reverse proxy logging in front; SSH admin-only.
Be honest in public docs: running through our relays reveals this metadata to
Gyblos and to the hosting providers; it is not an anonymity network.

**Certificates and keys.** The Let's Encrypt account key and TLS private key
live in the `gyblos-relay-certs` volume (mode 0700, owned by uid 65534).
Compromise lets an attacker impersonate the relay hop, but still not read
end-to-end traffic or impersonate endpoints. Back up only encrypted; never
commit; rebuild on suspected compromise (new VPS, new cert, revoke old via
ACME). Access tokens live only in `.env` (mode 600) and in the Dokploy
environment, never in git.

**Container hardening.** Runs as uid 65534, all capabilities dropped,
`no-new-privileges`, read-only root, rendered config in a 1 MB tmpfs, image
pinned by digest. The one-shot `relay-init` runs as root only to `chown` the
volume, with no network.

**Supply chain.** We trust n0's image. Pin digest, track releases, upgrade
promptly on rustls/RUSTSEC fixes (README "Upgrade policy").

## Logs and retention

- `RUST_LOG=warn` in production: startup, errors and abnormal events only. At
  `info`/`debug` the relay logs listener addresses and per-connection detail
  that can include endpoint ids and peer addresses; use only during incidents
  and revert.
- Docker `json-file` rotation: 3 × 10 MB per host, so logs self-expire within
  days. Do not ship relay logs to a third-party log service.
- If a log must leave the host, strip IPs first (e.g. `sed -E` masking the last
  octet / last 80 bits). Prometheus metrics are aggregate counters only and
  contain no IPs or ids.
- Host-level: disable or shorten `journald` persistence for Docker
  (`SystemMaxUse=200M`), and do not enable firewall packet logging except
  temporarily.
