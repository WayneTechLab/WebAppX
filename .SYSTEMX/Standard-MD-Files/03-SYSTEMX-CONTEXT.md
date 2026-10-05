# 03 SYSTEMX Context

`.SYSTEMX` is the operational control layer for Web Stack Generation.

## Required Surfaces

- `.SYSTEMX/WSG-MENU.sh`: operator menu.
- `.SYSTEMX/wsg-agi.sh`: governance and sync checker.
- `.SYSTEMX/scripts/`: bootstrap, deploy, quality, security, setup helpers.
- `.SYSTEMX/Unified-Setup-Process/`: edition-aware setup system.
- `.SYSTEMX/Template/`: legacy golden-path setup and starter copy.
- `.SYSTEMX/docs/`: runbooks, monitoring, secrets standards.
- `.SYSTEMX/deploy/`: canary, MFA, storage, alerting policies.
- `.SYSTEMX/status/`: TODO, in-progress, done history.
- `.SYSTEMX/version/`: version and changelog.
- `.SYSTEMX/Standard-MD-Files/`: LLM copy packet, including design, media,
  content, accessibility, and brand standards.

## Operating Model

The root app is the runnable product starter. `.SYSTEMX` is how the starter is
configured, checked, deployed, versioned, and handed off.

When updating behavior:

- Update scripts and docs together.
- Keep root app and starter aligned.
- Keep checks non-mutating unless the command clearly says it writes.
- Keep production deploy behind preflight/security gates.
- Record new standards in `.SYSTEMX`, then mirror public guidance in `wiki/`.

## Important Commands

```bash
npm run sync:system:check
npm run ci:lint
npm run ci:typecheck
npm run ci:test
npm run ci:security
npm run ci:build
bash .SYSTEMX/scripts/deploy.sh --preflight
```
