# Unified template 3.2.0

WebAppX retains the reviewed webapp, LAN, setup and kit features and incorporates
the latest reviewed standalone SYSTEMX through a managed import. Its Git history
and project identity are independent of the original input repositories.
Project records are blank adoption seeds. No private mirror is configured.

## Reviewed inputs

| Source | Exact baseline | Role |
| --- | --- | --- |
| Public SFWA-WTL-TEMPLATE | c3e2272efe7d9fe3fde1add3144aab3ec6e487c4 | Webapp, LAN and original Webflow research |
| Private webapp-stack-g1 | 2d3d5afa02db66a19ff55b755deec22771bea05a | Newer integration, dependencies, sanitized kits and LAN Builder research |
| Public dotSYSTEMX | aba9620ac07c9fe27572fd37ba80df8d1deeded4 | Selected 1.9.0-alpha.5 operating tools and managed defaults |

The selected distribution manifest fingerprint is
`483e564855c8f3ecd9255a06fdb7994a0df85cc23fa3a531ecd638746378cd37`.
The earlier 1.8.6-alpha.1 import and its immutable snapshot remain retained.

## Included capabilities

| Area | Entry point | Scope |
| --- | --- | --- |
| Webapp | `src/`, `npm run dev` | React/TypeScript/Vite/Tailwind, Firebase Auth/account levels and app routes |
| Managed SYSTEMX | `.SYSTEMX/SYSTEMX.sh` | Context, tasks/dependencies, project memory, child workspaces, releases and lifecycle |
| Agent mesh | `.SYSTEMX/AI/`, `.SYSTEMX/AGENTS/` | Agent 0 coordination, bounded worker packets and tool/connector/recovery contracts |
| Standard roles | SYSTEMX `roles-init` | Explicit Agent X events, optional Agent Y CLI handoffs and Agent Z fixed-question reviews |
| Access and source boundaries | `GLOBAL/ACCESS-MATRIX.md`, `PLAN/MAP.md` in the selected scope | Blank reviewed-access and source-navigation records; no permission grants or duplicate task authority |
| CLI and project routing | SYSTEMX `tools-guide`; installed CLI `projects --target OUTER -- ...` | Selected verified tools, explicit `.SYSTEMXP` scope and offline defaults |
| Local LAN | `npm run dev:systemx` | Owned sessions, available loopback ports, dashboard, fixtures and guarded source writes |
| Builder scope | `.SYSTEMX/LAN/Builder/contracts/capability-manifest.json` | Implemented/guarded/planned capability distinctions |
| Setup/deploy | `.SYSTEMX/WSG-MENU.sh` | Guided setup, packets, Firebase tooling, quality and explicit deployment |
| Kits | `.SYSTEMX/KIT/` | Reusable brand and production assets with sanitized examples |
| Research | `.SYSTEMX/LAN/Research/` | Original Webflow research and adapted LAN-Builder corpus, with checksums and retained original provenance |
| Upstream updates | `scripts/sync-systemx.py` | Preview, exact stock bootstrap backups/refresh, additive verified import and pinned immutable snapshots |
| Optional mirror tooling | `scripts/sync-template.py` | Separately authorized tracked-file preview/apply with collision refusal |

The public Webflow research inventory was repaired after finding 16 references
to pre-packaging paths. Its original manifest/checksum list remains alongside
the current packaged inventory. The LAN-Builder inventory is unchanged.

The upstream alpha tooling is included as reviewed, with its original license and
manifest. Schema 2 hashes binary media and unknown files byte for byte while
preserving reviewed text newline equivalence; historical snapshots keep their
original fingerprints. Existing downstream records and host extensions survive
imports. Recognized root bootstrap changes are explicitly backed up before
replacement; customized bootstraps stop the import for review.

Only Agent 0 is seeded in the registry. Agent Y activation, provider selection
and branch/PR policy belong to an adopted task. Role records do not start workers,
and draft PRs do not establish acceptance or merge authority. Event records do
not install a scheduler. Native Windows Agent Y execution remains unavailable
until descendant-process termination is verified; core record and PowerShell
tools remain available. Local macOS verification does not establish Windows
x64/ARM64 runtime or Firebase deployment acceptance.

## Release checks

The [3.2.0 validation receipt](VALIDATION-3.2.0.md) records the completed local
gates, preservation checks and platform limits for this integration.

`npm run ci:all` covers blank seed validation, selected snapshot integrity,
research checksums, governance, standalone tools, import/mirror regressions,
types, lint, LAN characterization, strict dependency audit and app build isolation.
`npm run deploy -- hosting --preflight` exercises the retained deployment gates
without publishing to hosting. Run those gates before publishing a new host
release. The [3.1.0 validation receipt](VALIDATION-3.1.0.md) remains evidence for
its original baseline. For a separately authorized mirror, compare committed
trees with `template:check --against`; no current mirror parity is asserted.
