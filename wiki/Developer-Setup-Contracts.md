# Developer setup contracts

## Accepted developer setup checkpoint

Agent 0 accepted the ten original setup criteria WX-0011–WX-0014, WX-0016,
WX-0019, WX-0020 and WX-0022–WX-0024 after the complete 68-stage CI and
Hosting preflight on source `42818dd7baf3d335f27c401c37d048bd842617fa`.
The [dated QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PAYROLL-SETUP-QA-2026-10-15.md)
separates the early focused observations below from that fresh integrated run,
original-criterion acceptance and publication. Windows execution remains unobserved.


WebAppX provides source checks for command discovery, documented npm names,
fictional defaults, starter parity and child-process construction. Use
[Getting Started](../docs/GETTING-STARTED.md) to install and run the app,
[dependency installation](../docs/DEPENDENCY-INSTALLATION.md) to select the
correct root/starter/Functions runtime, and the [runbook](../docs/RUNBOOK.md)
for interrupted installs, occupied ports and emulator failures. These checks
do not start the app or make a provider account necessary for native mocks.

## Seven package aliases

Run these from the repository root. Their actual commands live in
[package.json](../package.json); the [command reference](../docs/COMMANDS.md#developer-setup-contracts)
also covers structured output and the wider development commands.

| Alias | Purpose |
| --- | --- |
| `npm run scripts:list` | Read-only real-manifest command discovery |
| `npm run scripts:check` | Strict exact script-purpose membership check |
| `npm run docs:commands:check` | Maintained npm example/name and package-context check |
| `npm run fixtures:list` | Read-only fictional source/reset inventory |
| `npm run fixtures:check` | Strict source/reset descriptor check |
| `npm run source:shell:check` | Bounded JS/TS and Python child-process AST review |
| `npm run setup:contracts:test` | Focused Node regression tests for those contracts |

The discovery report groups all current scripts under exactly **setup**, **app**,
**portal**, **SYSTEMX**, **wiki** and **release**. It prints the real manifest
command strings as text without executing them. A purpose is descriptive;
listing an install, deploy or publication command grants no authority to run it.
Strict mode refuses missing/stale/duplicate classifications rather than assigning
an unknown alias to a catch-all group.

```bash
npm run --silent scripts:list -- --json
npm run --silent docs:commands:check -- --json
npm run --silent fixtures:list -- --json
npm run --silent source:shell:check -- --json
```

Discovery, documentation and fixture inventory need no dependency installation.
The AST check uses installed TypeScript and Python; it downloads nothing. The
test aggregate runs tests and owns temporary fixtures, so it has local writes.
See [command effects](../docs/COMMAND-SAFETY.md#setup-source-checks-and-temporary-copy-effects).

## Documented command names and exact contexts

The documentation checker reads the root README, maintained `docs/` and `wiki/`
Markdown, and the standalone starter README. It parses inline/fenced examples,
options, npm script shorthands and argument boundaries without executing examples
or interpreting a shell. Ordinary npm installation/version commands are not
treated as root script names. A misspelled real alias still fails when an example
uses an optional-execution flag.

Only three manifests are supported: root, standalone starter and optional Gusto
Functions. Literal supported prefixes establish their package context; ambiguous
directory changes or dynamic prefixes require review. Explicit placeholders and
historical examples remain labeled separately from validated current commands.
The checker reports locations, script names and fixed reasons, without echoing
command arguments, assignments or secret-like payloads.

[Exact context metadata](../scripts/doc-command-contexts.json) binds a single
path/line/column/script occurrence to its normalized command and complete
document hashes, context, reason and reviewed source basis. Historical exceptions
preserve the original receipt; they do not make the historical alias available
today. Changed documents or moved examples require deliberate review and rebind.
There is no blanket file waiver or automatic metadata writer. Follow the
[maintenance procedure](../docs/TEMPLATE-MAINTENANCE.md#review-setup-metadata-and-starter-parity)
when a check reports drift.

## Fictional sources and restoring actions

The finite [inventory descriptors](../scripts/fixture-inventory.json) identify
**eight groups and 30 public source files**. Output contains source paths,
builders/control names, consumers and boundaries, without fixture bodies or raw
browser saves. The command reads source as text; it never imports a model,
generates a fixture, calls a service or executes Reset.

| Group | Restoring action and boundary |
| --- | --- |
| Native HR | **Reset HR demo** recreates complete original native HR defaults through `createDemoWorkspaces().hr`, including absence of optional lifecycle extensions. |
| Native CMS | **Reset CMS demo** recreates native CMS defaults; optional release bundles are absent. |
| Native CRM | **Reset CRM demo** recreates native CRM defaults and original activity/counters. |
| SDK employee/onboarding | **Reset SDK samples** restores the issued local SDK session; refresh starts a separate session. Native HR/browser saves remain separate. |
| SDK payroll | The same **Reset SDK samples** restores that session's fictional payroll phase, captures and receipt; no native payroll, funds or provider effect. |
| Reviewed browser baseline | No user Reset rewrites the reviewed JSON/digest. Native Reset recreates defaults; deliberate maintainer fixture generation is separate. |
| Reviewed role examples | No app Reset; these are reviewed documentation/test inputs. |
| Historical SDK references | No app Reset rewrites retained reference files; the current SDK session consumes its separately named integration fixture. |

Native Reset replaces only its selected workspace and attempts removal of that
save. Accepted replacement clears that module's temporary forms/timers. Required
recovery may first show **Reset HR/CMS/CRM workspace?**, **Confirm Reset HR/CMS/CRM**
and **Keep HR/CMS/CRM workspace**, and capture a module-only checkpoint. Stale
confirmation, unreadable settings or checkpoint failure refuse replacement.
Reset does not rewrite source fixtures, erase downloads, clear all history or
preferences, reset another portal, change Firebase, or reset an SDK session.
Read the [state contract](../docs/PORTAL-STATE-CONTRACT.md) for save failures and
[recovery terminology](../docs/WORKSPACE-RECOVERY-GLOSSARY.md) before using it.
This is a reviewed source inventory, not every inline/dynamic test fixture.

## Grouped starter parity

```bash
npm run template:check
npm run template:check -- --json
```

The existing template check now includes the explicit
[43-file starter mapping](../scripts/starter-parity.json):

| Group | Starter public files |
| --- | ---: |
| App | 22 |
| Dependency | 2 |
| Asset | 2 |
| Configuration | 17 |

The standalone starter is a smaller scaffold with intentional variants and
starter-only files. Root-only native portals, SDK and host LAN scope does not
hide new starter files. Reports distinguish matches, reviewed differences and
drift. Intentional variants need separate root/starter fingerprints and a concrete
reason; reviewed text uses LF equivalence and assets use exact bytes. New, missing,
changed or unlisted files and unsupported paths/symlinks fail until reviewed.
Shared package/runtime/lock metadata remains checked. There is no automatic
fingerprint writer or lockfile regeneration.

Blank reusable records, immutable releases/bootstraps, research fingerprints and
versions remain part of the same validation. The existing mirror `--against`
mode still requires clean committed tree equality; it is separate from a
mutating template sync. Follow [template maintenance](../docs/TEMPLATE-MAINTENANCE.md).

## Child-process review

The current maintained audit covers **45 JS/TS/Python script files** and **six
exact reviewed baseline occurrences**. It parses source as data, resolves supported
child-process imports/aliases and flags implicit shells, shell-enabled or unknown
options, string/unknown argv and explicit interpreter code channels. The owned
Python stdlib AST helper is the only parser child it runs. It never imports or
executes scanned modules; test traps verify that boundary.

The [baseline](../scripts/child-process-baseline.json) binds path, call kind,
normalized AST fingerprint, exact count and reason to a reviewed source basis.
An added copy exceeds its count; modified/removed occurrences cause drift.
Diagnostics omit source/command payloads. Review wrappers and concrete arguments
before changing an exception. Use the [argument-array examples](../docs/COMMAND-SAFETY.md#argument-arrays);
the checker has no baseline-writing mode or file-wide allowance.

This is a bounded static review aid. Existing shell entry points, managed
snapshots, vendor/research/runtime files and arbitrary dynamic execution are
outside its coverage. A passing report is not complete security or execution
proof and does not authorize the operation it describes.

## Spaces and Unicode: focused local evidence

The [path tests](../tests/systemx/test_setup_paths.py) run under the existing
SYSTEMX integration suite. Run only those cases with:

```bash
python3 -B -m unittest discover -s tests/systemx -p test_setup_paths.py -v
```

On **2026-10-15**, focused local macOS verification passed **four path tests**
and **15 child-process regression tests**. Each of two owned copies—one with
spaces, one with Unicode and spaces—executed seven actual commands: prerequisite
doctor, script discovery, installed npm discovery dispatch, fixture inventory,
manager status, configured offline doctor and documentation checker. All
**14 command invocations** exited successfully.

The copies contain a finite public allowlist plus exact required retained-release
bytes, not `.git`, installed dependencies or real ignored secrets. An intentional
fictional project configuration is followed by a new preservation baseline.
Every subsequent command must preserve the complete copied file/directory set
and fictional environment/emulator/local-history sentinels. The configured check
trap must remain unexecuted. Actual manager status verifies the selected active
release and exact copied target/manual pin; inactive release bytes are preserved
without claiming a separate inactive-release verification. Process/output limits,
failure/timeout cleanup and removal of only owned copies are tested.

These checks install nothing, start no app/emulator/provider service and publish
nothing. The observed platform is macOS; Windows x64/ARM64 execution, installation,
browser accessibility and provider readiness remain separate. This focused
evidence does not claim a completed full CI run or accept any backlog item.
Agent 0 retains integration review and the required `ci:all`, Hosting preflight,
host-drift and template-copy gates. For new app identity choices, use the
[adoption checklist](../docs/examples/private-template-adoption.md); preserve
private adopted records and blank public reusable seeds.
