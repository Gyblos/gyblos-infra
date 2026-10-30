# Gyblos iroh relays

Gyblos's self-hosted `iroh-relay` topology currently has one active relay,
`na1`, on Hostinger through Dokploy. `na2` is planned as a second relay on a
different provider and is not yet active. See the public [deployment status](../docs/status.md).
They replace n0's public relays, which are for development only.

Files:

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Pinned image `n0computer/iroh-relay:v1.4.1@sha256:f73d…d5d3`, ports, volume, limits, hardening |
| `config.toml` | Relay config template (placeholders filled by `entrypoint.sh` from `.env`) |
| `entrypoint.sh` | Renders the config, fails closed on missing/invalid values, execs the relay |
| `.env.example` | Per-VPS variables (`RELAY_HOSTNAME`, `ACME_CONTACT`, access mode, tokens) |
| `node-config.md` | How Gyblos nodes/buyers point at these relays (`@number0/iroh` 1.1.0) |
| `SECURITY.md` | Threat notes |

## What the relay does and does not do

Does:

- **Home relay / rendezvous.** Every endpoint keeps one WebSocket-over-HTTPS
  connection to its home relay. Peers reach each other by endpoint id via the
  relay before they know any IP address.
- **Hole-punching coordination.** Address candidates are exchanged through the
  relay, then iroh tries a direct UDP path. Typically ~9 in 10 connections go
  direct; after that the relay carries nothing for that connection.
- **QUIC address discovery (QAD)** on UDP 7842: tells a client which public
  `ip:port` it appears as (STUN replacement).
- **Fallback transport.** When hole-punching fails (symmetric NAT, UDP blocked)
  the encrypted QUIC packets flow through the relay for the whole session.
  This is where bandwidth cost comes from.
- Health/probe routes: `GET /healthz`, `GET /ping`, `GET /generate_204`.

Does not:

- **Cannot read traffic.** Relayed packets are QUIC datagrams end-to-end
  encrypted between the two endpoints (TLS 1.3 keyed to their ed25519 ids).
  The relay's own TLS only protects the hop to the relay.
- Does not do discovery/DNS: nodes still publish/resolve addresses via n0's
  pkarr/DNS discovery (`applyN0()`); that is a separate dependency.
- Does not authenticate Gyblos sellers/buyers or payments.

Sees (metadata): client public IPs and ports, endpoint ids (public keys),
which endpoint id talks to which, connection times and durations, byte and
packet volumes. Treat the relay host as holding sensitive metadata.

## DNS records

One name per relay, pointing directly at the VPS (no CDN/proxy, e.g. Cloudflare
"DNS only", grey cloud):

```
na2.relay.gyblos.com.  A     <na2 IPv4>
na2.relay.gyblos.com.  AAAA  <na2 IPv6>     # only if IPv6 is enabled end to end
na1.relay.gyblos.com.  A     <na1 IPv4>
na1.relay.gyblos.com.  AAAA  <na1 IPv6>
<domain>.            CAA   0 issue "letsencrypt.org"   # optional, recommended
```

TTL 300 while setting up. Records must resolve before the first start, or the
ACME challenge fails (and repeated failures hit Let's Encrypt rate limits).
Do not publish an AAAA record unless Docker IPv6 is configured (see below);
clients that pick a dead AAAA see slow or failed relay connections.

Relay URL used by clients: `https://na2.relay.gyblos.com/` and
`https://na1.relay.gyblos.com/`.

## Firewall

Inbound allow (both IPv4 and IPv6 if used):

| Port | Proto | Why |
| --- | --- | --- |
| 443 | TCP | Relay (WebSocket over HTTPS), ACME TLS-ALPN-01, /healthz |
| 80 | TCP | Captive-portal probe (`/generate_204`) used by clients' net reports |
| 7842 | UDP | QUIC address discovery |
| 22 | TCP | SSH, restricted to admin IPs; keys only |

Deny everything else, including 9090 (metrics are published on 127.0.0.1
only; scrape over SSH tunnel, WireGuard or Tailscale). Also enable the
provider's cloud firewall as a second layer. Note: Docker-published ports
bypass `ufw` rules, so rely on the provider firewall and on the
`127.0.0.1:` binding for 9090.

Optional connection-rate cap (iroh's `accept_conn_limit` is not enforced in
1.x) in the `DOCKER-USER` chain, e.g. with iptables `hashlimit`: new TCP
connections to 443 at ≤ 20/s per source IP, burst 40.

## Deploy on a fresh VPS (plain Docker)

Sizing: 1 vCPU / 1 GB RAM is enough to start; the cost driver is egress
bandwidth, so pick a provider with a large included transfer quota.

1. Create the VPS (Ubuntu 24.04 LTS or Debian 12), add SSH key, disable
   password login, enable unattended security upgrades.
2. Set the provider firewall as above. Create the DNS records and wait until
   `dig +short na1.relay.gyblos.com` returns the VPS IP for the active relay;
   use the configured hostname when deploying another relay.
3. Install Docker Engine + compose plugin from Docker's official repository.
4. Copy this `relay/` directory to `/opt/gyblos-relay` (git clone of the infra
   repo, or `scp`).
5. `cp .env.example .env && chmod 600 .env`, then edit: `RELAY_HOSTNAME`
   (this VPS's name), `ACME_CONTACT`, `RELAY_ACCESS_TOKENS` (same tokens on
   both relays). Generate a token:
   `openssl rand -base64 48 | tr '+/' '-_' | tr -d '='`
6. `docker compose config -q` (validates), then `docker compose up -d`.
7. `docker compose logs -f relay` until no errors, then run the checks under
   "Verify". The first HTTPS request may take a few seconds while the
   certificate is issued.
8. Repeat on the second VPS with its own `RELAY_HOSTNAME`.

IPv6 (optional): set `"ipv6": true`, `"fixed-cidr-v6"` and `"ip6tables": true`
in `/etc/docker/daemon.json` and recreate the network; otherwise publish only
the A record.

## Deploy via Dokploy

Constraint: the relay must own **443/tcp** itself (it terminates TLS and
answers the ACME TLS-ALPN-01 challenge). Dokploy's Traefik also binds 80/443
on every server it manages, so pick one:

- **A. Recommended: dedicated relay VPS, Traefik not on 80/443.** Add the VPS
  as a Dokploy *Remote Server*, deploy this directory as a **Compose** service
  (Git provider → this repo, compose path `relay/docker-compose.yml`), and
  stop/disable Traefik on that server (or move its entrypoints off 80/443).
  Put the variables from `.env.example` in the service's *Environment* tab.
  Do not add a Dokploy "Domain" to this service (that creates Traefik routes).
- **B. Shared server with Traefik in TCP passthrough.** Remove the `80:80` and
  `443:443` publications, attach the relay to `dokploy-network`, and add a
  Traefik TCP router for the configured relay hostname with `tls.passthrough=true`
  to the relay's 443 (TLS-ALPN-01 works through SNI passthrough). Port 80 then
  belongs to Traefik; the captive-portal probe degrades but relaying works.
  More moving parts; only if a dedicated VPS is not possible.

UDP 7842 and the 127.0.0.1:9090 mapping are unaffected by Traefik in both
options. Dokploy's "Deploy" pulls the pinned digest; there is no build step.

## Verify

From your laptop:

```sh
H=na1.relay.gyblos.com  # use the deployed relay hostname
curl --noproxy '*' -fsS https://$H/healthz            # 200
curl -fsS -o /dev/null -w '%{http_code}\n' https://$H/ping       # 200
curl -fsS -o /dev/null -w '%{http_code}\n' http://$H/generate_204  # 204
openssl s_client -connect $H:443 -servername $H </dev/null 2>/dev/null \
  | openssl x509 -noout -issuer -dates                 # Let's Encrypt, valid dates
nc -vzu $H 7842                                        # UDP open (weak check)
```

On the VPS:

```sh
docker compose ps                                       # relay healthy, relay-init exited 0
curl -s http://127.0.0.1:9090/metrics | grep -E 'accepts|bytes_(sent|recv)|unique_client_keys'
```

End-to-end (the real test), using `iroh` tooling or the Gyblos CLI with the
relay map from `node-config.md`:

- `iroh-doctor` (https://github.com/n0-computer/iroh-doctor) `report` /
  `relay-urls` with a config listing our relays: relay reachable, latency, and
  QAD returning your public IPv4. Check its `--help` for the exact flags of the
  version you install; it must be built against iroh 1.x.
- Two Gyblos endpoints on different networks, both configured with only our
  relays, reach `online()` and connect; in `GYBLOS_RELAY_ONLY=1` mode the
  seller must report route `iroh-relay` and the relay's `bytes_sent` metric
  must increase. With access mode `shared_token`, an endpoint with a wrong
  token must fail to get a home relay (relay denies the upgrade).

## Monitoring bandwidth (to measure real cost)

Measure at two layers, because providers bill on interface traffic:

1. **Relay metrics** (`127.0.0.1:9090/metrics`, Prometheus text): `bytes_sent`,
   `bytes_recv` (relayed datagram payload), `accepts`/`disconnects`,
   `unique_client_keys` (daily distinct endpoint ids),
   `bytes_rx_ratelimited_total` / `conns_rx_ratelimited_total` (are limits
   biting?). Scrape every 60 s over a private link with Prometheus or Grafana
   Agent, or for a start a cron that appends `curl` output to a file hourly.
2. **Host interface counters**: `vnstat` on the VPS (`apt install vnstat`;
   `vnstat -d`, `vnstat -m`) plus the provider's billing dashboard. The gap
   between (2) and (1) is TLS/WebSocket/QAD/probe overhead.

Alert at 50% and 80% of the monthly included transfer, and on
`conns_rx_ratelimited_total` growing quickly (abuse or limits too low).

## Cost-measurement plan

The "≈1 in 10 connections relayed" figure and the cost are hypotheses.

1. **Baseline (week 0):** both relays idle; record egress/day from vnstat
   (probes, keep-alives, QAD). Expected near zero.
2. **Instrument the client:** the Gyblos transport already records whether a
   connection was direct or relayed (`relayObserved`, selected path). Log per
   session: route, bytes in/out, duration, relay URL. No IPs.
3. **Controlled run (week 1):** N buyer/seller pairs across home NAT, mobile
   CGNAT, cloud VM, and one forced `GYBLOS_RELAY_ONLY=1` pair. Compute:
   relay share = relayed sessions / all sessions; bytes per relayed session.
4. **Model:** monthly egress ≈ sessions/month × relay share × bytes per relayed
   session × 2 (relay receives and resends) + baseline. Compare with each
   provider's included transfer and overage price.
5. **Live (weeks 2–4):** compare model vs. vnstat + metrics weekly; revise the
   rate limit and the VPS plan. Record results in the brain vault note for
   infra, not here.

## Backup and rotation

- **Cert volume** (`gyblos-relay-certs`): ACME account + certificate cache.
  Not critical (re-issued automatically) but backing it up avoids hitting Let's
  Encrypt's 5-duplicate-certificates/week limit after rebuilds:
  `docker run --rm -v gyblos-relay-certs:/c:ro -v "$PWD":/b alpine tar czf /b/relay-certs.tgz -C /c .`
  Store encrypted (it contains the TLS private key); never in git.
- **Certificates** renew automatically before expiry; check expiry monthly with
  the `openssl` command above.
- **Access tokens:** rotate every 90 days or on leak: set
  `RELAY_ACCESS_TOKENS=<old>,<new>` on both relays, ship the Gyblos client
  with `<new>`, wait until old clients are gone (or the deprecation date),
  then set `RELAY_ACCESS_TOKENS=<new>`. Restart with `docker compose up -d`.
- **Host:** the VPS itself is rebuildable from this directory + `.env`; keep
  `.env` in the founder's password manager.

## Upgrade policy

- Always pin `tag@digest`; never `latest`. Find the digest with
  `docker buildx imagetools inspect n0computer/iroh-relay:<tag>` or Docker Hub.
- Stay on iroh **1.x** while clients use `@number0/iroh` 1.x. n0 keeps the
  relay protocol compatible within a major; a 2.x relay needs a matching
  client upgrade first.
- Watch https://github.com/n0-computer/iroh/releases (GitHub "Releases only"
  watch). Security releases touching `iroh-relay`/rustls: upgrade within 7
  days. Others: upgrade monthly, after the release is ≥ 1 week old.
- Rollout: upgrade `na1` first, run the Verify section and an end-to-end
  connection, wait 24 h, then repeat for `na2` after it becomes active. Keep
  the previous `tag@digest` in the git history for a one-line rollback.
- Re-read `iroh-relay/src/main.rs` (config struct) and the release notes for
  config key changes before each upgrade.

## End-to-end check with real Iroh endpoints

`relay/check/` contains a small Node script that checks a deployed relay:

```bash
cd relay/check && npm ci --ignore-scripts
node control.mjs                      # sanity: the setup goes online with n0's public relays
RELAY_URL=https://na1.relay.gyblos.com node check.mjs  # no token / wrong token must be refused
read -s GYBLOS_RELAY_TOKEN && export GYBLOS_RELAY_TOKEN
RELAY_URL=https://na1.relay.gyblos.com node check.mjs  # with the token: echo through the relay
unset GYBLOS_RELAY_TOKEN
```

The token is read from the environment and never printed.
