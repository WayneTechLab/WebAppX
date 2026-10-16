# Developer setup contracts implementation plan

## Agent 0 implementation assignment — 2026-10-15

Implement the ten original criteria below in the owned isolated worktree based on
published `49a9efe345c815c2bead1cbbeb83204d31e64290`. Primary remains clean and
published at **122 done / 878 remaining**. All ten selected criteria remain TODO.
The temporary source-only plan below is approved for implementation; its earlier
future scheduling/unauthorized statements are historical planning context. Root
retains package/CI/shared integration and all acceptance/publication decisions.
No new acceptance or test execution is inferred from this assignment.

Agent 0 preserves the literal npm-name CI loop by adding separate `scripts:check`
and `fixtures:check` strict aliases. Their report counterparts remain read-only
`scripts:list` and `fixtures:list`. Together with `docs:commands:check`,
`source:shell:check` and `setup:contracts:test`, this is seven new package aliases.
The four strict checks and one focused aggregate will each run once in CI; all
63 earlier stages retain their relative order. No shell-parser broadening is
authorized by this integration choice.

# Proposed finite setup-wave implementation contract

Prepared 2026-10-15 from current PRIMARY source supplied as `7337709b79b995c3f1e76254aa51fd86bbd1f215`. This is a future implementation handoff, with no acceptance, completion, test execution, install, browser, service or publication claim. The only new artifact is this temporary file. No tracked file or Git state was changed.

The input audit is `/tmp/webappx-setup-followup-audit.md` (SHA-256 `7611bdc51b3f07a8faf2837fe6729bd8095f618c11215db6fe1e4bc140634a21`). That audit used fixed source `6c6079c3b9b2c5fe6e34f39c61f5b3ecef95279a`; its historical observations remain attached to that source. Current source was read directly for this contract without Git commands. Its manifest now has **127 scripts**, compared with the audit's fixed 126. Current reset, starter and runtime facts below were rechecked. The newer recruiting code does not supply any of these ten criteria automatically.

## 1. Exact scope and original acceptance

All ten rows remain the canonical P2 / foundation / setup / local proposals at this planning point. Keep their original criteria, source fields and dependencies. WX-0014 depends on WX-0013; no other dependency is added to the catalog. Implementation sequencing below is a practical file-ownership decision.

| Original ID | Exact acceptance criterion | Canonical dependency |
| --- | --- | --- |
| WX-0011 | A new developer can follow distinct instructions for dependency install, runtime mismatch, occupied port and emulator startup failures. | None |
| WX-0012 | The guide identifies which generated dependency paths can be rebuilt and preserves ignored environment and emulator state. | None |
| WX-0013 | A read-only command lists maintained scripts by setup, app, portal, SYSTEMX, wiki and release purpose using the real manifest. | None |
| WX-0014 | A documentation check flags npm script names in maintained command examples that do not exist in the root manifest. | WX-0013 |
| WX-0016 | A read-only command lists fictional fixture sources and identifies which reset action restores each source. | None |
| WX-0019 | The template check groups app, dependency, asset and configuration differences so a maintainer can locate the relevant starter drift. | None |
| WX-0020 | New-app adoption lists repository name, package name, site branding, deployment target and project records that require deliberate replacement. | None |
| WX-0022 | A source check identifies new script call sites that build executable shell strings and points maintainers to argument-array examples. | None |
| WX-0023 | A temporary-copy smoke run installs no services and verifies key setup commands from a repository path containing spaces. | None |
| WX-0024 | Temporary-copy checks exercise project configuration and read-only status from a path containing Unicode characters. | None |

This wave changes setup documentation and source-only tooling. Runtime walkthrough mode, a developer browser-key reset preview and a new first-run application page belong to their own proposals and receive no implementation or acceptance in this contract.

## 2. Delivery order and exclusive ownership

Start implementation only after Agent 0 finishes the current recruiting publication and deliberately selects its next clean source. Recheck this plan's source references against that source. Payroll runtime work can proceed separately if Agent 0 assigns it: this setup wave needs no HR reducer, portal component, provider, fixture-data or browser-harness edit. Both waves share package/CI and evidence integration, which Agent 0 serializes after the runtime source settles.

| Lane | IDs | Exclusive files | Handoff |
| --- | --- | --- | --- |
| A — Script and documentation command contracts | 0013, 0014 | NEW `scripts/package-script-discovery.mjs`, `scripts/package-script-purposes.json`, `scripts/check-doc-commands.mjs`, NEW `tests/setup/package-script-discovery.test.mjs`, `tests/setup/doc-commands.test.mjs` | Freeze exported pure report/lexer APIs, six-purpose enum and proposed npm aliases first. Agent 0 alone adds aliases/CI and edits COMMANDS. |
| B — Fictional source/reset inventory | 0016 | NEW `scripts/fixture-inventory.mjs`, `scripts/fixture-inventory.json`, NEW `tests/setup/fixture-inventory.test.mjs` | Finite reviewed descriptors only; read actual source, never execute models, reset, fixture generation or SDK endpoints. |
| C — Starter feature parity | 0019 | `scripts/validate-template.py`, NEW `scripts/starter-parity.json`, `tests/systemx/test_template.py` | Preserve `validate(root) -> list[str]`, existing main/exit semantics and `--against`; add a grouped starter report behind the existing template check. No sync or starter rewriting. |
| D — Child-process source check | 0022 | NEW `scripts/check-child-processes.mjs`, NEW `scripts/child-process-baseline.json`, NEW `tests/setup/child-processes.test.mjs`; if needed NEW private pure Python AST helper `scripts/child-process-python.py` | No scanned module import or command execution. JS AST plus optional Python stdlib AST extraction, with bounded diagnostics. |
| E — Owned path smoke | 0023, 0024 | NEW `tests/systemx/test_setup_paths.py` only | Start after A/B APIs freeze. Own temporary copies; no change to selected snapshots or source fixtures. |
| F — Documentary adoption/recovery | 0011, 0012, 0020 | `docs/GETTING-STARTED.md`, `docs/RUNBOOK.md`, `docs/DEPENDENCY-INSTALLATION.md`, `docs/examples/private-template-adoption.md` | No install, cleanup, repository creation, emulator start or deployment needed to author/review these instructions. |
| Agent 0 — Integration | all ten | `package.json`, `scripts/check-template.sh`, `scripts/ci-plan.mjs`, `tests/setup/ci-plan.test.mjs`, `docs/COMMANDS.md`, `docs/COMMAND-SAFETY.md`, `docs/TEMPLATE-MAINTENANCE.md`, final evidence/catalog/plan/Git if later warranted | Review proposed aliases, classify all added scripts, wire each check once and preserve literal CI planner grammar. Review any source-binding refresh explicitly. |

No worker edits `.SYSTEMX/.systemx/releases/**`, research packages/checksums, reusable blank context/plan/task/memory seeds, fixture contents, package locks, environment files, runtime state, wiki or an active adopted project. If implementation truly needs another existing file, hand it to Agent 0 before editing.

## 3. WX-0013 — real package-script purpose discovery

Proposed alias: `scripts:list` -> `node scripts/package-script-discovery.mjs`; optional pure validation mode `--check` on the same command, plus `--json` for reports. Default invocation reads and prints; it never executes a manifest value or spawns a child.

Read root `package.json` from a module-relative root, not shell interpolation or an assumed CWD. Read one reviewed classification file keyed by **exact script names**. Each entry has one primary purpose from exactly `setup`, `app`, `portal`, `SYSTEMX`, `wiki`, `release`, and one bounded explanation. Print the real manifest's current command string as text. Stable category and name ordering; no second handwritten executable string. Demonstrate representatives such as doctor/development setup, dev/build app, hr:test/portals:test portal, systemx:status SYSTEMX, wiki:check wiki, and deploy/ci:all release. Assign every current script once, including the tool's own alias and the wave's new gates. A future unknown name appears explicitly as unclassified; `--check` refuses missing/stale/duplicate classifications. Do not silently put unknown scripts into a catch-all purpose.

The real manifest is the authority for membership and executable text. Classification metadata describes purpose, not safety or authorization; commands such as `ci:all`, install and deploy keep their actual side effects. Importing the module performs no reads or writes; exported pure `buildScriptDiscovery(manifest, purposes)` supports tests. Reject malformed scripts, invalid enum/paths and duplicate JSON members where relevant. Bound public input sizes and report schema; never inspect environment values.

## 4. WX-0014 — maintained Markdown npm-name validation

Proposed alias: `docs:commands:check` -> `node scripts/check-doc-commands.mjs`. Use a dependency-free Markdown/code-span lexer plus a small **nonexecuting token parser** for npm examples. This is neither a shell interpreter nor an invocation of documented commands. No `eval`, VM, dynamic import of examples, npm subprocess or AST execution.

Maintained scope: root README, ordinary `docs/**/*.md`, ordinary `wiki/**/*.md`, and `.SYSTEMX/Template/starter/README.md` with explicit starter context. Exclude managed release snapshots, research/vendor content, ignored local state and symlinks. Traverse only these roots with bounded UTF-8 file sizes and a finite total file/byte budget. List the actual scope/count in the report. Do not exclude a whole maintained guide because one example has a special context.

Parse inline and fenced code; retain original file and line numbers. Recognize `npm run NAME`, `npm run-script NAME`, options before/after `run` (`--silent`, `--if-present`, etc.), `npm test`/`npm start`/`npm stop`/`npm restart` script shorthands, multiple examples in one block and `--` separating script arguments. Unknown real root names fail even with `--if-present`; `npm ci`, `npm install`, `npm exec`, `npm audit`, `npm --version` and other ordinary npm subcommands are not root script names. A script's trailing arguments are never parsed as another script name.

Do not validate a clearly nested-package example against root scripts. Report its context explicitly: literal `npm --prefix integrations/gusto/functions run check` belongs to the Functions manifest; an explicit starter context belongs to its own manifest. Support only reviewed public nested manifests, never resolve an arbitrary prefix supplied by documentation. Unknown/dynamic prefix or ambiguous `cd` context gets a bounded review diagnostic, not an implicit root success. Scope markers or finite context records may disambiguate a specific block; they cannot waive the remaining file. Mark explicit `<script>`/documented placeholder examples as unvalidated placeholders. Maintain historical exceptions only for exact bounded occurrences tied to an original source revision and reason; preserve historical receipt text. No generic skip-by-file or skip-all-unknown rule.

Diagnostics expose `relative-file:line:column`, script name and fixed reason; never echo a complete command, assignments, arguments or quoted payloads. Tests include fake secret markers in command arguments and assert those markers never appear in reports. The checker reads public manifests/docs only, never private `.env`, shell variables or credentials. Agent 0 should review any pre-existing unknown/ambiguous examples; don't auto-rewrite commands to make the checker pass.

## 5. WX-0016 — finite fictional source/reset inventory

Proposed alias: `fixtures:list` -> `node scripts/fixture-inventory.mjs`, with `--json` and read-only `--check` modes. No generate/write/reset/network mode. Descriptors identify stable ID, source files/functions, consumer scope, reset action, state effect and explicit no-reset boundary. Display paths and function/control names, not fixture bodies, employee details or raw browser slots. Read finite public paths only; validate existence, duplicate/missing IDs, recognized descriptor kinds, exact function/control bindings and malformed data. Do not import TS models or use regex-derived function execution to discover data.

Required reviewed inventory rows:

| Source/default group | Actual source/builder | Actual restoring action and boundary |
| --- | --- | --- |
| Native HR | `.SYSTEMX/GUSTO/mock/fixtures/demo-company.json` -> `createHrDemoState` in `src/hr/persistence.ts`; composes `createMockHrState`, `createPeopleOperations`, `createHrServiceDesk`, `createRecruitingState`, `createPerformanceState`, `createSurveysState` | **Reset HR demo**. `PortalWorkspaceProvider` -> `createDemoWorkspaces().hr` and the replacement/reset path; complete original HR defaults, including absence of optional lifecycle extensions, are restored. |
| Native CMS | `createCmsState`, `cmsCollections`, `cmsActors` in `src/cms/model.ts` | **Reset CMS demo** -> `createDemoWorkspaces().cms`; complete defaults, optional release bundles absent. |
| Native CRM | `createCrmState`, `crmActors` in `src/crm/model.ts` | **Reset CRM demo** -> `createDemoWorkspaces().crm`; complete defaults and original activity/counters. |
| SDK employee/onboarding session | `integrations/gusto/sdk-employees.fixture.json`, `createOnboardingState` in `sdk-onboarding.mjs`, `initialState` in `mock-api.mjs` | **Reset SDK samples** posts local `__reset` for the issued session; refresh starts a new isolated session. This memory is separate from native HR and browser saves. |
| SDK payroll session | `integrations/gusto/sdk-payroll.fixture.json`, `initialState` in `mock-api.mjs` plus `sdk-payroll.mjs` | Same **Reset SDK samples**; resets that SDK session's fictional payroll phase/captures/receipt. No native payroll, provider or funds effect. |
| Reviewed browser baseline | `tests/browser/fixtures/portal-smoke-v1.json` and `.sha256`, `seed-contract.mjs` | No user action rewrites this file. Native Reset recreates current defaults; `loadValidatedSeed` checks the reviewed fixture against them. `generate-seed.mjs --write` remains a separate deliberate maintainer action and is never invoked by inventory. |
| Reviewed role examples | `tests/fixtures/hr-capability-examples.json` | No app Reset; this is documentation/test review input, not a saved user workspace. Its render command does not reset native data. |
| Historical SDK sample references | `.SYSTEMX/GUSTO/mock/fixtures/synthetic-sdk-employee-list.json` and `synthetic-sdk-employee-list-notes.json` | Report as retained reference files. Current SDK mock consumes `integrations/gusto/sdk-employees.fixture.json`, not these paths. No user Reset rewrites retained references. |

Native reset label comes from `DemoWorkspaceReset` and registry labels. When recovery-before-reset is enabled/erroring, it may first show **Reset HR/CMS/CRM workspace?** with **Confirm Reset HR/CMS/CRM** and **Keep HR/CMS/CRM workspace**; optional checkpoint/history effects must be described accurately. Native Reset removes/replaces only its save through existing guards and clears that module's temporary forms/timers on accepted replacement. Other modules remain. It does not rewrite source fixtures, erase downloads, clear all history/preferences, reset Firebase or reset SDK sessions. The command only describes these actions.

No exhaustive claim over arbitrary inline test data: this is the explicit maintained fictional-source inventory and its declared scopes. A test must fail when any required descriptor/source/reset binding disappears or becomes unknown. Dynamic per-test cases remain owned by their tests.

## 6. WX-0019 — feature-group starter parity preserving existing contracts

Current starter has **43 public files**: **22 `src/`**, **2 `public/`**, package/lock and 17 other configuration/setup/documentation files. It is a deliberately smaller standalone scaffold. Current examples: root/starter `src/main.tsx`, account-level helpers and several base pages match; layouts/router/navigation/config/environment and package manifests differ; `src/components/shell/SiteControls.tsx` is starter-only. Native HR/CMS/CRM, optional SDK and host LAN tooling have deliberate root-only scope. Equality of every root app file with the starter would misstate the product contract.

Add a reviewed finite `scripts/starter-parity.json` mapping all 43 current starter public files exactly once to the required `app`, `dependency`, `asset`, `configuration` groups. Enumerate starter files only within declared public roots/names, reject an unlisted addition/removal, duplicates, case-fold collisions, traversal, symlinks or unsupported mappings. Explicitly define the root-only host-feature scope; no opaque blanket wildcard that could hide a new starter file. App includes all 22 starter source files; assets includes both public assets; dependencies includes package+lock; configuration includes the remaining 17 public files, including setup/security scaffolding and README. Both paired paths are explicit and contained.

Mapping modes: equal paired content; reviewed intentional root/starter variant with a concrete reason and separately recorded root/starter fingerprint; starter-only with an explicit absent root and reason. New/changed variant bytes report drift until deliberately reviewed. No inference that all current differences are permanently safe. Use LF equivalence for reviewed text and exact bytes for assets/unknown formats, preserving the existing distribution digest policy. Package comparisons retain existing package name/version checks, lock root metadata, runtime pins and shared dependency declarations; explicitly identify root-only SDK/React Query/Playwright and root-only script tooling. Never regenerate locks or force root package scripts into a scaffold.

Emit deterministic groups with exact added/removed/changed/missing path pairs, intentional-difference status/reason, matched totals and overall `ok`. No copied source/literal bodies. Existing `validate(root)` still returns error strings and validates every prior blank seed, retained immutable snapshot, bootstrap, research fingerprint, app version and blank reusable task/project record. Existing CLI returns failure if either those checks or grouped starter drift fails. `--against` still means clean committed mirror-tree equality and is not repurposed. `template:sync` stays separate and explicitly mutating. `--json`/report helper may be additive if needed, but no existing caller silently skips integrity validation.

Update `test_template.py`'s temporary-copy helper to include the finite mapped root files now required by validation; its current helper copies only `.SYSTEMX` and package files. Preserve all its seed/release/bootstrap/CRLF/research/mirror tests. New tests independently alter one equal app file, dependency declaration, asset and configuration file; distinguish deliberate variants, missing sides, unlisted starter file and forbidden path/symlink. One test combines integrity and starter errors to prove neither masks the other.

## 7. WX-0022 — source check for new executable shell strings

Proposed alias: `source:shell:check` -> `node scripts/check-child-processes.mjs`. Scope finite host `scripts/**/*.{mjs,cjs,js,ts,py}` plus script files introduced by this setup wave; reviewed outer launchers may be inventoried separately. Exclude `node_modules`, generated output, runtime state, fixture source strings, vendor/research and immutable managed releases. Do not scan secrets or arbitrary adopted projects. Existing `.sh` entry points are not themselves reimplemented; the check concerns child-process construction call sites in maintained scripts and explicitly identifies its parser coverage.

Parse JS/TS source using the installed TypeScript AST as data; resolve direct/aliased/namespace `node:child_process` or `child_process` imports/requires, and literal `promisify(execFile)` aliases. Parse Python with stdlib `ast` only; never import/execute a scanned module. If a Python helper is launched, use `[sys.executable/helper path/args]` or a fixed owned interpreter argument array, `shell:false`, fixed files and bounded time/output. Its output contains locations/kinds only. No source text is evaluated.

Identify `exec`/`execSync` implicit shells; `spawn`/`spawnSync`/`execFile` with `shell:true` or indeterminate shell options; subprocess string command building or `shell=True`; and explicit interpreter string channels such as `sh/bash -c`, `cmd /c`, PowerShell `-Command`. Distinguish safe executable plus argument-array examples (`execFile('git', ['status', '--porcelain'])`, existing `fork(workerFile, args, {cwd,...})`, Python `subprocess.run([sys.executable, ...], shell=False)`). Recognized unresolved child-process construction gets an explicit review diagnostic rather than a silent pass. Document that static source coverage is a review aid, not a complete execution/security proof.

Existing necessary shell/string call sites are not a blanket exemption. Capture a finite reviewed baseline of exact relative path, call-kind, normalized AST fingerprint and occurrence count, with reason. Never automatically add new exceptions during `--check`; a duplicated old unsafe call must exceed the recorded count and fail. A modified/replaced call must require review. No broad per-file/regex exemption. Baseline fingerprints may hash literal source internally; output must never print it. Diagnostic fields are path, line, column, fixed rule and a generic argument-array help link. Tests inject secret-like literals and assert none leak into stdout/stderr/JSON. Existing public call sites are not rewritten by this wave unless Agent 0 separately approves a concrete correction.

## 8. WX-0023/WX-0024 — bounded owned temporary-copy smoke

Create two separate owned directories, one containing spaces (`WebAppX setup spaces`) and one containing Unicode plus spaces (`WebAppX Café 東京 setup`). Use `tempfile.TemporaryDirectory`; names are fixed test fixtures, not user paths. Report the platform actually exercised; a Mac path test establishes no Windows execution. Paths are passed as separate arguments, not quoted command strings. Keep each child bounded (for example 20s and 1 MiB output), enforce successful exit/expected structured result, and clean only the exact created directory after children exit. Errors retain a bounded artifact outside tracked source if useful. No service/process search or unrelated listener cleanup.

Copy a reviewed public allowlist sufficient for real dependency-free setup reads: package metadata/pins, new discovery/docs/inventory tools+their public inputs, public documentation scope, relevant source descriptors, and the manager/bootstrap/installation files plus exact retained release snapshots needed for genuine SYSTEMX status/doctor. Preserve snapshot bytes and installation/provenance; don't handcraft a stub manager or mutate snapshots to make the fixture pass. Bound file count/total bytes before copying; refuse symlinks and unexpected files. Exclude `.git`, `node_modules`, installs/caches, private environments, ignored local/runtime/history and research/media not required by the selected checks. If genuine manager verification needs a listed asset, include that exact required asset under the bounded copy budget rather than weakening verification.

Exercise these actual paths from each copy:

1. `node <copied scripts/developer-prerequisites.mjs> --json` using the known Node executable. This probes only installed versions and reports actual requirements; no download fallback.
2. Actual `scripts:list --json`, `docs:commands:check`, and `fixtures:list --json` through their copied CLI entry points. They need no app dependency install. Also run at least `npm run --silent scripts:list -- --json` through the installed npm CLI with its own argument array to exercise real npm script/CWD handling, not only pure function calls. Locate that CLI by the existing doctor's safe method; unavailable prerequisites fail clearly, never `npx`/install.
3. `[sys.executable, '-I', '-B', copied_manager, 'status', '--target', copied_root]`: parse JSON, assert exact copied target/default paths, selected installation version/manual pin and verified integrity. No startup update or service start.
4. Write a small fictional **project configuration in the owned copy only**, using the existing project schema and argument-array commands that refer to `sys.executable`, with a project name containing Unicode. Then `[sys.executable, '-I', '-B', copied_manager, 'run', '--target', copied_root, '--offline', '--', 'doctor']`. Actual selected doctor validates/reads that configured project and reports the exact fictional name/configured-check count; it does not execute those configured checks. Set auto-update off/manual from preserved installation and explicitly pass `--offline`.

Before/after compare a complete public-copy byte inventory and ignored-preservation sentinel files (`.env.local`, `.emulator-data/keep`, `.SYSTEMX/local/keep`, `.SYSTEMX/state/keep`, `.SYSTEMX/.systemx/history/keep`) created with harmless markers in the fixture. After the intentional project-config write, take a new baseline before read-only commands. Assert no new save, runtime/session, bytecode, lock or dependency directory. Configure `PYTHONDONTWRITEBYTECODE=1`/`-B`, disable automatic Python manager installation and npm update notifier/audit/fund checks in child-only environment. Never copy/read real ignored secrets or parent environment values into a report.

No `npm ci/install`, browser install, Vite/LAN/emulator/server startup, Firebase/Gusto call, setup orchestrator, `init/install/update`, sync/apply, provider authentication or deployment runs are needed. These cases prove selected read-only setup behavior in owned paths; they do not prove installation/runtime acceptance across operating systems.

## 9. WX-0011/WX-0012/WX-0020 — documentary content to implement

### Four troubleshooting branches (0011)

In GETTING-STARTED add one entry decision table: symptom -> exact read/check -> safe next step -> success observation/further stop condition. Link the detailed installation recovery section.

- Dependency failure: choose root/starter/Functions package; preserve the error and corresponding committed package+lock; runtime/version checks; retry the same locked install after its concrete network/runtime cause is corrected. A lock mismatch is reviewed dependency work, never an automatic `npm install` fallback.
- Runtime mismatch: root/starter `.nvmrc` and `.node-version` select Node24.22.0, `engines >=24.0.0`, npm11.11.0; Functions separately Node22 major without an exact patch/npm pin. `node --version`, `npm --version`, dependency-free `node scripts/developer-prerequisites.mjs`/`npm run doctor`, and `npm run development:check` have different scopes. Existing version-manager setup is a prerequisite, not something a read-only diagnosis installs.
- Occupied port: inspect PID/command/CWD for the named listener using platform-appropriate commands; retain unrelated process and origin saves. Native `npm run dev:mock -- --port 5185` or integrated `npm run dev:systemx -- --host 127.0.0.1 --port 5185` pins one origin and refuses conflict. Choose a different explicit unused port deliberately, or omit origin overrides for automatic choice; explain scheme/host/port/profile save separation. Never kill by port/name or claim a restart preview reserves a port.
- Emulator startup: `npm run systemx:session:status` shows stored component observations plus current process metadata; inspect Vite/LAN/Auth/Firestore/Storage separately and the owning terminal output. Check already installed tools with `firebase --version` and `java -version` before a deliberate relaunch; missing tools follow the prerequisite guide, never an implicit download during diagnosis. Use Ctrl+C in the owning terminal; macOS owned stop may verify/signal recorded ownership, whereas Windows combined stop explicitly refuses and requires that terminal. `systemx:session:restart:preview` is advisory only. Correct the failed prerequisite and launch again; no blind loop or deletion of state. Storage ready is TCP-only; source pass/app ready does not certify emulator workflows/provider/deployment.

### Interrupted install (0012)

In RUNBOOK add the recovery procedure, linking DEPENDENCY-INSTALLATION. Safe dependency rebuild targets are **only** the chosen package's generated dependency tree: root `node_modules/`, adopted/starter app's own `node_modules/`, or `integrations/gusto/functions/node_modules/`. `npm ci` performs the required node_modules replacement; no manual recursive cleanup command is necessary. Nested package lock/runtime selection stays separate. `dist`, `dist-ssr`, `*.tsbuildinfo` are generated build outputs and may be described separately as rebuildable, but deleting them is not an install-repair step and cannot justify wiping other ignored paths. Preserve npm cache by default; don't suggest cache-force cleanup without a diagnosed cause.

Always retain package manifests, package locks and reviewed `.npmrc` settings. Preserve `.env*` and approved ignored secrets, `.emulator-data`, `.auth`, `.firebase`, `.firebaserc.local`, local downloads/backups, `.SYSTEMX/LAN/{Temp,Backup,Files}`, `.SYSTEMX/local`, `.SYSTEMX/logs`, `.SYSTEMX/state`, `.SYSTEMX/.systemx/{history,operations}`, selected installation/snapshots and adopted project records. Git ignore alone never makes data disposable. Use the affected package only: root `npm ci`; starter `npm --prefix .SYSTEMX/Template/starter ci` (or `npm ci` inside its adopted checkout); Functions `npm --prefix integrations/gusto/functions ci` after selecting Node22; matching npm can be explicitly invoked as documented, with registry/cache/lifecycle effects disclosed. A retry result needs its own verification; this documentation records no new install.

### Scaffold identity checklist (0020)

In the private adoption example include five explicit owner choices with actual locations and verification:

1. Repository/destination identity: choose new repository/remote and local folder deliberately. Use the supported `npm run repository:identity -- --expected-repository OWNER/REPO --json` when that separate direct GitHub observation is intended; it reads local Git and contacts the reviewed remote main, so it is not part of offline path smoke. `gh repo create` is an optional authorized action, not part of this documentary review.
2. Package identity: root `package.json`, root lock top-level and `packages['']`, starter package+lock if retaining it as the maintained sibling; preserve versions/runtime/dependencies unless separately changed. The optional Functions package has its own deliberate name. No blind string replacement or lock regeneration for a source-only review.
3. Site branding: `index.html` title/description/OpenGraph, `public/favicon.svg`/`robots.txt`, `src/pages/HomePage.tsx`, Navbar/Footer and public README/brand assets; corresponding starter fields only when that distribution is retained. Review siteControls config separately. Avoid claims that package/remote rename changes rendered branding.
4. Deployment target: `.firebaserc` currently holds `your-firebase-project-id`; review `firebase.json`, rules/indexes/hosting target and approved environment configuration. Leave unadopted targets/services explicitly unconfigured. Local mocks need no provider account. Preflight or setup does not authorize production deployment.
5. Project records: outer `.SYSTEMX/project.json` metadata/check/command argument arrays, accepted GLOBAL/PLAN/WORK/MEMORY/AGENTS records in the new adopted project. Public reusable seeds and selected release snapshots remain blank/immutable; no private project data goes upstream. Installation/import behavior stays governed by SYSTEMX-INTEGRATION and explicit reviewed imports.

Add real source links and a read-only verification checklist (`development:check`, relevant source/report checks, template integrity where applicable). Do not run services, rename this template or populate its blank reusable records to demonstrate the checklist.

## 10. Meaningful verification and one integration pass

New unit coverage should test behavior that could fail, not only mirror formatting:

- Discovery: all six literal purpose representatives and exact real membership; changed manifest command reflected; new/stale/duplicate classification; hostile command strings remain inert and source bytes unchanged.
- Docs parser: inline/fenced/CRLF/line diagnostics, flag order/shorthands/`--`, typo even under if-present, ordinary npm commands, nested package/placeholder/historical context, malformed/ambiguous context, no filesystem escape, no payload leakage and no subprocess/eval.
- Fixture inventory: literal required eight groups above and complete HR builder/reset links, real UI labels, source disappearance/duplicate/unknown descriptor, no native/SDK reset crossclaim, no source writes or fixture-generation import.
- Starter parity: independent one-change-per-four-group fixtures, intentional variant, asset exactness/text CRLF, missing/unlisted/collision/symlink, simultaneous old integrity/new parity failures and preserved `--against` contract.
- Child-process check: actual imported/aliased/namespace/promisified call cases; safe argv versus exec/string/shell/interpreter channels; Python forms; new copy of allowlisted unsafe call exceeds count; modified/stale baseline; parser failure; fake literal secret absent from every output. Scanned fixtures must contain an execution/write trap that remains unexecuted.
- Paths: both owned names execute the actual bounded commands above, exact Unicode config readback/status target, source+sentinel byte preservation, process timeout/failed-child cleanup and no services/install/parent changes.

Agent 0 wires proposed aliases and every added alias's purpose classification together. Use a single `setup:contracts:test` aggregate for the new Node tests. The new Python path cases and parity cases run once under existing `systemx:integration:test` unittest discovery; add a separate alias only if separately needed, and do not run that alias again in CI. Put read-only `scripts:list --check`, `docs:commands:check`, `fixtures:list --check`, `source:shell:check` in the literal CI loop once each. Existing `template:check` includes grouped parity once. Register exact new commands/effects in ci-plan and update its independent expected stage/order tests. No change to existing stage order/semantics beyond reviewed insertions; no parser broadening to arbitrary shell syntax.

After each lane's meaningful focused tests pass, stop optional repetitions. Agent 0 performs one integrated planned gate run and the existing required publication gates on the final selected source, then records exact logs/source hashes and any failures. Do not count a read-only report as a test, claim Windows from Mac copies, or relabel older browser/install receipts. Documentary criteria receive explicit source review; runtime-independent setup criteria receive the authored real CLI/temporary-copy evidence. Canonical statuses/completions change only through the normal reviewed evidence process after their unchanged original criteria are met.

## 11. Handoff facts and final boundaries

At preparation: source review only; original ten proposals untouched. No tests, npm command, Git command, install, package manager, browser, service, emulator, provider, build or deployment was run for this planning task. Shell tools only read public files, parse JSON, search source and write this `/tmp` artifact. No private environment/runtime data was read.

Re-read the selected source at implementation time, especially package aliases/CI, payroll seed/default consumers, reset labels and root/starter mapping. The current audit source and this plan must not be used as an evergreen assertion of future repository state.
