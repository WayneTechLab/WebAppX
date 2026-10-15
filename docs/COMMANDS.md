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
| `npm run browser:keyboard` | Isolated Chromium onboarding and selective restore/Undo journeys using real Tab traversal, Enter/Space, keyboard typing and visible-focus checks |
| `npm run browser:keyboard:test` | Focused guard checks for the keyboard driver |
| `npm run development:check` | Read-only root/starter runtime, public client environment coverage and ignored local environment-file contract check |
| `npm run development:test` | Focused runtime/environment contract regressions |
| `npm run browser:foundation` | Isolated portal cards, normalized routes, breadcrumbs, unsupported-page recovery and save-summary browser journey |

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

The keyboard journeys reuse the smoke runner's owned loopback server, clean
browser context, explicit Chromium setup and temporary artifacts. They do not
replace `browser:smoke`. User interactions use keyboard input; initial
navigation/reload and setting files in a keyboard-opened native chooser remain
explicit harness boundaries. Read the
[keyboard guide](TEMPLATE-PORTALS.md#keyboard-onboarding-and-recovery) and
[keyboard QA receipt](KEYBOARD-PORTALS-QA-2026-10-15.md). These checks do not
establish whole-site accessibility, screen-reader or OS-chooser acceptance.
The accepted keyboard run passed **nine browser checks** (three onboarding/six
recovery), **11 driver guard tests** and **16 existing seed/runner guard tests**.
It recorded 110 onboarding and 266 recovery focus observations. The keyboard
receipt records exact outputs, limitations and final publication gates.

The root and starter runtime pin is Node **24.22.0**, with the supported minimum
**>=24.0.0** and exact package-manager declaration **npm 11.11.0**. The development
contract check reads tracked source/examples and variable names; private `.env`
files and secret values stay outside its inputs. The foundation browser journey
uses the same owned server/cache and clean-context isolation as existing browser
commands. Its synthetic storage-fault cases are scoped evidence for visible
Recovered/Unavailable states. Read the
[foundation QA receipt](EXECUTION-FOUNDATION-QA-2026-10-15.md).
Accepted focused verification passed 15 contract tests, 14 mock-launcher tests,
eight planner tests, 14 catalog tests and 121 portal model tests. CI planning
passed 13 tests and reported all 34 stages with zero unknown classifications.
Nine foundation browser checks and nine existing keyboard checks passed; final
integrated gates remain recorded in the receipt.

## App and local session

| Command | Behavior |
| --- | --- |
| `npm run dev` | Vite webapp only; use its printed URL |
| `npm run dev:mock` | Owned native HR/CMS/CRM server on a free `127.0.0.1` port, with `.env` files and provider/emulator/LAN integrations disabled |
| `npm run dev:mock -- --port 5185` | Request a stable local origin; an occupied explicit port fails without stopping its listener |
| `npm run dev:mock:test` | Mock-launcher argument, environment, ownership and shutdown regressions |
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
| `npm run backlog:plan` | Read-only JSON execution report covering all 1,000 IDs, waves, priorities and remaining acceptance gates |
| `npm run backlog:ready` | Dependency-ready local candidates, ordered by priority, phase and stable ID |
| `npm run backlog:ready -- --gate all --priority P1 --limit 30` | Inspect a bounded selection across local/provider/operator gates; this does not grant readiness or access |
| `npm run backlog:graph -- --id WX-0654 --id WX-0551` | Read-only Mermaid view of selected dependency closure, longest chains and unresolved nonlocal criteria |
| `npm run backlog:plan:render` | Explicitly regenerate the host execution-plan Markdown from canonical statuses/evidence |
| `npm run backlog:plan:check` | Verify exact generated execution-plan parity without rewriting it |
| `npm run backlog:plan:test` | Dependency ordering, report modes and generated-plan regression tests |

The [roadmap](WEBAPPX-ROADMAP.md) is planning data. These commands leave the
blank reusable SYSTEMX task/context/plan/memory records intact and do not start
agents or provider operations. Verified completed entries retain their stable
IDs and link completion evidence; unfinished entries remain open work. Inspect
the first P1 portal follow-up with `npm run backlog -- --id WX-0051` and
`npm run backlog -- --id WX-0451`.
Those earlier entries remain completed with their evidence. The foundation wave
accepts 17 additional IDs; the catalog contains exactly **1,000 records**, with
**24 completed and 976 remaining: 146 P1, 673 P2 and 157 P3**. Remaining gates
are **808 local, 128 operator and 40 provider**.

The owner has authorized completing the entire catalog. The
[host execution plan](WEBAPPX-EXECUTION-PLAN.md) covers every original criterion
while reusable execution seeds remain blank. Plan/ready/graph commands inspect
local catalog data only; they do not dispatch agents, contact providers, apply
ledger records or accept work. Read each proposed item's source, acceptance,
write ownership and gate before acting. Canonical completion requires accepted
dependencies as well as evidence.

### Repository gates

| Command | Scope |
| --- | --- |
| `npm run ci:lint` / `npm run ci:typecheck` | App source quality |
| `npm run ci:plan` | Read actual CI stage order, dependent workspaces and reviewed mutation categories without running or weakening gates |
| `npm run --silent ci:plan -- --json` | Machine-readable CI plan without npm command headers |
| `npm run ci:plan:test` | Source parsing, delegation and unknown-behavior report regressions |
| `npm test` | Local LAN characterization and managed-status contract |
| `npm run ci:audit` | Strict dependency audit |
| `npm run docs:links` | Local Markdown/wiki links, including managed distribution docs |
| `npm run research:validate` | Adapted LAN-Builder package integrity |
| `npm run sync:system:check` | Host versions, generated metadata and menu drift |
| `npm run systemx:tools:test` | Test the selected immutable standalone distribution |
| `npm run systemx:integration:test` | Import preservation and reusable-template mirror regressions |
| `npm run template:check` | Blank template seeds, snapshots, versions and both research inventories |
| `npm run ci:all` | Complete reusable-template release gate, including doctor regressions, seed/keyboard guards and both browser journeys; requires blank seeds and explicitly installed Chromium |
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
