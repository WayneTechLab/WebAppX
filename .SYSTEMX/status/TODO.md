# TODO — WebApp Stack G One Point Zero

Backlog for the generic template. Check items off or move to
[IN_PROGRESS.md](IN_PROGRESS.md) → [DONE.md](DONE.md).

## Next up

### LAN Builder Designer Wave 0

- [x] Repair Wiki command/path/version claims listed in
      `.SYSTEMX/LAN/Research/LAN-Builder/planning/WIKI-REPAIR-MATRIX.csv`.
- [x] Generate a test-backed capability manifest from the active LAN
      characterization results. Command truth remains the `package.json` script
      table and the WSG-MENU/bash entry points.
- [x] Add characterization coverage for host/origin/session/path/secret,
      read-model, write-confirmation, and public-isolation behavior.
- [x] Review the nine draft Designer schemas and record accepted/rejected
      decisions before making them canonical.
- [x] Produce the Wave 0 evidence packet. Wave 1 is now the next planned
      milestone and remains unstarted until the owner approves kernel work.

- [ ] Build the SYSTEMX LAN read-only operations bridge: typed action registry,
      humanized run states, sanitized results, and last-deploy read model
- [ ] Add start-of-day and end-of-day checkpoints for Agent 0 missions, waves,
      subagent handoffs, owned processes, and unresolved blockers
- [ ] Wire LAN tool actions for `typecheck`, `lint`, `build`, security checks,
      provider preflight, and deploy dry-run through an allowlisted action
      registry with cancellation and sanitized streamed output
- [ ] Add LAN UI read models for last build, last deploy preflight, last
      backup, last source save, current blockers, and rollback handoff
- [ ] Convert the browser geometry matrix for 1440, 1280, 1024, 768, and 640
      pixel workspaces into a repeatable local Playwright test command
- [ ] Add a guarded source-to-component extraction writer that converts an
      inspected DOM selection into reviewed React/TypeScript source; G1 only
      stages metadata and never rewrites JSX from browser DOM automatically
- [ ] Add a typed nested-content editor for rich text, child spans, icons,
      expressions, localization keys, and CMS bindings; G1 inline editing is
      intentionally limited to safe leaf-text elements
- [ ] Add emulator-backed Firebase Auth seed/export controls and trusted claim
      issuance for disposable Level 4/5 local staff fixtures

## Backlog

- [ ] Add a Vitest + Playwright scaffold to `starter/` (currently playbook-only, Step 10)
- [ ] Add an optional `functions/` skeleton to `starter/` for projects that want it (Step 06)
- [ ] Provide a Firebase deploy example wired to `deploy.sh` (Step 09)
- [ ] Linux/WSL auto-install path in `bootstrap.sh` (currently prints guidance)
- [ ] Optional Sentry wiring in the starter (`VITE_SENTRY_DSN`)
- [ ] `setup-secrets.sh` helper to push repo/local secret guidance (gated)
- [ ] Preview-channel deploy helper (`firebase hosting:channel:deploy`)

## Future

- [ ] Generation 1.1: evaluate alternate hosts (Cloud Run / static) as a module
- [ ] i18n + PWA optional modules in the playbook
- [ ] SYSTEMX LAN builder Wave 3: Firestore/Storage emulator-backed CMS/data
      plane and seed/export/import controls (Auth email/password is now G1)
- [ ] SYSTEMX LAN co-management Wave 3: TypeScript, lint, test, build, audit,
      security, and provider-preflight action runner
- [ ] SYSTEMX LAN builder Wave 4: Firebase SQL Connect / Cloud SQL relational
      data module and source-to-node round-trip writer
- [ ] SYSTEMX LAN co-management Wave 4: controlled backend editing for
      Functions, rules, SQL Connect, and provider configuration with validators
- [ ] SYSTEMX LAN builder Wave 5: scoped Drive, Cloud Storage, and GCloud
      document/asset sync with conflict review
- [ ] SYSTEMX LAN builder Wave 6: component variants, loops, forms, command
      palette, role gates, audit timeline, publish preflight, and rollback UI
- [ ] SYSTEMX LAN builder Wave 6: reviewed ingest manifest to adapter plan,
      backup-first bridge installation, and source-to-node round-trip controls
- [ ] SYSTEMX LAN co-management Wave 6: deploy evidence, rollback handoff,
      release record, and explicit connection to the existing deploy authority

Detailed contract: [SYSTEMX LAN Co-Management Control Plane](../LAN/CONTROL-PLANE-PLAN.md).
