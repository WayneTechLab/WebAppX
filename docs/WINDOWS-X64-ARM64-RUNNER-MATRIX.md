# Windows x64 and ARM64 CI acceptance matrix

**V2 artifact design reviewed; runtime unadopted — 2026-10-15.** Agent 0 reviewed the amended policy after independent source/artifact recheck. Original WX-0820 catalog acceptance remains separate. Historical source context `42818dd7baf3d335f27c401c37d048bd842617fa` was supplied by Agent 0 during the original drafting period; it does not establish a CI, adapter, runner or provider result. The original draft and v2 source observations are preserved separately in the [source-review record](evidence/adoption-contract-source-review.json). No external setup or execution is performed by this guide. A later source re-review after the CRM integration freeze is pending. See the [adoption index](ADOPTION-CONTRACTS.md).

- Original source: `docs/TEMPLATE-MAINTENANCE.md`.
- Original gate: `operator`; priority `P1`; declared dependencies: `[]`.
- **Original acceptance:** For optional operator-approved adoption: An optional runner plan identifies which host, import, test and build checks must run on each architecture and records unavailable runner coverage explicitly.

**Version 2 documentary amendment:** the original matrix SHA-256 `63e1207fc8fb399d7a625568f79819f227c889b435530619e7f54bb7975d11d1` remains preserved. This version names the native `pwsh` prerequisite, its actual version/architecture evidence and existing platform gaps. No U cell becomes a pass and no runner/test was executed.

## 1. Runner proposal versus available resources

Two **proposed** profiles are required: `windows-x64-native` and `windows-arm64-native`. They are design identifiers, not GitHub runner labels, purchased capacity or an activated workflow. No account runner inventory, hosted-runner entitlement, machine identity or installed native toolchain was inspected. Both profiles are currently **unavailable to this draft / not executed**. A downstream operator must identify and authorize the actual resources before scheduling a job.

Do not count WSL/Linux containers, a macOS path smoke, x64 emulation on ARM64, or a source-only Windows branch as native architecture acceptance. A mixed-architecture compatibility profile can be reviewed separately with every actual tool architecture recorded; it cannot silently fill the native ARM64 column. No current vendor/hosted-runner availability claim is made, so no external runner research was needed for this source-only proposal. Verify current native tool/browser availability from official vendor documentation before selecting a resource.

## 2. Prerequisites and admission

| Code | Proposed required observation before gates | Missing/unavailable outcome |
| --- | --- | --- |
| R | Actual Windows version/architecture; Node `process.platform=win32` and expected `process.arch=x64` or `arm64`; app/starter Node **24.22.0**, npm **11.11.0**; Python **>=3.12.0**; parseable Git; exact reviewed source/lock hashes and owning runner workspace. | Block that profile. A version pin is not proof a native binary exists or ran. Keep paths/host identities in protected run records. |
| B | A deliberately selected Windows-compatible Bash invocation for the unchanged aggregate `ci:all` and explicit Bash stages; record shell/tool architectures and path translation behavior. | Full 68-stage aggregate remains unavailable. Do not replace Bash with PowerShell text evaluation, delete stages or assert WSL coverage as native Windows. |
| P | The actual `python3` command used by manifest entries, plus the scanner's fixed installed Python selection; automatic manager installation disabled. Verify the chosen interpreter path/version/architecture. | Block affected stages; the doctor's alternative probe does not itself rewrite manifest `python3` invocations. No on-demand download fallback. |
| W | A deliberately selected installed native **`pwsh`** executable for this Windows profile. PowerShell 7 is the proposed major family; exact approved version/patch and actual availability remain unselected. Record executable identity, `$PSVersionTable.PSVersion`, actual OS and process architecture (for example `[System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture`) in protected run evidence, and verify expected native x64/ARM64 rather than an emulated process. | Missing/wrong-architecture/unreviewed `pwsh` leaves named PowerShell launcher coverage unavailable, even if the aggregate exits 0. `powershell.exe`, Bash and WSL are not substitute observations. No installation or version support is claimed by this plan. |
| D | Reviewed locked root dependency install using the selected runtime; manifests/locks unchanged; optional Functions has its separate lock and Node22 policy. | Installation is a separate explicit setup action with registry/cache/lifecycle effects, not a gate result. No blind lock regeneration or npm-install fallback. |
| C | Explicitly installed Chromium for pinned **Playwright 1.64.1**, supported on the selected actual native Windows profile, with version/architecture recorded. | Block browser stages; no suite auto-download or emulated-browser pass claim. Native availability must be verified before planning installation. |
| O | Owned temporary directories/loopback ports, paths with spaces and Unicode, safe argument-array launch and verified descendant cleanup. No user browser/profile or unrelated listener is reused/cleared. | Refuse the owned run or retain a failure artifact; do not kill processes by name/port. |
| N | Explicit permission for the reviewed npm registry/audit requests and installed nested lock metadata where required. No provider account or deployment secret supplied. | Record audit unavailable/failure; do not call a cache-only result current registry evidence or skip the required stage. |

`R` is the common baseline for every row; installed dependencies `D` are required wherever the manifest uses them. The table adds specialized needs without claiming to enumerate every transitive platform dependency. Direct launcher classification is source metadata, not proof of Windows portability.

The ordinary native/SDK mock browser journeys need no Firebase or Gusto account. Optional real Auth/Firestore/Storage emulator workflows have separately installed Firebase CLI/Java and adopted policy prerequisites; they are not silently added to this 68-stage list. Functions Node22 execution, real provider transport, manual screen-reader use and production deployment remain separate evidence scopes.

## 3. Exact current 68-stage order and unavailable architecture cells

The maintained runner is `npm run ci:all` → `bash scripts/check-template.sh`. Its literal loop defines these **68 unique sequential stages**, all present in the current **134-script** root manifest. The existing pure `buildCiPlan` API classified the exact command signatures with `unknown=false`; it executed no commands. Keep the original order, delegation, pre/post lifecycle behavior and underlying manifest strings unchanged. Each entry below is the exact manifest-backed stage invocation; complete executable strings remain authoritative in the hashed `package.json`.

**U** means **unavailable/unexecuted: no authorized architecture runner/result is supplied by this draft**. It is never a pass or an optional omission. Fresh actual stage logs, exit status, counts/skips, source and architecture bindings must replace U before acceptance of that coverage.

| # | Exact required stage | Family | Direct launcher | Extra needs | Windows x64 | Windows ARM64 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `npm run development:check` | host/setup/harness | Node | R | U | U |
| 2 | `npm run development:test` | host/setup/harness | Node | R | U | U |
| 3 | `npm run scripts:check` | host/setup/harness | Node | R | U | U |
| 4 | `npm run docs:commands:check` | host/setup/harness | Node | R | U | U |
| 5 | `npm run fixtures:check` | host/setup/harness | Node | R | U | U |
| 6 | `npm run source:shell:check` | host/setup/harness | Node | R+P | U | U |
| 7 | `npm run setup:contracts:test` | host/setup/harness | Node | R+P | U | U |
| 8 | `npm run environment:check` | host/setup/harness | Node | R | U | U |
| 9 | `npm run environment:test` | host/setup/harness | Node | R | U | U |
| 10 | `npm run repository:identity:test` | host/setup/harness | Node | R | U | U |
| 11 | `npm run dev:mock:test` | host/setup/harness | Node | R+O | U | U |
| 12 | `npm run systemx:session:test` | host/setup/harness | Node | R | U | U |
| 13 | `npm run ci:plan:test` | security/types/lint | Node | R | U | U |
| 14 | `npm run backlog:plan:check` | catalog/evidence | Node | R | U | U |
| 15 | `npm run backlog:plan:test` | catalog/evidence | Node | R | U | U |
| 16 | `npm run backlog:evidence:check` | catalog/evidence | Node | R | U | U |
| 17 | `npm run backlog:evidence:test` | catalog/evidence | Node | R | U | U |
| 18 | `npm run backlog:impact:test` | catalog/evidence | Node | R | U | U |
| 19 | `npm run docs:freshness:test` | catalog/evidence | Node | R | U | U |
| 20 | `npm run systemx:work-status:test` | managed/import/integrity | Node | R | U | U |
| 21 | `npm run doctor` | host/setup/harness | Node | R | U | U |
| 22 | `npm run doctor:test` | host/setup/harness | Node | R | U | U |
| 23 | `npm run browser:smoke:test` | host/setup/harness | Node | R+O | U | U |
| 24 | `npm run browser:keyboard:test` | host/setup/harness | Node | R | U | U |
| 25 | `npm run backlog:check` | catalog/evidence | Node | R | U | U |
| 26 | `npm run backlog:test` | catalog/evidence | Node | R | U | U |
| 27 | `npm run template:check` | managed/import/integrity | Python 3 command | R+P | U | U |
| 28 | `npm run systemx:status` | managed/import/integrity | Python 3 command | R+P | U | U |
| 29 | `npm run systemx:validate` | managed/import/integrity | Bash | R+B | U | U |
| 30 | `npm run sync:system:check` | managed/import/integrity | Bash | R+B | U | U |
| 31 | `npm run research:validate` | managed/import/integrity | Python 3 command | R+P | U | U |
| 32 | `npm run systemx:tools:test` | managed/import/integrity | Python 3 command | R+P+W | U | U |
| 33 | `npm run systemx:integration:test` | managed/import/integrity | Python 3 command | R+P | U | U |
| 34 | `npm run security:controls:test` | security/types/lint | Python 3 command | R+P | U | U |
| 35 | `npm run ci:lint` | security/types/lint | installed npm CLI pipeline | R | U | U |
| 36 | `npm run ci:typecheck` | security/types/lint | installed npm CLI pipeline | R | U | U |
| 37 | `npm run ci:test` | security/types/lint | Node | R | U | U |
| 38 | `npm run hr:test` | domain/adapter source | Node | R | U | U |
| 39 | `npm run hr:roles:check` | domain/adapter source | Node | R | U | U |
| 40 | `npm run hr:roles:test` | domain/adapter source | Node | R | U | U |
| 41 | `npm run gusto:capabilities:check` | domain/adapter source | Node | R | U | U |
| 42 | `npm run gusto:capabilities:test` | domain/adapter source | Node | R | U | U |
| 43 | `npm run portals:test` | domain/adapter source | Node | R | U | U |
| 44 | `npm run maturity:test` | domain/adapter source | Node | R | U | U |
| 45 | `npm run safety:test` | domain/adapter source | Node | R | U | U |
| 46 | `npm run adoption:hr-disabled:test` | domain/adapter source | Node | R | U | U |
| 47 | `npm run adoption:hr-disabled` | owned app/browser | Node | R+O+C | U | U |
| 48 | `npm run browser:smoke` | owned app/browser | Node | R+O+C | U | U |
| 49 | `npm run browser:keyboard` | owned app/browser | Node | R+O+C | U | U |
| 50 | `npm run browser:foundation` | owned app/browser | Node | R+O+C | U | U |
| 51 | `npm run browser:state-contract` | owned app/browser | Node | R+O+C | U | U |
| 52 | `npm run browser:lifecycles` | owned app/browser | Node | R+O+C | U | U |
| 53 | `npm run browser:portal-lifecycle` | owned app/browser | Node | R+O+C | U | U |
| 54 | `npm run browser:recruiting` | owned app/browser | Node | R+O+C | U | U |
| 55 | `npm run browser:payroll` | owned app/browser | Node | R+O+C | U | U |
| 56 | `npm run browser:evaluators` | owned app/browser | Node | R+O+C | U | U |
| 57 | `npm run browser:maturity` | owned app/browser | Node | R+O+C | U | U |
| 58 | `npm run browser:safety` | owned app/browser | Node | R+O+C | U | U |
| 59 | `npm run browser:quality` | owned app/browser | Node | R+O+C | U | U |
| 60 | `npm run browser:sdk-quality` | owned app/browser | Node | R+O+C | U | U |
| 61 | `npm run browser:recovery-drill` | owned app/browser | Node | R+O+C | U | U |
| 62 | `npm run browser:work-status` | owned app/browser | Node | R+O+C | U | U |
| 63 | `npm run hr:backend:audit` | dependency audit | installed npm CLI pipeline | R+N | U | U |
| 64 | `npm run docs:links` | documentation | Node | R | U | U |
| 65 | `npm run ci:security` | security/types/lint | Node | R+N | U | U |
| 66 | `npm run ci:ai` | security/types/lint | Node | R | U | U |
| 67 | `npm run ci:audit` | dependency audit | installed npm CLI pipeline | R+N | U | U |
| 68 | `npm run build` | app build | installed npm CLI pipeline | R+D | U | U |

The current `build` script retains `tsc -b --noCheck && vite build && node .SYSTEMX/scripts/assert-lan-isolation.mjs`; it does not replace stage 36's separate `ci:typecheck`. Stage 37 delegates to the actual `test` script. Stage 63 audits the optional Functions package; that is not a Node22 provider-runtime test. Stages 65/67 can perform npm audit requests. A full aggregate exit 0 with platform-skipped tests still requires explicit review of those skipped scopes.

## 4. Host/import/test/build observations required on each architecture

1. **Host/tool admission:** record actual OS and each tool architecture/version, locked-install receipt and source/lock hashes. Run the actual prerequisite/development reports under the selected native Node. Never infer ARM64 from the machine's marketing name or x64 from an emulated process.
2. **Managed/import preservation:** stages 27–34 retain template, selected installation, drift, retained research, actual upstream-tools/integration and security source checks. Preserve immutable snapshots and original fingerprints. Stages 18/19 include real temporary Git fixture and documentation-freshness refusal/preservation tests; stage 33 includes the new spaces/Unicode setup-copy cases. A runtime import/apply into the real project is not required and must not be substituted for those owned fixtures.
3. **Unit/contract/domain checks:** preserve the actual setup, environment, session, catalog, HR, CMS, CRM, payroll and safety tests. Record all pass/fail/skip counts per command. A symlink privilege skip or unsupported descendant-cleanup path remains unavailable evidence, not successful negative-path coverage.
4. **Owned runtime/browser checks:** execute each authored browser/adoption suite with its own app/browser contexts. Keep exact source/harness/artifact manifests, downloads/uploads, literal state assertions, network/page errors, traces and cleanup results. Observe native process cleanup after failure/timeout; preserve failed artifacts. No inherited macOS screenshot or receipt populates either Windows column.
5. **Build/output:** require the exact typecheck/build sequence and LAN-isolation result on the same source/dependency/runtime binding. Record output manifests; no publish, deploy or provider acceptance follows.

### Named PowerShell and platform coverage cells

The selected upstream tests use `shutil.which('pwsh')` to decide whether to execute their PowerShell cases. Stage 32 delegates through `scripts/test-systemx-tools.py` to those actual selected release tests. Both named launcher cases must be observed **executed, not skipped**, under the selected native `pwsh` version/architecture before PowerShell launcher acceptance. A green aggregate without that prerequisite is narrower evidence.

| Exact authored scope / source | Windows x64 | Windows ARM64 | Receipt requirement or current limit |
| --- | --- | --- | --- |
| `test_powershell_folder_launcher_matches_bash_without_managed_state` — selected release `tests/test_systemx.py` | U | U | Require actual native `pwsh -NoProfile -File` folder-launcher case and absence of created managed/project state; capture terminal/count/skips. |
| `test_powershell_managed_launcher_uses_selected_verified_defaults` — selected release `tests/test_manager.py` | U | U | Require actual native managed launcher using selected verified defaults; retained unverified runner must not execute. |
| `test_real_worker_timeout_kills_owned_descendant_and_removes_owned_extraction_tree` — `tests/systemx/test_import_rehearsal.py` | U — authored Windows skip | U — authored Windows skip | Existing `os.name == 'nt'` skip excludes the POSIX descendant teardown proof. A future Windows aggregate cannot fill it; new owned native proof would require separately reviewed implementation/evidence. |
| `test_parent_interruption_stops_isolated_worker_tree_before_workspace_cleanup` — same import test | U — authored Windows skip | U — authored Windows skip | Existing Windows skip excludes POSIX session-interruption proof; keep unavailable even on successful aggregate. |
| `CLI preview preserves a live fixture process, bound listener, session, token and runtime config byte for byte` — `.SYSTEMX/LAN/tests/session-restart-preview.test.mjs` | U — authored Windows skip | U — authored Windows skip | Current suite skips this live fixture preview-preservation case on Windows. Source inspection or other CLI assertions do not substitute. |
| Post-failure PID absence inside `test_owned_child_failure_timeout_and_output_bounds_cleanup` — `tests/systemx/test_setup_paths.py` | U — no Windows PID-absence assertion | U — no Windows PID-absence assertion | Windows path asserts terminal child return status, but `os.kill(pid,0)` absence proof is guarded to POSIX. Record that narrower actual scope; no descendant/PID cleanup acceptance inferred. |

Here “selected release” is `.SYSTEMX/.systemx/releases/1.9.0-alpha.6/`; those immutable bytes are read, never patched for this plan. Additional privilege/tool skips must also remain explicit in the future per-suite receipt. These six named rows supplement, and do not change, the 68 aggregate stages.

Current Windows combined-session stop intentionally refuses and requires Ctrl+C in the owning terminal; native Windows Agent Y `run --apply` remains unaccepted pending verified descendant termination, as documented by the repository. Those limits cannot be removed by reporting this matrix or by a Windows source-check pass.

## 5. Proposed job and receipt bounds

Proposed future job budget: **120 minutes** aggregate; **20 minutes** maximum per stage without widening existing child timeouts; at most **32 MiB** retained text per stage and **4 GiB / 25,000 files** for the owned artifact set. These are review proposals, not current CI limits or an account quota. On timeout/overflow, stop the owned job, retain bounded diagnostics and report incomplete evidence; never truncate a successful-looking log or discard failed captures to fit a pass.

A future architecture receipt records: exact source and input hashes, native tool architectures, selected installation/version, each of 68 stage names in order and terminal outcomes, per-suite test/skip counts, artifact manifests, cleanup observations, unavailable cells/reasons, independent reviewer and decision. Runtime artifact paths/host IDs stay protected outside reusable source. Missing result is `unobserved`, not `not-applicable` without a reviewed reason.

## 6. Literal fictional worked and denied cases

These are **design cases only**, not Windows runs, actual resources or operator approvals.

Worked planning example: `fictional-runner-plan-00` proposes
`windows-x64-native`, expected Node `24.22.0/x64`, npm `11.11.0`, installed
Python `>=3.12.0/x64`, a reviewed Bash binding, deliberately selected native `pwsh` with exact version/architecture still unobserved, and pinned Playwright/Chromium.
The source plan supplies the exact 68-stage order above. Its `runnerRef` remains
`unassigned`, tool observations remain `unobserved` and `execution` is
`not-executed`. A reviewer can verify that the plan names host/import/test/build
work and honest admission requirements; no architecture result changes from U.
If an actual authorized resource is later selected, all prerequisite facts and
all 68 outcomes must be observed afresh before a runtime acceptance decision.

| Case | Literal proposed facts | Expected plan disposition |
| --- | --- | --- |
| `fictional-runner-plan-01` | Requested profile `windows-arm64-native`; actual inventory/entitlement not supplied | Every ARM64 cell remains U; request an authorized resource/tool availability review. No job starts. |
| `fictional-runner-deny-01` | OS is ARM64, selected Node reports `process.arch=x64` | Refuse native ARM64 acceptance; record a separately proposed compatibility profile only. |
| `fictional-runner-deny-02` | Native Node/Python present but Bash unavailable | Aggregate `ci:all` unavailable; direct partial stage results, if later run, cannot be called all-68 completion. |
| `fictional-runner-deny-03` | Stages 1–67 have receipts, build has no terminal result | Full job incomplete; no inferred build/pass, acceptance or publication. |
| `fictional-runner-deny-04` | Browser artifacts copied from a macOS run | Both native Windows browser cells remain U; source equality is not architecture execution. |
| `fictional-runner-deny-05` | Stage exits 0 after a symlink case is skipped for missing privilege | Record the skip and that negative-path gap explicitly; do not claim the skipped condition was exercised. |

### Additional v2 literal cases

| Case | Literal proposed facts | Expected plan disposition |
| --- | --- | --- |
| `fictional-runner-deny-06` | `pwsh` absent; stage 32 exits 0 after its two `skipUnless` launcher cases skip | Aggregate source/test result, if actually observed, remains narrower; both named PowerShell launcher cells U. No PowerShell acceptance. |
| `fictional-runner-deny-07` | ARM64 host uses x64 `pwsh`, or only `powershell.exe` is available | Native ARM64 PowerShell prerequisite not met; keep launcher cells U; no emulation/substitution pass. |
| `fictional-runner-deny-08` | All aggregate stages later succeed on Windows with the authored teardown/interruption/LAN skips | Record exact skips and the setup terminal-status-only boundary; named skipped runtime scopes remain U. |

## 7. Artifact mapping and downstream adoption inputs

| Original requirement | Concrete draft coverage |
| --- | --- |
| Optional runner plan | Sections 1–2 identify proposed profiles and real admission facts without asserting account capacity. |
| Host/import/test/build checks per architecture | Sections 3–4 preserve all 68 actual stage names/order and map platform prerequisites/evidence for both columns. |
| Unavailable coverage explicit | Every architecture cell is U, with blocked examples and receipt rules in sections 1/3/5/6. |

Agent 0 reviewed the source/stage contract, proposed platform/Bash/native-`pwsh` requirements, budgets and required-versus-optional coverage for this artifact design; actual host/version/architecture/browser availability still needs an authorized observation. Actual runners, native tool/browser support, installed dependencies, architecture execution, cleanup evidence and any CI resource permissions remain unverified. Operator/provider/deployment/manual accessibility acceptance is separate. This draft neither creates a workflow nor changes required gates.

## Historical public source bindings

- `package.json` — SHA-256 `9dfe138a4cc64035e703cd7219d67a9bd95a346fc7c0e5cd4f21295bef61475d`.
- `scripts/check-template.sh` — SHA-256 `059480f0a672973732e21d53b44176692ce94054213a7062df07c3136c8e8e9c`.
- `scripts/ci-plan.mjs` — SHA-256 `c1e0933c2e07f782d023335f8a1786e0d9a0516aeea5876696c95a23b5b84051`.
- `docs/DEPENDENCY-INSTALLATION.md` — SHA-256 `5e24cb3c07e429aadf7653b70eac52d6dd3879e2e52549496dcee9bd5bec392f`.
- `docs/TEMPLATE-MAINTENANCE.md` — SHA-256 `d11316e53524deb4cdaac69a08be09b3c73872e5556dcea891c248eda93fb85d`.
- `scripts/developer-prerequisites.mjs` — SHA-256 `2bee0b8992e36b1747a03367913cd48f3e77fb3f00efc71486a585946380fe92`.
- `tests/systemx/test_setup_paths.py` — SHA-256 `26b4825209cfb612d78f2129382fb337f29959d45814f4ed2588d656bad14c08`.
- `.SYSTEMX/INSTALLATION.json` — SHA-256 `5c63df95b6928d3a3eea81aede804acc7c1b9a897fbf7fd4d18f3a2ed13fa3bb`.

## Additional v2 source bindings for named coverage

- `scripts/test-systemx-tools.py` — SHA-256 `ea2f3b14b96e154706263deafbb6755b5dd83bd9d5cd9e8bd4d654c051b59eb0`.
- `.SYSTEMX/.systemx/releases/1.9.0-alpha.6/tests/test_systemx.py` — SHA-256 `38094e13d58f3e7c481e088fdf79be6b3002b78e971db606147531b2dd836eee`.
- `.SYSTEMX/.systemx/releases/1.9.0-alpha.6/tests/test_manager.py` — SHA-256 `aaa63ae074afe00e88c5dcb33e7cdab52efc579fac1d224712a7b6c9e63c319c`.
- `tests/systemx/test_import_rehearsal.py` — SHA-256 `61446715f1167ad24ab43031322bae414830334a2b12dab272abfb7356f1b306`.
- `.SYSTEMX/LAN/tests/session-restart-preview.test.mjs` — SHA-256 `7c232978cc3d5e777977d02c2c45f0b7eca1f5257d82786b93d11a42e6a3f4bd`.
