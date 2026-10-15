# Unified template command reference

Run from the repository root. Use `npm ci` for the committed lockfile.
Read [dependency installation](DEPENDENCY-INSTALLATION.md) for runtime selection
and root/starter versus optional Functions installation scopes.

## Evaluator guides and adoption rehearsals

| Command | Behavior |
| --- | --- |
| `npm run browser:evaluators` | Owned Chromium journeys for the four [human demonstrations](demos/HR-FIVE-MINUTE.md), actual downloads, CRM stage changes and CMS-only restore/Undo |
| `npm run hr:roles:check`; `npm run hr:roles:test` | Check generated [role examples](HR-ROLE-EXAMPLES.md) and independent fictional actor/relationship expectations |
| `npm run hr:roles:render` | Explicitly regenerate the role guide after reviewing canonical fixture changes; refuses stale source bindings |
| `npm run gusto:capabilities:check`; `npm run gusto:capabilities:test` | Check the authored [33-capability gap map](GUSTO-CAPABILITY-GAPS.md), actual mounted SDK exports and reviewed source fingerprints |
| `npm run gusto:capabilities:render` | Explicitly regenerate only the capability guide from reviewed data; no automatic fingerprint refresh |
| `npm run docs:freshness -- --to REV` | Read-only [guide/evidence relevance preview](DOCUMENTATION-FRESHNESS.md) for an explicit local committed revision; retains historical receipts |
| `npm run docs:freshness:test` | Temporary Git comparisons and deliberate append/locking/stale-input fixtures |
| `npm run systemx:import:rehearse -- --limit 25 --offset 0` | Apply an actual import in an owned fictional installation and report before/after fingerprints; no existing app target option |
| `npm run adoption:hr-disabled` | Capture public committed app blobs into an owned temporary CMS/CRM-only app, build it and exercise its actual browser flows |
| `npm run adoption:hr-disabled:test` | Adopted bundle compatibility, complete graph, prewrite refusal, rollback and interruption fixtures |
| `npm run worksheet:generate` | Optional ReportLab authoring command for the one-page [evaluator worksheet](PORTAL-EVALUATOR-WORKSHEET.md); not an app runtime or CI prerequisite |

Follow [import rehearsal](SYSTEMX-IMPORT-REHEARSAL.md),
[HR-disabled adoption](examples/hr-disabled-adoption.md), the
[recovery glossary](WORKSPACE-RECOVERY-GLOSSARY.md), proposed
[tenant membership](TENANT-MEMBERSHIP-PROPOSAL.md) and
[operations readiness](OPERATIONS-READINESS.md). The worksheet's exact browser
origin identifies the evaluator's saved-storage scope. Designed five/ten-minute
human pacing is separate from measured automated browser execution.

## Portal maturity checks

| Command | Behavior |
| --- | --- |
| `npm run maturity:test` | Focused model/codec tests for chosen payroll periods and fictional rates, time correction, selected-period statements, strict CRM imports, named history points, supported return locations, Undo source binding and pure record inspection/differences |
| `npm run browser:maturity` | Thirteen actual browser check groups across four fresh owned Chromium contexts, using real controls, file uploads/downloads and complete saved-state comparisons for the sixteen maturity criteria |

Follow [portal maturity workflows](PORTAL-MATURITY.md) for explicit payroll
period/rate setup, CMS field errors and dirty forms, CRM import refusal, named
history and return navigation. Fixture compensation supplies no implied hourly
rate. Manual capture and label changes write only restore history; inspection
and difference previews write no workspace or history state. Confirmed selective
restore or Undo replaces the selected complete workspaces and clears only those
modules' temporary UI. The [current QA receipt](PORTAL-MATURITY-QA-2026-10-15.md)
records focused results and the passed integrated publishing gates. These two
commands do not replace `ci:all` or Hosting preflight.

## Adopted work, provenance and source review

| Command | Behavior |
| --- | --- |
| `npm run backlog:adopt -- preview --help` | Inspect explicit app/scope, selection and locally committed catalog options; preview performs no writes |
| `npm run backlog:adopt -- apply --help` | Inspect the deliberate reviewed-plan TODO intake mode; apply requires exact target identity/scope and `--authorize-intake`, with stale/dependency checks |
| `npm run backlog:adopt:test` | Temporary root/child adoption, gate, preservation, permission and spawned CLI fixtures |
| `npm run backlog:impact -- --from REV --to REV --json` | Read-only committed revision comparison and bounded proposal review advisories; no fetch or canonical status change |
| `npm run backlog:impact:test` | Temporary Git-tree, metadata, path and refusal fixtures |
| `npm run systemx:provenance -- --path WORK/TASKS.json` | Exact outer path ownership and retained-content relation; stock equality never authorizes overwrite |
| `npm run systemx:provenance -- --limit 25` | Deterministic inventory page with continuation and exact global totals |
| `npm run systemx:provenance:test` | Synthetic retained-release ownership, equivalence, boundary and preservation fixtures |
| `npm run systemx:work-status:test` | Reusable work records, proposed roadmap and exact selected root/child read-model fixtures |
| `npm run browser:work-status` | Owned temporary LAN/Chromium fixture for source cards, explicit selection, unavailable facts and stale-response refusal |
| `npm run systemx:upstream:check -- --limit 25 --offset 0` | Versioned bounded JSON with exact public source, pin/selection, host-only preservation and complete conflict blocking; no import apply |

Use real locally available revisions in place of `REV`. Follow the
[adoption workflow](BACKLOG-ADOPTION.md), [rebaseline report](BACKLOG-REBASELINE.md),
[work-status contract](WORK-STATUS.md), [provenance guide](SYSTEMX-PROVENANCE.md)
and [upstream review](SYSTEMX-UPSTREAM-REVIEW.md). The
[adoption-foundations QA receipt](SYSTEMX-ADOPTION-QA-2026-10-15.md) records
examined source, actual fixtures, review fixes and integrated gates. TODO intake,
reported credentials, operator authority and execution remain separate facts.

## Operational evidence and lifecycle checks

| Command | Behavior |
| --- | --- |
| `npm run repository:identity` | Read-only origin/push identity, branch, local refs, direct GitHub main and worktree receipt; complete clean parity or clean-ahead exits 0, review needed/unverified exits 1, usage errors exit 2 |
| `npm run --silent repository:identity -- --json` | Same bounded observations as JSON, without npm headers; performs no fetch, stage, commit or push |
| `npm run environment:check` | Validates the configuration proposal against six fixed public files; prints names/categories/counts without reading private environment files or shell values |
| `npm run environment:test` | Independent classification, placeholder, no-secret-read, path and CLI fixtures |
| `npm run repository:identity:test` | Injected remote responses and disposable Git fixtures; no real network calls |
| `npm run browser:payroll` | Two employee elections, four approved time entries, staged simulated payroll, reconciled scoped statements, reload and consumed-time refusal |
| `npm run browser:lifecycles` | Separate CMS review/publication with a frozen public projection; linked CRM conversion/follow-up and an explicitly scoped browser-module replay-refusal probe |

Read the [command effects and authority table](COMMAND-SAFETY.md) before
choosing modes with local/Git/provider effects. The [repository receipt](REPOSITORY-IDENTITY.md)
records an observation for an already authorized publication review; it grants
no authority or lease. The [configuration proposal](ENVIRONMENT-CONFIGURATION.md)
checks examples and declarations rather than production runtime enforcement.
Use the [QA coverage map](QA-COVERAGE-MAP.md), [health vocabulary](MONITORING.md)
and [security assumptions register](SECURITY-ASSUMPTIONS.md) to retain the exact
scope and observation date of each result. Current execution evidence belongs
in the [operational-foundations receipt](OPERATIONAL-FOUNDATIONS-QA-2026-10-15.md).

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
| `npm run browser:state-contract` | Isolated native-portal saved-record, temporary-input, navigation, Reset, restore/Undo and in-memory export contract journey |

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
passed 13 tests and reported its then-current 34 stages with zero unknown classifications.
Nine foundation browser checks and nine existing keyboard checks passed; final
integrated gates remain recorded in the receipt.

## App and local session

| Command | Behavior |
| --- | --- |
| `npm run dev` | Vite webapp only; use its printed URL |
| `npm run dev:mock` | Owned native HR/CMS/CRM server on a free `127.0.0.1` port, with `.env` files and provider/emulator/LAN integrations disabled |
| `npm run dev:mock -- --port 5185` | Request a stable local origin; an occupied explicit port fails without stopping its listener |
| `npm run dev:mock:test` | Mock-launcher argument, environment, ownership and shutdown regressions |
| `npm run dev:systemx` | Owned app + LAN + Firebase emulator session with free loopback ports and separate component readiness |
| `npm run dev:systemx -- --host 127.0.0.1 --port 5185` | Pin the app's HTTP origin; an occupied app port fails without fallback or replacing its listener |
| `npm run dev:systemx -- --fixed-origin` | Pin the default app origin `http://127.0.0.1:5173`, unless host/port overrides are supplied |
| `npm run dev:firebase` | Alias for the integrated local session |
| `npm run systemx:lan` | Direct LAN service only |
| `npm run systemx:session:status` | Read recorded origin/URLs/component readiness and inspect recorded process liveness/association; no fresh service probes |
| `npm run systemx:session:restart:preview` | Read-only process/listener snapshot and proposed launch at the recorded origin/ports; no restart occurs |
| `npm run systemx:session:test` | Focused supervisor and restart-preview regressions with isolated fixtures |
| `npm run systemx:session:stop` | Verify ownership before a stop request; Windows combined sessions refuse and require Ctrl+C in the owning terminal; refusal preserves record/files |
| `npm run build` | TypeScript/Vite build plus LAN artifact-isolation check |
| `npm run preview` | Preview the built app |

The integrated launcher accepts `--host 127.0.0.1` or `--host localhost` and
`--port` from 1024 through 65535. Either option pins the app origin, as do
`SYSTEMX_DEV_HOST`, `SYSTEMX_APP_PORT` or `SYSTEMX_FIXED_ORIGIN=true`.
Without these overrides it chooses available ports. Backend LAN/emulator hosts
use `127.0.0.1`; backend preferred ports use `SYSTEMX_LAN_PORT` and
`SYSTEMX_FIREBASE_{AUTH,FIRESTORE,STORAGE}_PORT`. The launcher prints the exact
mock-save origin and `/portals` URL; reuse its scheme, hostname and port in the
same browser profile to reopen saves. `localhost` and `127.0.0.1` select
different browser storage.

Readiness has independent `starting`, `ready` and `failed` results for Vite,
LAN, Auth, Firestore and Storage. A usable app does not establish emulator
readiness. Storage reports only a reachable TCP listener; the other components
check their specific HTTP responses. These observations do not test provider
workflows. The [session guide](GETTING-STARTED.md#start-the-integrated-local-workspace)
explains status and origin troubleshooting.

The restart preview invokes `session-control.mjs restart --preview` and emits
JSON. `ready-for-review` exits 0; `refused` exits 1, including missing records,
foreign listeners and unavailable ownership metadata. Malformed invocation
exits 2; `restart` without `--preview` is rejected. Listener states distinguish
`available`, `release-required`, `blocked` and `unverified`. This is a snapshot
without port reservations, signals or file writes. Recheck ownership and
availability before an actual restart. See the
[session/contracts receipt](SESSION-CONTRACTS-QA-2026-10-15.md) for actual checks.

Windows combined-session stop exits 1 with reason
`windows-combined-stop-requires-owning-terminal`, including for an apparently
exited record. It signals nothing and preserves session/configuration files.
Use **Ctrl+C in the owning terminal**, then inspect child processes and listeners;
remaining state needs inspection before operator recovery. A verified standalone
LAN stop on Windows can terminate that single process; wait for exit and rerun
stop to clear its verified exited record if the handler did not clean up.
Read the [shutdown guide](GETTING-STARTED.md#preview-a-restart) for these boundaries.

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
| `npm run backlog:evidence` | Read-only JSON summary of scoped review/evidence attachments, independent of catalog completion |
| `npm run backlog:evidence -- --id WX-0717 --category browser --limit 20` | Query one known item and evidence category; limits range from 1 through 100 |
| `npm run backlog:evidence:check` | Validate evidence metadata, dates, revisions, known proposal IDs and repository file references without changing status |
| `npm run backlog:evidence:test` | Evidence-index schema, path-containment, validation, filtering and preservation regressions |

The [roadmap](WEBAPPX-ROADMAP.md) is planning data. These commands leave the
blank reusable SYSTEMX task/context/plan/memory records intact and do not start
agents or provider operations. Verified completed entries retain their stable
IDs and link completion evidence; unfinished entries remain open work. Inspect
the first P1 portal follow-up with `npm run backlog -- --id WX-0051` and
`npm run backlog -- --id WX-0451`.
Those earlier entries remain completed with their evidence. The foundation wave
accepted 17 additional IDs; consult `backlog:summary` and the generated execution
plan for current completion and remaining-gate counts.

The [evidence index](BACKLOG-EVIDENCE.md) preserves a review's examined revision
separately from each original observation's revision, date, method and limits.
It can attach historical local/browser evidence to a TODO item without accepting
that item or its dependencies. The CLI defaults to a summary; `--summary` is
explicit. `--id` and `--category` filters combine, with a default query limit
of 20. A known item without attachments returns zero matches. `--markdown`
emits the complete index to stdout, with links relative to `docs/backlog/`;
it writes no file. Write/apply/completion options are unsupported. Check the
canonical catalog for acceptance state.

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
| `npm run ci:all` | Complete reusable-template release gate; inspect `ci:plan` for its current stage list, browser journeys and effects; requires blank seeds and explicitly installed Chromium |
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
