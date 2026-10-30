# Relay release checklist

Use this checklist for changes that may affect a deployed Gyblos relay. It is
an operational procedure, not a live monitor. Do not add tokens, private keys,
certificate backups, host IPs or other deployment-only values to this file.

## Before opening the pull request

- [ ] The change is within this repository's scope; client changes are in the
      appropriate consumer repository.
- [ ] `sh scripts/check.sh` passes locally.
- [ ] `git diff --check` passes.
- [ ] No `.env`, token, private key, certificate or `relay-certs.tgz` is
      tracked.
- [ ] The PR describes operational impact and a rollback path.
- [ ] Documentation reflects the declared topology: `na1` active and `na2`
      planned until `na2` is actually deployed and verified.

## Before deploying `na1`

- [ ] The image tag and digest are intentional and compatible with the Iroh
      client major version.
- [ ] DNS points the relay hostname directly at the intended host. Do not use
      a TLS-terminating CDN or proxy in front of the relay.
- [ ] The provider and host firewalls allow the documented TCP and UDP ports.
- [ ] Dokploy variables or the host `.env` contain the real values; the
      repository template still contains `RELAY_ACCESS_TOKENS=REPLACE_ME`.
- [ ] The access token is at least 32 characters and contains only the
      supported characters.
- [ ] The deployment is using the intended Compose variant and Compose path.
- [ ] A certificate backup, if needed before a rebuild, will be encrypted and
      stored outside the repository.

## Deploy and verify

Use the deployment instructions in [`relay/README.md`](../relay/README.md) or
[`relay/DOKPLOY.md`](../relay/DOKPLOY.md), then verify the public endpoints:

```sh
H=na1.relay.gyblos.com
curl --noproxy '*' -fsS "https://$H/healthz"
curl -fsS -o /dev/null -w '%{http_code}\n' "https://$H/ping"
curl -fsS -o /dev/null -w '%{http_code}\n' "http://$H/generate_204"
openssl s_client -connect "$H:443" -servername "$H" </dev/null 2>/dev/null \
  | openssl x509 -noout -issuer -dates
nc -vzu "$H" 7842
```

On the relay host, confirm the containers and local metrics:

```sh
docker compose ps
curl -fsS http://127.0.0.1:9090/metrics | head
```

The UDP check is best effort. Treat the HTTPS, health and local metrics checks
as required deployment evidence.

## Manual end-to-end check

The E2E check is intentionally manual and never runs against production from
GitHub Actions. Run it only with an explicit relay URL:

```sh
cd relay/check
npm ci --ignore-scripts --no-audit --no-fund
RELAY_URL=https://na1.relay.gyblos.com node check.mjs
```

The first run checks refusal without a token and with a wrong token. For the
authenticated echo test, load the token interactively and do not paste it into
the shell command or a file:

```sh
read -r -s GYBLOS_RELAY_TOKEN
export GYBLOS_RELAY_TOKEN
RELAY_URL=https://na1.relay.gyblos.com node check.mjs
unset GYBLOS_RELAY_TOKEN
```

Record the result, relay URL, repository commit and image digest in the
private deployment record. Do not record the token.

## Scheduled monitoring

The [`Relay monitor`](../.github/workflows/relay-monitor.yml) workflow runs
daily and can also be started manually. It checks `na1`'s public health, ping,
HTTP probe and TLS certificate without credentials.

For the authenticated E2E job, add the repository Actions secret
`GYBLOS_RELAY_TOKEN` after the production token has been rotated. The workflow
skips that job with a visible notice when the secret is absent. Never put the
token in this workflow, a commit, a URL or a log.

## Rollback

- [ ] Identify the last known-good image tag and digest in Git history.
- [ ] Restore that image reference in the deployment configuration.
- [ ] Redeploy the same Compose variant.
- [ ] Repeat the health, metrics and authenticated E2E checks.
- [ ] Record the reason, affected commit and final state privately.

Do not roll back by copying an old `.env` or certificate archive into Git.

## Certificate backups

Certificate volumes contain private keys. If a backup is needed before a
rebuild, run it from a secure location outside the repository and encrypt or
store it in the approved secret-storage system:

```sh
docker run --rm \
  -v gyblos-relay-certs:/c:ro \
  -v /secure/relay-backups:/b \
  alpine tar czf /b/relay-certs-YYYYMMDD.tgz -C /c .
```

Never name the repository working tree as `/b`, and never commit the resulting
archive. The volume is recoverable through certificate re-issuance, but a
backup helps avoid unnecessary Let's Encrypt duplicate-certificate limits.

## Access-token rotation

Rotate after a confirmed deployment, after a suspected exposure, or according
to the agreed rotation interval. The safe sequence is:

1. Generate the new token outside Git.
2. Configure both active relays with `old,new` and restart them.
3. Update the authorized client deployment with the new token.
4. Run the authenticated E2E check using only the new token.
5. After old clients have migrated, remove the old token from both relays and
   restart them.
6. Confirm logs and deployment records do not contain either token.

For this rollout, token rotation remains a manual final action after the
repository work and deployment verification are complete.

## Activating `na2`

Do not mark `na2` active until all of the following are true:

- [ ] A provider, region and deployment method are selected.
- [ ] DNS, firewall and TLS issuance are verified independently.
- [ ] The same relay image policy and access-control policy are deployed.
- [ ] Health, metrics and authenticated E2E checks pass.
- [ ] The client relay set is coordinated for the additional URL.
- [ ] The public status page is updated from Planned to Active.
