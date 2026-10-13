# Managed SYSTEMX in the unified webapp template

This repository is Wayne Tech Lab's public webapp integration template, version
3.2.0. It consumes the public [dotSYSTEMX](https://github.com/WayneTechLab/dotSYSTEMX)
operating standard while retaining its React/Vite/Firebase app, local LAN builder,
production kits and sanitized examples. It combines the public webapp and private integration features in a reusable release.

## Ownership and versions

| Content | Owner and update rule |
| --- | --- |
| `.SYSTEMX/.systemx/releases/<version>/` | Complete verified standalone distribution; immutable per version |
| `.SYSTEMX/INSTALLATION.json` | Upstream manager selects defaults; imports end pinned with manual updates |
| `.SYSTEMX/GLOBAL`, `PLAN`, `WORK`, `MEMORY`, `AGENTS`, `project.json` | Adopted project records and configured commands; preserved across imports |
| `.SYSTEMX/LAN`, `KIT`, `Template`, setup, deploy and hooks | Host webapp extensions; existing files retained and separately maintained |
| Outer `.SYSTEMX/README.md`, `WSG-MENU.sh`, legacy `docs`/`AI` overlaps | Host entry points, reconciled explicitly; selected release holds current universal guidance |
| `.SYSTEMX/imports/<version>.json` | Public repository, exact commit and manifest fingerprint for each import |
| Root and starter package versions, `.SYSTEMX/webapp-version/` | Webapp release version; independent of standalone version |
| `.SYSTEMX/status/` | Retained LAN feature roadmap/history, not the integration task authority |

`npm run systemx:status` reports the authoritative selected defaults and integrity.
The selected release is **1.9.0-alpha.5**, imported from public main
`aba9620ac07c9fe27572fd37ba80df8d1deeded4` with distribution manifest SHA-256
`483e564855c8f3ecd9255a06fdb7994a0df85cc23fa3a531ecd638746378cd37`.
The original 1.8.6-alpha.1 snapshot remains retained. Upstream is alpha; review
changes before selecting a new release. Do not edit snapshots or regenerate their
manifests to hide modifications. A changed distribution needs a new upstream version.
The root `VERSION` is an initial seed, preserved by the upstream installer.

## Current standalone capabilities

The selected defaults add optional Agent Y CLI work under Agent 0, explicit
installed-CLI child routing, the `tools-guide` command, and blank access matrix
and project map records for root and `.SYSTEMXP` scopes. Agent X records events;
Agent Z reviews evidence. The public registry still seeds only Agent 0. Adopted
projects activate supported roles deliberately and select Agent Y's installed
provider, task scope, repository/base, allowed paths and branch/PR policy per task.
A provider exit or draft PR does not accept work or grant merge authority.
Use [Agent Y New App Setup](Agent-Y-New-App-Setup.md) for the adopted-app sequence:
configure project checks, preview/apply X/Y/Z roles, verify ignored private paths,
commit the real task setup, then prepare/run a bounded CLI handoff. The examples
keep results local unless a task explicitly opts into a draft PR.

Manifest schema 2 retains LF/CRLF equivalence for reviewed text formats and
hashes media and unknown files byte for byte. Historical schema 1 snapshots
keep their original manifest contract and fingerprints. Current guidance and
new media live in the selected release; existing outer project files survive.

## Updating public standalone, then importing here

1. Finish and validate the standalone project in its own repository. Commit and
   publish its new version/manifest to public `main` under its release process.
2. Keep the standalone checkout clean and synced with public `main`.
3. In this template checkout, preview the import:

   ```bash
   npm run systemx:upstream:check
   # Explicit source location works on other computers too:
   python3 -B scripts/sync-systemx.py --source "/path/to/dotSYSTEMX"
   # Bind preview and apply to an exact reviewed public main revision:
   npm run systemx:upstream:check -- --expected-commit aba9620ac07c9fe27572fd37ba80df8d1deeded4
   ```

4. Review added/preserved paths, the stock bootstrap refresh plan and release
   notes, then apply:

   ```bash
   npm run systemx:upstream:import
   npm run systemx:status
   npm run systemx:validate
   npm run systemx:integration:test
   npm run systemx:check
   npm run build
   ```

The default local source is `$HOME/Documents/ChatGPT/dotSYSTEMX`; override with
`WTL_SYSTEMX_SOURCE` or `--source`. No absolute user path is required in project
configuration. The importer verifies source repository identity, a clean tracked
checkout and equality with live public `main`; it imports a Git archive of that
exact revision. It never fetches, pulls, commits or pushes the source repository.
A stale or dirty standalone checkout produces an actionable error.
The optional `--expected-commit` rejects a public-main revision different from
the reviewed commit; pass the same value to the apply command when pinning a review.

Preview leaves the target untouched. For a managed target, it also previews
the upstream manager's explicit `bootstrap-refresh` for eight stock manager and
launcher files. Only recognized bytes from the intended or intact retained
releases can be replaced; customized or missing historical files are conflicts.
Apply stores exact originals in ignored local `.systemx/history/` before
refreshing recognized bootstraps, then appends verified snapshots and creates
missing outer files. It temporarily unpins for the import and ends pinned with
manual updates. Existing records, custom extensions and original snapshots survive.
A failed update re-pins the currently selected version; bootstrap backups and
operation receipts remain available for reviewed recovery. Bootstrap replacement
is not automatically rolled back. The current manager can run a retained selected
1.8.6 release during migration but cannot newly select releases below 1.8.7-alpha.1.
The returned `bootstrapBackup` path is local evidence and stays outside the
tracked import receipt; that receipt stores bootstrap filenames and provenance.
Same-version content changes, conflicting files and downgrades are rejected.
Repeated identical imports retain the original provenance receipt.
After reconciling host documentation, use `npm run wiki:check` and
`npm run wiki:sync` to publish this checkout's versioned wiki pages.

Current universal documentation, examples, MEDIA library, multi-project support
and tools are available in the selected release. Root instructional copies can
be older or customized. Follow the selected release's START-HERE and STANDARD
while reading project records from the outer folder. Reconcile host entry points
when upstream behavior changes; additive import cannot infer application migrations.
This base-template refresh also reconciles recognized outer stock guidance and
tooling after checking equality with the retained original release. It preserves
custom host files and initial `VERSION`/`SOURCE` provenance. Ordinary downstream
imports continue to preserve existing records and custom outer defaults.

## Command and menu map

| Intent | Command |
| --- | --- |
| Full webapp lifecycle menu | `bash .SYSTEMX/WSG-MENU.sh` |
| Standalone records/tools menu | `npm run systemx -- menu` or WSG menu option 12 |
| Selected CLI/tools guide | `npm run systemx -- tools-guide` |
| Registered child records | `npm run systemx -- projects context --project NAME --agent agent.0` |
| Bounded project resume | `npm run systemx:context` |
| Canonical task status | `npm run systemx -- status` |
| Selected defaults/integrity | `npm run systemx:status` |
| Record and local-link validation | `npm run systemx:validate` |
| Configured host checks | `npm run systemx:check` |
| Build with LAN isolation | `npm run systemx -- build` |
| Inspect deployment plan | `npm run systemx -- deploy --dry-run` |
| Upstream import preview/apply | WSG Update menu options 8/9 |

Deployment remains an explicit host action using the retained Firebase scripts.
Importing defaults does not configure services, activate roles, start workers,
register child projects, enable scheduled updates, or prove production serving.

A separately installed current CLI supports
`systemx projects --target "/path/to/workspace" -- context --project NAME --agent agent.0`.
The target is the containing outer directory; select a registered child explicitly.
This routing uses verified managed defaults and is offline by default.

Core PowerShell launchers and record tools support Windows. Native Windows
Agent Y `run --apply` fails closed because descendant-process termination has
not been verified. Other Agent Y previews and inspections remain available.
Local macOS source/tool checks do not prove Windows x64/ARM64 runtime behavior
or a deployed Firebase environment; test those acceptance boundaries separately.

## Adoption and optional template mirrors

Use [the adoption example](https://github.com/WayneTechLab/WebAppX/blob/main/docs/examples/private-template-adoption.md) for a new app.
Project context, task ledgers, focus and agent memory ship as blank seeds.
Configure `.SYSTEMX/project.json` and record your own accepted project work.
The imported distribution and host extensions share one checkout, but their
versions and update responsibilities remain independent.

No private mirror is configured for WebAppX. For a separately authorized reusable
template mirror, preview with
`python3 scripts/sync-template.py --target /path/to/mirror`; use
`--apply` only after reviewing it. This requires clean source/target checkouts,
valid public template seeds, and the target's reviewed current branch. It copies
tracked files only, preserves `.git` and local-only files, refuses untracked
collisions, and never commits or pushes. Verify parity with
`npm run template:check -- --against /path/to/mirror` after committing both trees.

Historical source receipts remain provenance for their examined revisions.
The reusable tree carries blank records and reviewed import provenance. See
[the release feature map](https://github.com/WayneTechLab/WebAppX/blob/main/docs/UNIFIED-TEMPLATE.md) and the historical
[3.1.0 validation receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.1.0.md); that receipt does not validate 3.2.0.

## Dependency refresh

This host release uses Firebase 12.19.0 and a patched gRPC 1.x override
(`@grpc/grpc-js: ^1.14.5`) because Firebase's transitive dependency remained pinned
to a vulnerable older 1.x build. Root and starter manifests share the override.
Recheck upstream dependency constraints and audits during future host refreshes;
remove the override once the supplied Firebase dependency resolves safely without it.
The browser build and LAN characterization checks cover this local integration;
a deployed Firebase environment is a separate acceptance boundary.

The host version directory is named `webapp-version/` to avoid colliding with
standalone `VERSION` on case-insensitive macOS/Windows filesystems. The original
history was retained during that rename; deploy, hooks, menu and version scripts
use the new path.
