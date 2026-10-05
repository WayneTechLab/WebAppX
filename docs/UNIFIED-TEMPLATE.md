# Unified template 3.1.0

This owner-authorized release combines features from the public webapp, its
private integration counterpart, and the latest reviewed standalone SYSTEMX.
Both webapp repositories ship identical tracked files. Their existing Git
histories are retained independently; private Git history is not imported into
the public repository. Project records are blank adoption seeds.

## Reviewed inputs

| Source | Exact baseline | Role |
| --- | --- | --- |
| Public SFWA-WTL-TEMPLATE | c3e2272efe7d9fe3fde1add3144aab3ec6e487c4 | Webapp, LAN and original Webflow research |
| Private webapp-stack-g1 | 2d3d5afa02db66a19ff55b755deec22771bea05a | Newer integration, dependencies, sanitized kits and LAN Builder research |
| Public dotSYSTEMX | b69801848a4f7b990c4ab4380bf435f37671e13a | Verified 1.8.6-alpha.1 operating tools and managed defaults |

## Included capabilities

| Area | Entry point | Scope |
| --- | --- | --- |
| Webapp | `src/`, `npm run dev` | React/TypeScript/Vite/Tailwind, Firebase Auth/account levels and app routes |
| Managed SYSTEMX | `.SYSTEMX/SYSTEMX.sh` | Context, tasks/dependencies, project memory, child workspaces, releases and lifecycle |
| Agent mesh | `.SYSTEMX/AI/`, `.SYSTEMX/AGENTS/` | Agent 0 coordination, bounded worker packets and tool/connector/recovery contracts |
| Events and reviews | SYSTEMX `roles-init` | Explicit Agent X event tracking and Agent Z fixed-question reviews |
| Local LAN | `npm run dev:systemx` | Owned sessions, available loopback ports, dashboard, fixtures and guarded source writes |
| Builder scope | `.SYSTEMX/LAN/Builder/contracts/capability-manifest.json` | Implemented/guarded/planned capability distinctions |
| Setup/deploy | `.SYSTEMX/WSG-MENU.sh` | Guided setup, packets, Firebase tooling, quality and explicit deployment |
| Kits | `.SYSTEMX/KIT/` | Reusable brand and production assets with sanitized examples |
| Research | `.SYSTEMX/LAN/Research/` | Original Webflow research and adapted LAN-Builder corpus, with checksums and retained original provenance |
| Upstream updates | `scripts/sync-systemx.py` | Read-only preview, explicit verified import, pinned immutable snapshots |
| Mirror parity | `scripts/sync-template.py` | Clean tracked-file preview/apply with collision refusal and no Git publication |

The public Webflow research inventory was repaired after finding 16 references
to pre-packaging paths. Its original manifest/checksum list remains alongside
the current packaged inventory. The LAN-Builder inventory is unchanged.

The upstream alpha tooling is included as reviewed, with its original license and
manifest. Planning documents are not implemented editor features. Agent records
do not start workers, and event records do not install a scheduler. Accumulated
project memory is not model training. App source validation is separate from
Firebase configuration, deployment and live production acceptance.

## Release checks

`npm run ci:all` covers blank seed validation, selected snapshot integrity,
research checksums, governance, standalone tools, import/mirror regressions,
types, lint, LAN characterization, strict dependency audit and app build isolation.
`npm run deploy -- hosting --preflight` exercises the retained deployment gates
without publishing to hosting. Repositories can have different commit IDs while
sharing exactly the same Git tree; verify with `template:check --against`.
