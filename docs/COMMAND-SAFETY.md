# Command effects and authority

Use this reference to choose an existing command with the intended effects.
Commands that inspect source, commands that change local state, and commands
that publish or use a provider have different scopes. A name such as `check`,
`preview`, `audit` or `dry-run` does not establish its effects by itself.

The table describes the checked-in [npm scripts](../package.json) and their
implementations. Recheck those sources after changing a script, npm lifecycle
hook, `.SYSTEMX/project.json`, installation policy or provider configuration.
The [CI execution plan](CI-EXECUTION-PLAN.md) explains the source-derived
`ci:plan` report; [COMMANDS](COMMANDS.md) supplies usage examples and
[RUNBOOK](RUNBOOK.md) supplies operating procedures.

## Authority and interpretation

The authority column identifies the scope an action needs, rather than adding
an approval prompt to every invocation. Existing human authorization persists
for the work it covers. Continue authorized inspection and reversible local
work; resolve a real gap when a consequential next action falls outside that
scope. An example, successful check, available credential, role record or
dependency-ready item does not authorize another action.

- **Inspect:** inspect the named checkout, local metadata or recorded evidence.
- **Local:** change the named local files, browser state, fixtures or owned
  processes within the authorized task. Check the target and resource ownership.
- **External read:** access the named registry, Git remote or service within the
  authorized scope. A remote read can still create local caches and logs.
- **Publish/provider:** the specific Git publication, provider operation or
  production action must be covered by human authorization. Production Firebase
  deployment requires explicit operator authorization under [AGENTS](../AGENTS.md).
  If that authorization already exists, this document does not request it again.

“No writes” below means that the reviewed implementation defines no writes for
that mode. It is not a sandbox guarantee for the interpreter, npm wrapper,
installed executable or future configuration. Shell redirection and additional
arguments can also change an invocation's effects. “No Git mutation” refers to
branches, commits, index or remote publication; some commands still read Git
metadata. Temporary writes remain writes even when cleanup succeeds.

## Command effects table

| Command | Mode | Scope | Filesystem, process and network effects | Git / provider / external effects | Authority | Result limits |
| --- | --- | --- | --- | --- | --- | --- |
| `npm run environment:check` | Configuration proposal/example validation | Six fixed tracked public schema/example/declaration/documentation files | Reads approved placeholders and metadata; prints names/categories/counts; no private environment files, shell values, network or writes | No Git/provider action | Inspect | Example validation does not enforce runtime configuration or detect every possible credential. See [configuration proposal](ENVIRONMENT-CONFIGURATION.md). |
| `npm ci` (root, adopted starter or optional Functions package) | Locked dependency installation | The selected package and its own lockfile | Can remove/recreate `node_modules`, download packages, write npm cache/logs and run dependency lifecycle scripts; manifests/lockfiles are not regenerated | Registry/download requests; lifecycle effects depend on reviewed dependencies | Local installation plus external downloads | Choose the correct runtime/package scope. An install is not a test result. See [dependency installation](DEPENDENCY-INSTALLATION.md). |
| `npm run doctor` | Version report; optional `--json` | Installed local Node, npm, Git and Python | Bounded version child processes and filesystem observations; no installs or command-defined file writes/network requests | No authentication or provider probe | Inspect | Version availability does not establish app dependencies, platform runtime behavior or optional tool readiness. |
| `npm run repository:identity` | Receipt; optional `--json` / expected repository | Root, origin/push identity, branch, HEAD, tracking refs and worktree | Bounded local Git reads and an isolated direct HTTPS `ls-remote` after identity verification; suppresses optional index locks; no fetch/reset/stage/commit/push | Direct GitHub `main` read; tracking refs remain cached observations | Inspect plus external Git read | Receipt supplies observations for an already authorized publish review. Parity or clean local commits ahead do not grant publication/deployment authority or run release gates. |
| `npm run ci:plan` | Report; optional `--json` | Root CI runner, package scripts, Gusto Functions package metadata and selected installation | Reads sources and prints a plan; executes no CI stage, provider probe or child command | No Git/provider action | Inspect | Reviewed command signatures only; unknown behavior is reported. A plan establishes no gate success and does not alter gate order or acceptance. |
| `npm run development:check`, `docs:links`, `template:check`, `account-levels:check`, `auth:mfa:check`, `ai:standard:check`, `ci:lint`, `ci:typecheck` | Source checks | The named source/configuration, links, records or template inventories | Read/check mode; no fixes or build emission. `development:check` reads public examples and names, without reading private local environment files | No provider operation; template validation may read local Git state | Inspect | Each checks only its declared contract. Configuration and role checks do not establish enforcement by a deployed service. |
| `npm run system:audit` | Local audit | Host structure, stock setup files, local generated clutter and menu syntax | Reads files; runs local shell/Node verifiers; no remote audit request or command-defined write | No Git publication/provider operation | Inspect | This is the host structure audit, distinct from `ci:audit` and deploy `--audit`. |
| `npm run sync:system:check`; `npm run sync:system -- --dry-run` | Drift check / preview | Host versions, status anchors, README managed block and menu | Local probes and comparisons; may create/remove a temporary README comparison file; does not rewrite host records | Reads branch metadata where needed; no commit/push/provider action | Inspect; allow temporary local work | `--check` fails on drift. Neither mode applies the displayed changes or verifies a live service. |
| `npm run sync:system` | Apply host sync | Host metadata and generated README block | May write `.SYSTEMX/webapp-version`, missing host status anchors and `.SYSTEMX/README.md`; local probes/temporary files | No commit/push/provider operation | Local | Host drift reconciliation does not import upstream defaults or accept project work. |
| `npm run backlog`, `backlog:summary`, `backlog:check`, `backlog:plan`, `backlog:ready`, `backlog:graph`, `backlog:plan:check`, `backlog:evidence`, `backlog:evidence:check` | Query / compare | Canonical host catalog, execution plan and scoped evidence index | Reads catalog/evidence and referenced local files; prints reports or checks generated parity; no file writes, workers or network requests | No Git/provider action | Inspect | Ready is dependency-ready selection only. Reports and evidence attachments do not accept TODO items or prove current execution/provider readiness. |
| `npm run backlog:render`; `npm run backlog:plan:render` | Explicit render | Generated catalog Markdown/CSV; generated execution-plan Markdown | Writes the corresponding generated views from canonical data | No commit/push/provider action | Local | Rendering changes no canonical acceptance state and dispatches no work. Reusable SYSTEMX seeds stay blank. |
| `npm run backlog:impact -- --from REV --to REV` | Committed revision impact | Two explicit locally available Git commits and one committed catalog | Bounded local Git reads; reports changed scopes and metadata/definition advisories; does not fetch, alter catalog state or infer regressions | No provider/network action | Inspect | Missing objects, unsupported external Git metadata/configuration and incomplete output refuse the comparison. See [rebaseline](BACKLOG-REBASELINE.md). |
| `npm run backlog:adopt -- preview ...` | Adopted TODO plan | Explicit configured app/root or exact child, committed source catalog and selected proposals | Reads/fingerprints selected records; validates candidate TASKs/dependencies and separate gate requirements/observations; JSON stdout only | No provider probes or worker execution | Inspect | Unknown constraints stay unknown. TODO status, source completion or reported credential availability establishes no readiness. See [adoption](BACKLOG-ADOPTION.md). |
| `npm run backlog:adopt -- apply ... --authorize-intake` | Deliberate reviewed TODO intake | Same exact adopted app/scope and reviewed plan | Locks/reloads/rechecks complete fingerprints and dependencies; appends validated TODO batch and refreshes generated views | No provider probes, worker start, commit/push or deployment | Local adopted-record write | Existing scope authority persists. Source template/aliases, stale plans, repeated IDs and unreadable records are refused. Intake does not authorize execution. |
| `npm run systemx:provenance` | Offline per-path inventory | Outer host paths and all registered retained distributions | Verifies retained fingerprints; classifies ownership separately from exact/manifest-equivalent content; bounded pages and diagnostics; excludes runtime/secret payloads | No network or update action | Inspect | Matching stock never authorizes replacement; invalid or incomplete inventory does not imply no changes. See [provenance](SYSTEMX-PROVENANCE.md). |
| `npm run browser:work-status` | Isolated LAN browser journey | Owned temporary LAN/public-source fixture and fresh Chromium context | Starts owned loopback server/browser, writes local screenshots/results, removes fixture and closes owned resources with bounded teardown | No accounts, emulators, providers or automatic browser download | Local | Exercises recorded work sources and explicit selection; records do not establish running workers. |
| `npm run backlog:adopt:test`, `backlog:impact:test`, `systemx:provenance:test`, `systemx:work-status:test` | Focused temporary fixtures | Disposable Git/adopted records/retained distributions or supplied read models | Creates and cleans owned fixtures; adoption tests deliberately apply TODO intake only to temporary targets | No real network/provider or live adopted-target action | Local | These suites supplement the required integrated gates and do not accept source work automatically. |
| `npm run lint:fix` | Fix | Application source selected by ESLint | May rewrite source files | No Git publication/provider action | Local | This is a source mutation; inspect the diff. It does not run the complete release gate. |
| `npm run build`; `npm run ci:build` | Build | Root app and production artifact isolation | Writes `dist` and possible Vite cache; `build` also runs TypeScript build mode, which may emit incremental/build metadata | No commit/push/provider action | Local | LAN artifact isolation and a successful build establish local output only. `ci:build` omits the TypeScript build-mode prefix. |
| `npm test`, `hr:test`, `portals:test`, `security:controls:test`, `systemx:tools:test`, `systemx:integration:test` and focused `*:test` scripts | Local tests | Named test fixtures and dependent workspaces | Depending on the suite, creates temporary files, Git fixtures, caches, owned loopback listeners and child processes; selected SYSTEMX tests run in temporary copies | No intended production/provider workflow; fixture Git changes are local | Local | A passing suite proves its tested behavior. Account-free HR/SDK tests do not establish live Gusto access or payroll execution. Inspect changed test commands before assuming this classification. |
| `npm run research:validate` | Package validation | Adapted LAN research package | Reads inventory/checksums; Python runs without `-B` and may create bytecode caches | No provider operation | Inspect; allow interpreter cache writes | Inventory/checksum validation does not validate the research claims or live runtime. |
| `npm run ci:audit`; `npm run hr:backend:audit` | Strict dependency audit | Root package; optional Gusto Functions package respectively | Contacts configured npm registry; npm may write cache/log files; does not install or fix dependencies | Registry read; no application provider operation | External read; allow npm cache/log writes | Enforces its configured high-severity threshold for the examined dependency tree, not a complete security assessment. |
| `npm run ci:security` | Security/configuration checks | Root controls plus account-level and MFA checks | Local source checks plus nested `npm audit`; registry requests and npm cache/log writes are possible | Registry read; no live account/provider probe | External read; allow npm cache/log writes | The nested audit reports warnings on audit failure. The separate `ci:audit` gate provides strict audit enforcement. |
| `npm run ci:all` | Complete sequential release gate | Root app, optional Gusto Functions audit and selected SYSTEMX distribution tests | Runs the stages in `scripts/check-template.sh`: temporary fixtures/processes/listeners, browser artifacts/cache, possible Python cache, registry audits and final build output | Local Git fixtures/metadata and registry reads; no intended commit/push/deploy | Local plus external registry reads | Full CI is not read-only. Chromium must already be installed. Success is local evidence, not deployment, provider, device/accessibility or operator acceptance. Use `ci:plan` to inspect the current stages. |
| `npm run browser:install` | Explicit browser setup | Pinned Playwright Chromium installation | Downloads browser binaries and writes browser cache/install state | External browser distribution download | Local plus external download | Installs the browser prerequisite; does not execute or accept browser journeys. |
| `npm run browser:smoke`, `browser:keyboard`, `browser:foundation`, `browser:state-contract`, `browser:lifecycles`, `browser:payroll` | Browser journeys | Isolated native portals and browser contexts | Starts owned loopback Vite/Chromium resources; writes reports, screenshots/downloads/traces and Vite cache under a fresh artifact directory; closes owned resources | Account-free synthetic local journeys; no intended provider workflow or automatic browser download | Local | Saved/transient state, CMS/CRM lifecycles, simulated payroll and keyboard evidence are scoped to the authored journeys. They do not certify whole-site accessibility, live provider behavior or real payroll execution. |
| `npm run browser:codegen` | Interactive browser recording | `http://localhost:5173` and the chosen browser session | Starts Playwright browser tooling and opens the configured local URL; recording/output and page actions depend on operator use | Page interactions can have the effects of the app being opened | Local; any provider action needs its own scope | This is interactive tooling, not the isolated acceptance runner. Inspect which app owns the port first. |
| `npm run mcp:chrome` | `npx ... --help` | Chrome DevTools MCP package launcher | May resolve/download the package and write npm cache/logs before printing help | Possible package-registry read/download | External read/download plus local cache work | A help argument is not an offline-install guarantee; it does not establish a running MCP connection or browser acceptance. |
| `npm run dev:mock` | Native mock server; optional `--port` | Account-free HR/CMS/CRM on `127.0.0.1` | Forks one owned Vite worker and listener; writes/removes a temporary cache. Child environment excludes provider/LAN variables; Vite uses `configFile: false`, `envDir: false` and no proxy | No Firebase/emulator/Gusto/LAN connection configured by this launcher | Local | Fictional browser data can persist at its origin/profile. Default port 0 chooses a free port; an occupied explicit port fails without stopping another listener. |
| `npm run dev`; `npm run preview` | Ordinary Vite development / built preview | Root app with ordinary Vite/app configuration | Starts a local server and may write Vite cache; ordinary `dev` uses configured environment/plugin/proxy behavior | Provider effects depend on adopted app configuration and user actions; `dev` can proxy `/__systemx` to the local LAN service | Local; separately scoped provider actions if configured | These modes do not provide `dev:mock` isolation. The development SDK fixture plugin is absent from built preview/Hosting. |
| `npm run dev:systemx`; `npm run dev:firebase` | Combined supervised local session | Vite, LAN and Auth/Firestore/Storage emulators for `demo-systemx` | Allocates/probes loopback ports; writes ignored session/PID/runtime Firebase configuration; starts owned children using installed Firebase tooling; emulators may write logs/caches or obtain emulator runtime assets | Local emulator service, not production deploy; LAN/provider features remain subject to their configured actions | Local; any additional provider operation needs its own scope | App readiness and each emulator readiness are distinct. Storage readiness is a TCP reachability result. Busy fixed app origins fail before launch. |
| `npm run lan`; `npm run systemx:lan` | Standalone LAN service | Local builder/session controls | Starts a loopback HTTP listener and local runtime/session state; builder actions can write local data, backups and source files | Optional configured font metadata requests and builder/provider actions have their own effects | Local; external requests/actions within their authorized scope | Starting a control service does not make every UI action inspection-only. Review its action/target and ownership before a source or provider change. |
| `npm run systemx:session:status` | Recorded session inspection | This repository's saved session and recorded PIDs | Reads session record and OS process metadata; no signals, file writes or fresh service probes | No provider action | Inspect | Liveness/association and recorded readiness are snapshots, not current service or provider health. |
| `npm run systemx:session:restart:preview` | Restart plan only | Recorded session processes, origin/ports and listeners | Reads OS process/listener metadata; no signals, writes, probe listener or port reservation | No provider action | Inspect | `ready-for-review` exits 0; `refused` exits 1. No restart occurs. Recheck immediately before actual launch/stop; `restart` without `--preview` is rejected. |
| `npm run systemx:session:stop` | Owned stop / exited-record cleanup | Verified owner of this checkout's session | Can signal the verified supervisor with `SIGTERM`; later verified exited state can clear its session/runtime file. Refusal preserves state | No provider operation; unrelated listeners remain outside ownership | Local, with verified process/resource ownership | Windows combined sessions always refuse, including apparently exited records: use Ctrl+C in the owning terminal and inspect descendants/listeners. See the stop boundary below. |
| `npm run dev:firebase:raw`; `npm run emulators`; `npm run emulators:export` | Raw emulator CLI | Raw names/configuration passed to Firebase tooling | Starts emulator processes/listeners; may download tooling/runtime assets and write logs/caches. `emulators:export` imports and writes `.emulator-data` on exit | Local emulator actions; raw `emulators` uses project configuration | Local plus any required external downloads | These bypass the owned combined-session launcher. Only `dev:firebase:raw` hardcodes `demo-systemx`; inspect actual project, ports and ownership for the others. |
| `npm run security:rules:test` | Emulator rules regression | Explicit `127.0.0.1` Auth/Firestore endpoints for `demo-systemx` | Creates and changes synthetic users/documents over loopback; no emulator startup in the test command | Mutates the selected local emulator data | Local, with isolated owned emulator endpoints | Refuses missing/non-loopback endpoints. It does not verify deployed rules. |
| `npm run setup:test-users`; `npm run setup:test-users:write` | Manifest preview / local write | Fictional test-account metadata | Preview prints rows; write mode creates/overwrites ignored `.env.test` from supplied/default fictional inputs | Neither creates Firebase users or calls a provider | Inspect / Local respectively | A local manifest is not an account provisioning result. Keep real credentials outside tracked files. |
| `npm run setup:unified:scrape:list`; `setup:unified:scrape:dry-run`; `setup:unified:scrape` | GitHub inventory list / preview / write | Repositories selected by owner/limit | Runs `gh` repository/content reads; write mode writes the local `repo-manifest.json`; CLI caches/logs can also change | Authenticated GitHub reads, potentially including private repository metadata; no repository publication | External read; Local for write mode | Dry run still contacts GitHub. Inventory is structural evidence, not authorization to copy project business logic. |
| `npm run setup:packet:export`; `npm run setup:packet:import` | Local packet export / import | Chosen setup packet and local download/import destinations | Prompts/reads setup state; writes packet ZIP or extracted/copy targets, local state/history; import backs up an existing same-named target | No commit/push/provider operation | Local, with reviewed source and destinations | These are file transfer/setup actions, not preview checks or provider provisioning. Review packet contents and validation result. |
| `npm run systemx:status`, `systemx:validate`, `systemx:context`; `npm run systemx -- status`, `task-show`, `task-ready`, `task-packet`, `projects list`, `tools-guide` | Managed status / record inspection | Selected immutable defaults and outer project or explicitly selected child records | With this template's manual update policy, reads/validates records and prints reports; no worker starts | No provider action under the current manual policy | Inspect | Installed integrity, recorded task state and dependency readiness are distinct. Manager startup policy can change effects; recheck `INSTALLATION.json`. |
| `npm run systemx -- check --dry-run`; `build --dry-run`; `deploy --dry-run` | Configured command plan | Selected records and `.SYSTEMX/project.json` command arrays | Validates and prints the plan without running configured checks/build/deploy | No configured Git/provider action executes | Inspect | SYSTEMX `deploy --dry-run` is a plan printer. It differs from the host deploy script's `--dry-run`, which runs gates/build and writes logs. |
| `npm run systemx:check`; `npm run systemx -- build`; `npm run systemx -- deploy` | Execute configured plan | `.SYSTEMX/project.json` checks and command arrays | Runs configured checks sequentially; build adds configured build; deploy adds checks, build and configured deploy | In this template, deploy reaches the full host deployment script and can commit/push/deploy | Inspect each configured action; Local / External read / Publish/provider as applicable | A wrapper does not reduce the effects of the command arrays. Current `check` includes registry audit and temporary tests; it is not read-only. |
| `npm run systemx -- roles-init`; `roles-init --apply` | Role preview / local initialization | Selected outer or explicitly selected child records | Preview only reports additions/preservation. Apply writes missing role/event/review records, registry, coordination state and receipt | Starts no worker or provider | Inspect / Local respectively | Keep reusable template seeds blank; test active initialization in temporary copies. Registration is not a running agent. |
| `npm run systemx -- task-add`, `task-set`, `agent-add`, `focus`, `refresh-work` | Record mutations | Adopted project's canonical ledger, registry, focus and generated views | Takes local coordination lock and atomically writes records/generated status views | No worker, Git publication or provider action | Local; Agent 0 owns shared integration/acceptance | Record changes do not execute work or verify evidence. Do not populate reusable template seeds with WebAppX maintenance work. |
| `npm run systemx -- agent-y providers`; Agent Y job preview/apply commands | Installed CLI report / action-specific job lifecycle | Explicit task/provider/repository/base/allowed paths and branch/PR policy | `providers` detects installed CLI names. Other previews may inspect local/remote Git; apply can create worktrees, run provider children, write records and commit | Depending on the job/action policy, apply can contact a model/provider, push a branch or create/change a PR | Inspect for availability; separately scoped task/provider and publication actions for execution | Do not infer one preview/apply contract for every Agent Y action. Native Windows `run --apply` refuses. Provider exit or draft PR does not accept a task or grant merge authority. |
| `npm run systemx:upstream:check` | Default import preview | Clean reviewed standalone dotSYSTEMX source and named target | Reads/verifies source/target; queries isolated canonical public main and creates/removes a temporary tracked Git archive; emits bounded versioned groups, host-only preservation and complete conflict totals | Reads live public `main`; no fetch/pull/commit/push or target import application | Inspect plus external Git read and temporary writes | Preview leaves target files unchanged. Bind both preview and apply with the same `--expected-commit` when requiring the exact reviewed revision. |
| `npm run systemx:upstream:import` | Import with `--apply` | Same reviewed source and named target | Performs preview work, then backs up/refreshes recognized stock bootstraps, appends immutable snapshots, updates/pins installation and writes import provenance | Live public-main read; no commit/push/deploy | Local import plus external Git read | Preserves adopted records/custom extensions; rejects conflicts/downgrades. A failed update re-pins current selection; bootstrap replacement is not automatically rolled back. |
| `npm run template:sync -- --target /path/to/mirror` | Mirror preview | Two clean repository roots and source `HEAD` tracked tree | Creates/removes a temporary archive and validates blank seeds; reports added/removed/changed tracked paths | Local Git metadata/archive only; no commit/push/network | Inspect plus temporary writes | Requires a separately selected reusable template target. This is not an adopted application-record merge. |
| Same mirror command with `--apply` | Mirror application | Reviewed clean mirror and exact tracked source tree | Copies tracked files and removes target tracked paths absent from source; preserves `.git` and local-only files; refuses collisions/transitions | No stage/commit/push/wiki/deploy | Local, with reviewed target and removal list | Run `template:check` before copying. Review/commit separately; verify parity after committing both trees. |
| `npm run wiki:check` | `--dry-run` wiki preview | Checkout's `wiki/*.md` and origin-derived GitHub wiki | Clones wiki into a temporary directory, renders pages, stages Markdown there, checks/displays diff; removes temporary directory on exit | Remote Git clone/read plus temporary Git index mutation; no wiki commit/push or root-index change | External Git read plus temporary local/Git work | Requires an initialized reachable wiki. “Dry run” does not mean offline or zero writes. |
| `npm run wiki:sync` | `--apply` wiki publication | Same origin-derived wiki destination | Same temporary clone/render/stage work; commits changed Markdown and pushes that wiki clone | Publishes to the separate `.wiki.git` remote | Publish/provider for the named wiki | Preserves wiki-only pages/history; independent of app Git push and Firebase Hosting publication. |
| `npm run deploy -- --check` | Host deploy check | Local security checks and `firebase.json` declarations | Creates log/version directories and a timestamped deploy log; runs `ci:security` with failure tolerated, including possible npm registry/cache effects | No commit/push/Firebase invocation; prints booleans for declared hosting/firestore/storage/functions | Local logging plus external registry read | Exit success is not security acceptance. Booleans describe local configuration, not deployed resources, serving health, credentials or provider readiness. |
| `npm run deploy -- hosting --preflight`; deploy `--audit`; deploy `--dry-run` | Host gates/build without publication | Host deploy pipeline and selected target | Writes deploy log/directories; runs selected local gates and build; audits can contact npm registry/write cache. Rejects `--bump` or `--fix` | Skips version/changelog updates, staging/commit, push and Firebase deployment; `--dry-run` does not invoke Firebase CLI here | Local checks/build/logging plus external registry read | These are not zero-write modes and are not `ci:all`. Success does not prove Firebase command acceptance, live service health or production readiness. |
| `npm run deploy -- --rollback-info` | Print rollback guidance | Project label from option/local Firebase config | Prints suggested commands; deploy launcher may first parse a local secrets file through a temporary file | Executes no rollback, release listing, Git publication or Firebase call | Inspect; allow launcher temporary parsing work | Printed commands are suggestions. Listing releases is an external read; actual rollback is a separate authorized production action. |
| `npm run deploy -- hosting` (also `all`/`full`, `app`, `rules`, `functions`, or no target) | Full host pipeline | Root working tree, current branch and selected Firebase project/resources | Writes logs, version/count metadata, public version and changelog; runs gates/build; optional bump/fix changes source. Functions preparation may install/compile dependencies | Stages **all** changes with `git add -A`, commits, attempts push, then invokes Firebase; `--bg` launches the same pipeline asynchronously | Local plus Publish/provider for current branch and exact Firebase target; explicit production operator authorization | Inspect the entire working tree and destination first. Push failure is warned and can still be followed by deploy. Target selection does not confine Git staging to that target. |
| Deploy `--skip-deploy`; deploy `--skip-push` | Independent partial skips | Otherwise normal host pipeline | Version/log/build/changelog effects and staging/commit remain unless a preflight mode is used | `--skip-deploy` still permits Git commit/push. `--skip-push` still permits Firebase deployment and local commit. Both together still permit local commit | Authority for every remaining local/publication/provider action | A skip flag suppresses only its named stage. `--fast` skips optional tests/security; it grants no readiness or authority. |

## Deployment boundaries

The retained [host deploy script](../.SYSTEMX/scripts/deploy.sh) has broader
effects than its introductory “no mutations” comment suggests. It parses the
first existing local `.secrets.env` or `.SYSTEMX/secrets.env` as literal data
before processing options, using a restricted temporary file. Do not use a
deploy help/check/preflight invocation as a way to promise that no local secret
file will be read. This reference was written by inspecting source; secret
values are not required to establish these effects.

`--preflight`, `--audit` and `--dry-run` share `PRECHECK_ONLY`: they disable
push/deploy, skip version/count/changelog/commit changes, and reject either
`--bump` or `--fix` before gates. They still create logs and run enabled gates
and the build. The host `--dry-run` never reaches Firebase CLI because deployment
is disabled; it does not validate a live Firebase deploy request. Other skip
flags can reduce the checks that actually ran. The full template release process
still requires `npm run ci:all`, `npm run sync:system:check` and
`npm run deploy -- hosting --preflight` before publishing.

Default deployment stages all tracked/untracked changes that Git permits through
`git add -A`. `--skip-push` is not a no-Git mode, and `--skip-deploy` is not a
no-publication mode. Neither target selection nor `--project` changes this Git
scope. `--bg` preserves the same actions in a background process; the launcher
PID/log is a job handle, not completion evidence. Follow it to a terminal result
before starting conflicting work.

`--check` exits after local security output and configuration-presence booleans.
Its tolerated `ci:security` failure and absence of provider probes make it
unsuitable as a live deployment or health acceptance check. A successful local
preflight, build, mock journey or imported release also supplies no production
authority. Use the exact named project/resources and the authorized operation
when executing deployment, rollback, account provisioning, payment/payroll or
other provider writes.

## Process ownership and Windows stop behavior

Use recorded PIDs as leads for inspection. The
[session control implementation](../.SYSTEMX/LAN/session-control.mjs) and
[ownership/stop planner](../.SYSTEMX/LAN/session-restart-preview.mjs) verify process
birth/command/parent/working-directory evidence before a stop. A restart preview
does not reserve ports; an old readiness result does not establish current
ownership. Preserve unrelated listeners and recheck ownership before signaling.

On Windows, a **combined** session stop returns exit 1 with
`windows-combined-stop-requires-owning-terminal`, even for an apparently exited
record. It sends no signals and preserves session/runtime configuration because
forced termination cannot establish descendant cleanup. Press **Ctrl+C in the
terminal that owns the supervised session**, then inspect children and listeners
before recovering remaining state. A verified standalone LAN stop can target
that one process; wait for exit and rerun stop to clear a verified exited record
if its handler did not clean up. macOS source checks do not establish Windows
x64/ARM64 runtime acceptance.

## Source and result scope

The table is grounded in [package scripts](../package.json), the
[CI runner](../scripts/check-template.sh), the
[reviewed CI signature descriptions](../scripts/ci-plan.mjs),
[host deploy](../.SYSTEMX/scripts/deploy.sh),
[wiki sync](../scripts/sync-wiki.sh),
[upstream import](../scripts/sync-systemx.py),
[template mirror](../scripts/sync-template.py),
[mock launcher](../scripts/dev-mock.mjs),
[combined session](../.SYSTEMX/LAN/dev-session.mjs), and the host backlog tools:
[catalog](../scripts/webappx-backlog.mjs),
[execution](../scripts/backlog-execution.mjs) and
[evidence](../scripts/backlog-evidence.mjs), [adoption](../scripts/backlog-adoption.py),
[impact](../scripts/backlog-impact.mjs) and [provenance](../scripts/systemx-provenance.py).

Managed commands select their defaults through
[INSTALLATION.json](../.SYSTEMX/INSTALLATION.json). For the current selected
1.9.0-alpha.6 release, see its
[configured action dispatcher](../.SYSTEMX/.systemx/releases/1.9.0-alpha.6/scripts/systemx.py),
[record writer](../.SYSTEMX/.systemx/releases/1.9.0-alpha.6/scripts/project_memory.py),
[role initializer](../.SYSTEMX/.systemx/releases/1.9.0-alpha.6/scripts/agent_standards.py)
and [Agent Y implementation](../.SYSTEMX/.systemx/releases/1.9.0-alpha.6/scripts/agent_y.py).
The current installation uses manual updates; a future `on-start` policy can
add startup network/update behavior before an otherwise inspect-only command.
Follow [SYSTEMX integration](SYSTEMX-INTEGRATION.md) for reviewed import policy.

Keep result claims at their observed boundary: source/configuration inspection,
local tests/build/browser behavior, Git publication, deployed serving behavior,
provider acceptance and operator/business acceptance each need their own
evidence. Passing one does not establish the others.
