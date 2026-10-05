# WebApp Stack G1 Runbook

This runbook is the operator checklist for projects created from the template.
Keep project-specific incident details in the downstream app, not in this base
template.

## Daily Checks

- Run `npm run sync:system:check` before deploys.
- Run `bash .SYSTEMX/scripts/quality-check.sh` before merging release work.
- Run `npm run ci:security` when Firebase rules, environment wiring, or
  deployment settings change.
- Confirm `.env.local` and `.secrets.env` are present only on trusted machines.

## Deploy

1. Confirm the working tree is intentional with `git status`.
2. Run `bash .SYSTEMX/scripts/deploy.sh --preflight`.
3. Run `bash .SYSTEMX/scripts/deploy.sh`.
4. Verify the Firebase Hosting URL and any configured smoke checks.
5. Record follow-up work in `.SYSTEMX/status/TODO.md`.

## Incident Response

- Roll back Hosting from the Firebase console or redeploy the last known good
  commit.
- Revoke exposed API keys or tokens immediately.
- Rotate `.secrets.env` values and any matching hosted secrets.
- Keep the public issue tracker free of secret values and exploit details.

## Recovery

- Re-run `bash .SYSTEMX/scripts/bootstrap.sh --check`.
- Re-run `npm ci` if dependency state is suspect.
- Re-run `npm run sync:system` to restore managed `.SYSTEMX` surfaces.
