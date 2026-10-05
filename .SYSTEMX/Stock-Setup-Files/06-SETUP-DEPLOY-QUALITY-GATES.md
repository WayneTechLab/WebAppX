# 06 Setup, Deploy, And Quality Gates

Use this order for scratch-to-production setup.

## Setup Order

1. Sync repo and verify branch/remotes.
2. Login to GitHub, Google/GCloud, Firebase, and optional providers.
3. Select stack mode, then edition.
4. Fill `.SYSTEMX/Unified-Setup-Process/intake/*.md`.
5. Re-inject `06-AI-REINJECTION-PROMPT.md` into the AI/code tooling session.
6. Resolve modules.
7. Configure Firebase, env, rules, secrets, sender provider, and optional
   Stripe/Functions.
8. Apply account levels and Unified Login.
9. Run gates.
10. Deploy production.
11. Update status, version history, runbooks, and next actions.

## Local Gates

```bash
npm run sync:system:check
npm run ci:lint
npm run ci:typecheck
npm run ci:test
npm run ci:security
npm run ci:build
```

## Deploy Gates

```bash
bash .SYSTEMX/scripts/deploy.sh --check
bash .SYSTEMX/scripts/deploy.sh --preflight
bash .SYSTEMX/scripts/deploy.sh hosting --dry-run
bash .SYSTEMX/scripts/deploy.sh rules
bash .SYSTEMX/scripts/deploy.sh app --fast
```

## Production Definition Of Done

- App builds.
- Security check passes with no failures.
- Account-level standard check passes.
- Firebase rules are deny-by-default.
- `.SYSTEMX` sync check has no drift.
- Root and starter are aligned.
- Wiki and `.SYSTEMX` docs match.
- No live secrets are committed.
