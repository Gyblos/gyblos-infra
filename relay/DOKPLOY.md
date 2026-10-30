# Deploying the relay on an existing Dokploy server

Use `docker-compose.dokploy.yml` when the server already runs Dokploy, whose
Traefik owns ports 80 and 443. Use `docker-compose.yml` on a dedicated VPS.

## How it fits next to other apps

- **TCP 443:** Traefik matches the relay hostname by SNI and passes the TLS
  stream through untouched (`tls.passthrough`). The relay terminates TLS
  itself and gets its own Let's Encrypt certificate (TLS-ALPN-01). Other
  Dokploy apps keep their own routers and certificates.
- **UDP 7842:** published directly from the container (QUIC address discovery).
  Traefik is not involved.
- **Metrics:** `127.0.0.1:9090` on the host only.
- **Limits:** 1 CPU, 512 MB RAM, 256 processes, plus per-client rate limits in
  `config.toml`, so relay load cannot starve the other services.

## Steps

1. **DNS (Cloudflare):** add an `A` record (and `AAAA` if the server has IPv6)
   for the relay hostname, e.g. `na1.relay.gyblos.com`, pointing at the
   server. Set it to **DNS only (grey cloud)**. The orange proxy breaks UDP and
   the relay's own TLS.
2. **Firewall:** allow inbound **UDP 7842** in the Hostinger firewall (hPanel)
   and in the server firewall (`ufw allow 7842/udp` if ufw is used). TCP 443
   is already open for Traefik.
3. **Dokploy:** create a new **Compose** service:
   - Compose file: contents of `docker-compose.dokploy.yml`.
   - Source: deploy from the public Git repo `Gyblos/gyblos-infra`, Compose
     Path `./relay/docker-compose.dokploy.yml` (the default `./docker-compose.yml`
     fails with "Compose file not found"). Mount paths are relative to that
     file's folder. Do not add file mounts by hand.
   - Environment: values from `.env.example` (`RELAY_HOSTNAME`,
     `ACME_CONTACT`, `RELAY_ACCESS_MODE`, `RELAY_ACCESS_TOKENS`, `RUST_LOG`).
     Generate the token as shown there. Never commit it.
4. **Deploy**, then wait about a minute for the certificate.
5. **Verify:**
   - `curl -sS https://na1.relay.gyblos.com/ping` should answer.
   - `curl -sS https://na1.relay.gyblos.com/healthz`.
   - `nc -u -z -v na1.relay.gyblos.com 7842` from another machine (UDP checks
     are best-effort).
   - On the server: `curl -s 127.0.0.1:9090/metrics | head`.
6. **Measure cost:** watch relay bytes in the metrics and the server's monthly
   traffic in hPanel before adding the second relay.

## Notes

- `na1` is the currently documented active relay. `na2` is planned as a second
  relay with another provider and region; until it is deployed, this setup is
  not redundant.
- Nodes must be configured to use this relay, and the buyer's relay check must
  accept it. Today `apps/cli/src/p2p/buyer.ts` only accepts n0's default relays
  (see `node-config.md`).
