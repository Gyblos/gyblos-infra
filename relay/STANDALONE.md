# Deploy on a dedicated VPS

Use `docker-compose.yml` when the relay can own host TCP 80/443.
For shared Dokploy, follow [DOKPLOY.md](DOKPLOY.md). This alternative recipe
does not declare that na2 has been deployed.

## Prepare the host

Provision a supported Linux VPS with SSH keys, restricted administrator access
and host security updates. Install Docker Engine and Compose. Size resources
from measured load and transfer quotas.

Create an A record without a CDN proxy. Publish AAAA only after verifying IPv6
through the host and Docker network. DNS must resolve before TLS issuance.
Allow TCP 80/443 and UDP 7842 in provider/host firewalls. Restrict SSH; do not
expose 9090. Docker-published ports may bypass ufw rules.

## Deploy

Clone this repository and enter `relay/` on the host:

```sh
cp .env.example .env
chmod 600 .env
# Configure .env through the host's secure configuration process.
docker compose config -q
docker compose up -d
docker compose logs -f relay
```

Use the [environment reference](README.md#environment). Generate a token with
`openssl rand -hex 32` outside Git. Rendered Compose output contains environment
values; do not publish it. Initial certificate issuance may take time.

Complete [operations verification](../docs/operations.md) and the
[release checklist](../docs/release-checklist.md), then record evidence privately.
