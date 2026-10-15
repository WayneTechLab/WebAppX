# Unified template command reference

Run from the repository root. Use `npm ci` for the committed lockfile.

## Developer prerequisites and browser smoke

| Command | Behavior |
| --- | --- |
| `npm run doctor` | Dependency-free, read-only installed-version report for Node.js, npm, Git and Python |
| `npm run --silent doctor -- --json` | Same report as machine-readable JSON without npm command headers |
| `node scripts/developer-prerequisites.mjs` | Direct dependency-free report when diagnosing a missing npm executable |
| `npm run browser:install` | Explicit Chromium download for exact pinned Playwright 1.64.1; run after `npm ci` |
| `npm run browser:smoke` | Owned loopback Vite server and fresh Chromium context; named seed/hash/totals, HR/CMS/CRM UI changes, reload persistence and complete export comparisons |
| `npm run browser:smoke -- --headed` | Run the same checks with a visible Chromium window |
| `npm run browser:smoke -- --output /path/to/local/artifacts` | Create a fresh artifact directory under the chosen parent |

The doctor requires Node.js >=24.0.0 and Python >=3.12.0; npm/Git must be present
with parseable versions, without a specified minimum. It installs nothing and
does not establish platform runtime readiness. The smoke needs no accounts,
provider credentials or emulators. It never auto-downloads browsers, reuses a
user's browser saves or stops unrelated listeners. A missing Chromium install
fails with the explicit install instruction. Report/screenshots/trace paths are
printed in temporary storage; cleanup owns only the command's server and browser.
See [Getting Started](GETTING-STARTED.md#developer-check-and-browser-smoke) and
the [QA receipt](DEVELOPER-BROWSER-QA-2026-10-14.md).
Observed local verification passed 18 doctor cases, 16 seed/runner cases and
seven authored browser checks with successful browser/server cleanup. Final
publication-gate outcomes are recorded in the receipt.

## App and local session

| Command | Behavior |
| --- | --- |
| `npm run dev` | Vite webapp only; use its printed URL |
| `npm run dev:systemx` | Owned app + LAN + Firebase emulator session with available loopback ports |
| `npm run dev:firebase` | Alias for the integrated local session |
| `npm run systemx:lan` | Direct LAN service only |
| `npm run systemx:session:status` | Read current session ownership and URLs |
| `npm run systemx:session:stop` | Stop only owned session processes |
| `npm run build` | TypeScript/Vite build plus LAN artifact-isolation check |
| `npm run preview` | Preview the built app |

## Gusto and HR previews

| Command or route | Behavior |
| --- | --- |
| `npm run dev` then `/hr/demo` | Synthetic HR portals and app-owned actions; saved domain changes survive refresh when browser storage is available |
| `/hr/demo/sdk` under Vite development | Genuine Gusto SDK 0.56.6 directory reads against local fixtures; no provider credentials or writes |
| `npm run hr:test` | Synthetic HR workflows, local SDK request/response contract and backend authorization/projection tests |
| `npm run hr:backend:audit` | Dependency audit for the isolated optional Gusto Firebase functions package |

Read [Gusto setup](GUSTO-SETUP.md) and
[HR and employee management](../wiki/Gusto-HR-and-Employee-Management.md).
The development SDK mock is absent from Hosting and `npm run preview`.
Protected connected portals remain unconfigured, and the optional backend is
disabled by default. These previews and tests do not establish full SDK workflow
coverage, live provider access or payroll execution.

## Managed SYSTEMX and agent coordination

| Command | Behavior |
| --- | --- |
| `npm run systemx -- menu` | Managed tooling menu; WSG menu option 12 opens the same tools |
| `npm run systemx -- tools-guide` | Selected CLI/tools, Python API and explicit child-scope guide |
| `npm run systemx:status` | Selected release, pin/update policy and immutable integrity |
| `npm run systemx:validate` | Validate outer project records and generated work views |
| `npm run systemx:context` | Bounded Agent 0 resume packet |
| `npm run systemx -- status` | Recorded task counts; separate from installation status |
| `npm run systemx -- projects list` | Registered child-project scopes |
| `npm run systemx -- roles-init` | Preview optional Agent X/Y/Z role initialization; no provider starts |
| `npm run systemx -- agent-y providers` | Read installed CLI availability without executing a task |
| `npm run systemx:upstream:check` | Read-only preview against reviewed dotSYSTEMX public main |
| `npm run systemx:upstream:import` | Back up/refresh recognized stock bootstraps, append defaults and pin; preserve adopted records |

Set `WTL_SYSTEMX_SOURCE` or use `python3 -B scripts/sync-systemx.py --source
/path/to/dotSYSTEMX` when the standalone checkout lives elsewhere. Installation
status is not task status, and registered roles are not observed worker processes.
Add `-- --expected-commit <reviewed-public-main-sha>` to the npm upstream
preview/import commands to require the exact reviewed source revision.
Current defaults are 1.9.0-alpha.6. The registry seeds only Agent 0; an adopted
project must activate optional roles and select Agent Y's provider, task scope
and branch/PR policy explicitly. A draft PR does not establish task acceptance.

With a separately installed current SYSTEMX CLI, route children from the outer
directory with explicit scope:

```bash
systemx projects --target "/path/to/workspace" -- list
systemx projects --target "/path/to/workspace" -- context --project NAME --agent agent.0
```

This uses verified selected defaults and is offline by default. The folder
launcher also supports `npm run systemx -- projects context --project NAME --agent agent.0`.

The managed launchers are `bash .SYSTEMX/SYSTEMX.sh <command>` and
`.\.SYSTEMX\SYSTEMX.ps1 <command>` in PowerShell. The legacy WSG menu and
full template gate use Bash; Node-based app/LAN commands remain separate.
Native Windows Agent Y `run --apply` fails closed pending verified descendant
process termination. Core PowerShell commands and role/job previews remain
available. macOS checks alone do not prove Windows x64/ARM64 runtime acceptance.

## Validation and maintenance

### WebAppX improvement backlog

| Command | Scope |
| --- | --- |
| `npm run backlog:summary` | Counts for the stable 1,000-item catalog by completion state, area, priority, phase and gate |
| `npm run backlog -- --area mock-recovery --priority P1 --limit 10` | Read a bounded group of proposals |
| `npm run backlog -- --id WX-0151` | Inspect one proposal's acceptance, source and dependencies |
| `npm run backlog:render` | Regenerate Markdown/CSV from the canonical JSON catalog |
| `npm run backlog:check` | Validate count, identities, sources, dependencies and generated-view parity |
| `npm run backlog:test` | Catalog metadata, invalid-input and query regression tests |

The [roadmap](WEBAPPX-ROADMAP.md) is planning data. These commands leave the
blank reusable SYSTEMX task/context/plan/memory records intact and do not start
agents or provider operations. Verified completed entries retain their stable
IDs and link completion evidence; unstarted entries remain proposals. Inspect
the first P1 portal follow-up with `npm run backlog -- --id WX-0051` and
`npm run backlog -- --id WX-0451`.
Both entries remain completed with evidence, joined by **WX-0001, WX-0651 and
WX-0652**. The catalog contains exactly **1,000 records**, with **five completed
and 995 remaining: 162 P1, 675 P2 and 158 P3**.

### Repository gates

| Command | Scope |
| --- | --- |
| `npm run ci:lint` / `npm run ci:typecheck` | App source quality |
| `npm test` | Local LAN characterization and managed-status contract |
| `npm run ci:audit` | Strict dependency audit |
| `npm run docs:links` | Local Markdown/wiki links, including managed distribution docs |
| `npm run research:validate` | Adapted LAN-Builder package integrity |
| `npm run sync:system:check` | Host versions, generated metadata and menu drift |
| `npm run systemx:tools:test` | Test the selected immutable standalone distribution |
| `npm run systemx:integration:test` | Import preservation and reusable-template mirror regressions |
| `npm run template:check` | Blank template seeds, snapshots, versions and both research inventories |
| `npm run ci:all` | Complete reusable-template release gate, including doctor regressions, seed checks and browser smoke; requires blank seeds and explicitly installed Chromium |
| `npm run deploy -- hosting --preflight` | Deployment gates without commit, push or hosting deployment |
| `npm run wiki:check` / `npm run wiki:sync` | Preview / publish checked-in pages to this checkout's GitHub wiki |

For adopted applications, configure appropriate checks in `.SYSTEMX/project.json`.
The template's blank-seed release checks are for maintaining the reusable template.

## Optional template mirrors

WebAppX has no configured private mirror. Use this workflow only for a separately
selected reusable template target.

```bash
# Preview changes from this clean, committed source:
python3 -B scripts/sync-template.py --target /path/to/template-mirror
# Explicitly apply the reviewed tracked-file changes:
python3 -B scripts/sync-template.py --target /path/to/template-mirror --apply
# After reviewing and committing the target, verify exact parity:
npm run template:check -- --against /path/to/template-mirror
```

The mirror tool preserves `.git` and local-only files, refuses dirty checkouts,
ignored/untracked collisions and file/directory transitions, and validates the
source's blank seeds before writing. It does not commit, push, sync a wiki, or
merge active application records. See [template maintenance](TEMPLATE-MAINTENANCE.md).

## Security regression checks

`npm run security:controls:test` runs the operational regressions and is included in `ci:all`. `npm run security:rules:test` requires isolated loopback Firebase Auth/Firestore emulators for `demo-systemx`. See [Security Review](SECURITY-REVIEW.md) for supported secret keys and account administration.
