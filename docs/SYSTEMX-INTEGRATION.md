# Managed SYSTEMX in the unified webapp template

This repository is Wayne Tech Lab's public webapp integration template, version
3.1.0. It consumes the public [dotSYSTEMX](https://github.com/WayneTechLab/dotSYSTEMX)
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
The first adopted standalone version is 1.8.6-alpha.1. Upstream is alpha; review
changes before selecting a new release. Do not edit snapshots or regenerate their
manifests to hide modifications. A changed distribution needs a new upstream version.
The root `VERSION` is an initial seed, preserved by the upstream installer.

## Updating public standalone, then importing here

1. Finish and validate the standalone project in its own repository. Commit and
   publish its new version/manifest to public `main` under its release process.
2. Keep the standalone checkout clean and synced with public `main`.
3. In this template checkout, preview the import:

   ```bash
   npm run systemx:upstream:check
   # Explicit source location works on other computers too:
   python3 -B scripts/sync-systemx.py --source "/path/to/dotSYSTEMX"
   ```

4. Review added/preserved paths and release notes, then apply:

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

Preview leaves the target untouched. Apply uses the upstream manager to append
verified snapshots and create missing outer files, temporarily unpins for the
requested import, then pins the selected release again. Existing records and
custom extensions survive. A failed update re-pins the previous selected version.
Same-version content changes, conflicting files and downgrades are rejected.
Repeated identical imports retain the original provenance receipt.
After reconciling host documentation, use `npm run wiki:check` and
`npm run wiki:sync` to publish this checkout's versioned wiki pages.

Current universal documentation, examples, MEDIA library, multi-project support
and tools are available in the selected release. Root instructional copies can
be older or customized. Follow the selected release's START-HERE and STANDARD
while reading project records from the outer folder. Reconcile host entry points
when upstream behavior changes; additive import cannot infer application migrations.

## Command and menu map

| Intent | Command |
| --- | --- |
| Full webapp lifecycle menu | `bash .SYSTEMX/WSG-MENU.sh` |
| Standalone records/tools menu | `npm run systemx -- menu` or WSG menu option 12 |
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

## Adoption and identical mirrors

Use [the adoption example](examples/private-template-adoption.md) for a new app.
Project context, task ledgers, focus and agent memory ship as blank seeds.
Configure `.SYSTEMX/project.json` and record your own accepted project work.
The imported distribution and host extensions share one checkout, but their
versions and update responsibilities remain independent.

Both template repositories use the same tracked release tree. Preview a mirror
update with `python3 scripts/sync-template.py --target /path/to/mirror`; use
`--apply` only after reviewing it. This requires clean source/target checkouts,
valid public template seeds, and the target's reviewed current branch. It copies
tracked files only, preserves `.git` and local-only files, refuses untracked
collisions, and never commits or pushes. Verify parity with
`npm run template:check -- --against /path/to/mirror` after committing both trees.

Historical receipts and populated maintenance records remain in private Git
history. The shared reusable tree includes reviewed provenance instead of those
records. See [the release feature map](UNIFIED-TEMPLATE.md).

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
