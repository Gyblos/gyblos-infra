## Summary

<!-- What changed and why? -->

## Validation

- [ ] `sh scripts/check.sh`
- [ ] Relevant manual checks are described below.
- [ ] Any production E2E used an explicit `RELAY_URL` and an environment-only
      token; it was not run from CI.

## Security and secrets

- [ ] No tokens, credentials, `.env` files, private keys, certificates or
      certificate backups are included.
- [ ] Any deployment-only value is injected through the environment or the
      deployment platform.

## Operational impact

- Affected relay or deployment variant:
- Expected impact:
- Rollback path:

## Documentation

- [ ] Relevant documentation was updated.
- [ ] No topology status was changed without a verified deployment.
