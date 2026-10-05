# WebAppX agent instructions

Start at `.SYSTEMX/START-HERE.md` and inspect `.SYSTEMX/INSTALLATION.json`.
Follow the selected release's STANDARD and START-HERE for shared tooling;
read project records from the outer `.SYSTEMX`. Read `docs/SYSTEMX-INTEGRATION.md`
before changing installation or import behavior.

Preserve the React/Vite/Firebase app, LAN builder/session controls, production
and brand kits, setup workflows, both research packages and their checksums.
Managed release snapshots are immutable and retain upstream fingerprints.
Keep reusable context, plan, task and memory seeds blank; test active workflows
in temporary copies. Preserve downstream records during upstream imports.

Use argument arrays for child processes. Keep secrets, runtime state and local
paths outside tracked release files. Support macOS Apple Silicon, Windows x64
and ARM64; do not introduce case-insensitive file/directory collisions.

Before publishing, run `npm run ci:all` and
`npm run deploy -- hosting --preflight`. Production deployment requires explicit
operator authorization. Run `npm run sync:system:check` to detect host drift.
Use `npm run template:check` before copying this reusable template into a mirror.
Agent 0 owns integration; delegation requires user/environment authorization.
