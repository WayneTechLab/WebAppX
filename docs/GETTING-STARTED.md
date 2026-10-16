# Getting started with template 3.4.0

The public WebAppX combines a React/TypeScript/Vite/Tailwind/Firebase
webapp, managed dotSYSTEMX 1.9.0-alpha.6 tools, a guarded local LAN builder,
portable Gusto/HR contracts and reusable production/brand kits. Start locally,
then configure your project.

## Prerequisites

Use Node.js **24.0.0 or newer**, npm, Git and Python **3.12.0 or newer** for
the host import/mirror tools. npm and Git require parseable installed versions;
no minimum versions are specified for them. GitHub CLI is optional for creating a repository.
The Firebase emulator session also needs Firebase CLI and the Java runtime
required by your installed Firebase emulator tooling. Optional browser/cloud
CLIs are installed separately through the setup playbook.

The reproducible Node selection is **24.22.0**, recorded in both `.nvmrc` and
`.node-version` at the app root and in the starter copy. With `nvm-sh` already
installed, run `nvm install` once and `nvm use` in the repository before `npm ci`.
On Windows, select the version printed by `Get-Content .node-version` in your
installed Node version manager. `packageManager` records **npm 11.11.0**;
the engine minimum remains **Node >=24.0.0**, matching the doctor. A matching
declaration or version report does not establish runtime acceptance on every
Node version or target platform. See [development contracts](DEVELOPMENT-CONTRACTS.md)
for the read-only root/starter and environment coverage checks.

Follow [dependency installation](DEPENDENCY-INSTALLATION.md) for the locked
`npm ci` workflow, version-manager choices and the optional Functions adapter's
separate Node 22 environment. Root and starter installs use their own lockfiles.

Validate the tracked public environment examples with:

```bash
npm run environment:check
npm run environment:check -- --json
npm run environment:test
```

The [configuration proposal](ENVIRONMENT-CONFIGURATION.md) and schema describe
browser exposure, server settings and safe placeholders. The checker reads six
fixed public schema/example/declaration/guide files and reports names,
classifications and counts. It excludes private environment files and shell
values. Example validation adds no runtime enforcement or provider connection.

macOS and Windows x64/ARM64 are target platforms. Historical host verification
was recorded on macOS Apple Silicon; use current checks for your selected
revision. Core PowerShell launchers and record tools are included. Native Windows
Agent Y `run --apply` remains unavailable pending verified descendant-process
termination. Read the wiki platform pages for launcher and runtime limits;
macOS checks do not establish Windows runtime acceptance.

## Choose the setup failure branch

Keep the failing command's output and identify its package and owning terminal
before retrying. The checks below diagnose different boundaries; none installs
tools, reserves a port or repairs local state automatically.

| Symptom | Read or check | Safe next step | Success observation or stop condition |
| --- | --- | --- | --- |
| Dependency installation fails or was interrupted | Identify the root, starter/adopted app or optional Functions package; retain its `package.json`, matching lockfile and npm error. Compare `node --version` and `npm --version` with [dependency installation](DEPENDENCY-INSTALLATION.md#recover-an-interrupted-install). | Correct the reported runtime, registry or network cause, then retry that package's locked `npm ci`. A package/lock mismatch requires a reviewed dependency change; do not substitute `npm install`. | Require a terminal successful install and that package's relevant checks. Preserve environment, emulator and adopted project records throughout. |
| Wrong Node/npm or runtime warning | Read `.nvmrc`, `.node-version` and `packageManager`; run `node --version`, `npm --version`, then dependency-free `node scripts/developer-prerequisites.mjs` (or `npm run doctor`). | Select the already installed version manager's app runtime: Node **24.22.0**, npm **11.11.0**. Optional Functions uses its own **Node 22** major. After installation, `npm run development:check` checks root/starter declarations and locks. | Version readiness and matching declarations are separate from an actual app/test run. Missing tools require deliberate installation through the prerequisite guide. |
| Chosen development port is occupied | [Inspect the listener](#inspect-an-occupied-port) and compare PID, command, parent/owning terminal and available CWD metadata. Retain unrelated processes and their browser saves. | Choose a different explicit unused port, for example `npm run dev:mock -- --port 5185`, or `npm run dev:systemx -- --host 127.0.0.1 --port 5185`. An explicit origin refuses conflicts; omit origin overrides only when automatic selection is intended. | Use the exact printed origin. If ownership is unclear, stop before signaling any process. A restart preview does not reserve a port. |
| Integrated emulator startup fails | Read the owning terminal output and `npm run systemx:session:status`; distinguish Vite, LAN, Auth, Firestore and Storage observations. Check already installed `firebase --version` and `java -version`. | Correct the failed prerequisite, stop the owned session with **Ctrl+C in its terminal**, then launch deliberately. The [session controls](#preview-a-restart) describe verified macOS stop and Windows combined-stop refusal. | Require fresh observations for the failed component. Storage readiness is TCP-only; stored status, source checks and app readiness do not certify emulator workflows, provider access or deployment. Do not retry in a loop or delete state. |

Read [interrupted-install recovery](RUNBOOK.md#recover-an-interrupted-dependency-install)
before rebuilding dependencies. Native HR/CMS/CRM mocks need no Firebase or Gusto
account and can be evaluated separately from emulators with `npm run dev:mock`.

### Inspect an occupied port

For an example selected port of `5185`, macOS can show its listener with:

```bash
lsof -nP -iTCP:5185 -sTCP:LISTEN
```

Use the observed PID in the following examples; `12345` is a placeholder:

```bash
ps -p 12345 -o pid=,ppid=,command=
lsof -a -p 12345 -d cwd
```

On Windows PowerShell, inspect the listener and then its observed PID:

```powershell
Get-NetTCPConnection -LocalPort 5185 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = 12345" | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine
```

Windows process metadata does not reliably expose another process's current
working directory. Compare command/parent details with the owning terminal;
unavailable metadata is not proof of ownership. Never kill by port or process
name. Stop an owned session in its terminal, then recheck the listener before
reusing that port. Browser saves remain specific to scheme, host, port and
profile; moving from `localhost` to `127.0.0.1`, or changing ports, selects a
different save origin.

### Locate fictional defaults without resetting them

```bash
node scripts/fixture-inventory.mjs
node scripts/fixture-inventory.mjs --check --json
```

This read-only command lists eight maintained source/reset groups: native HR,
CMS and CRM, separate SDK onboarding/payroll sessions, the reviewed browser
baseline, reviewed role examples and historical SDK references. It reads only
its finite public source allowlist and checks builder/control anchors. It never
imports models, generates fixtures, resets a workspace or prints fixture bodies.
Arbitrary inline test cases are outside this inventory. Source-file reset and
saved-workspace reset are different operations; read each row's boundary before
using the actual UI control.

The [reviewed descriptors](../scripts/fixture-inventory.json) and
[inventory implementation](../scripts/fixture-inventory.mjs) identify the finite
read scope. Runtime diagnosis follows the actual
[prerequisite reader](../scripts/developer-prerequisites.mjs),
[native launcher](../scripts/dev-mock.mjs) and
[integrated session supervisor](../.SYSTEMX/LAN/session-supervisor.mjs).
Automatic integrated-origin selection also requires that reviewed
`SYSTEMX_DEV_HOST`, `SYSTEMX_APP_PORT` and `SYSTEMX_FIXED_ORIGIN` overrides are
unset; omitting flags alone does not override those settings.

## Developer check and browser smoke

Run the dependency-free prerequisite report before installing packages:

```bash
npm run doctor
npm run --silent doctor -- --json
```

The quiet JSON form omits npm's command headers. If npm is missing, use
`node scripts/developer-prerequisites.mjs` directly to diagnose the installed
tools; the report does not depend on packages from `node_modules`.

The doctor reads installed Node.js, npm, Git and Python versions against the
policy above. It does not install or update tools, write configuration, start
services or require accounts. A successful version report establishes version
readiness only; it does not verify every platform or an app's runtime behavior.

After `npm ci`, install the pinned Playwright browser explicitly and run the
account-free portal smoke:

```bash
npm run browser:install
npm run browser:smoke
# Optional visible browser or chosen artifact parent directory:
npm run browser:smoke -- --headed
npm run browser:smoke -- --output /path/to/local/artifacts
```

`browser:install` downloads Chromium for the exact **Playwright 1.64.1** dependency.
The smoke never auto-downloads; if Chromium is missing, it fails with installation
guidance. It owns a Vite server bound to `127.0.0.1` on an available port and a
fresh Chromium context. It does not reuse a user's running server or browser
profile and needs no Firebase emulators, provider accounts or credentials.

The smoke verifies the named synthetic seed pack and its hash/expected dashboard
totals, changes a domain record through each HR/CMS/CRM interface, reloads and
compares complete exported payloads. Temporary reports, screenshots and trace
paths are printed by the command. Cleanup closes only its own browser and server.
Use these synthetic records for testing; the smoke is separate from your saved
mock workspaces. See [Testing & QA](../wiki/Testing-and-QA.md#automated-developer-and-portal-smoke-checks)
and the [historical smoke QA receipt](DEVELOPER-BROWSER-QA-2026-10-14.md) for its
verification outcomes. No Windows runtime or provider acceptance follows from
a local Chromium run.

**Local verification — 2026-10-14:** the prerequisite report and its 18 tests
passed, as did 16 seed/runner tests and all seven authored Chromium checks.
HR goal creation, CMS draft revision and CRM lead creation survived reload with
complete expected exports and unselected portals preserved. A second context
started from the clean seed, request/error guards passed and both owned resources
closed. Only the expected missing Firebase configuration warning appeared.
The receipt holds final release-gate results; earlier receipts remain historical.

### Try the keyboard journeys

```bash
npm run browser:keyboard:test
npm run browser:keyboard
```

These use the same explicit Chromium installation and isolated runner as the
portal smoke. They cover native onboarding and selective restore/Undo with
Tab navigation, Enter/Space activation, keyboard typing and visible-focus
assertions. Initial navigation/reload and file delivery to a keyboard-opened
native chooser are test-harness boundaries; the OS chooser's key sequence is
not automated. `browser:smoke` remains a separate regression journey.

To try the app manually, use **Tab/Shift+Tab** to reach controls. Onboarding
advances focus to its next required step when an action disables the completed
control, then to its completion status. Restore/Undo previews focus their
headings; cancel or success returns focus to the opening control, or the restore
history heading if that control is unavailable. These are page regions with
normal Tab navigation. Read the [keyboard guide](TEMPLATE-PORTALS.md#keyboard-onboarding-and-recovery)
and [QA receipt](KEYBOARD-PORTALS-QA-2026-10-15.md) for scope and outcomes.

**Local keyboard verification — 2026-10-15:** all nine browser checks passed,
with 110 onboarding and 266 recovery focus observations. Eleven keyboard guards
and 16 existing seed/runner guards passed. Onboarding's exact receipt/state
survived reload; selective restore and Undo preserved unselected records, exact
saved/exported payloads and the expected focus return/fallback. Cleanup closed
both owned resources. These checks complete **WX-0653/WX-0654**; consult the
receipt for final publication gates.

### Run complete payroll, CMS and CRM journeys

After installing Chromium explicitly, run:

```bash
npm run browser:payroll
npm run browser:lifecycles
```

The new suites use the unchanged named seed, owned loopback Vite and fresh
Chromium contexts. Ordinary mutations use rendered controls; actual downloads
and browser saves are compared with handwritten expected records. Payroll covers
two employees' onboarding/benefits/time approval through simulated submission,
then reconciles both statements and the combined receipt at **17.75 hours,
$532.50 gross and $401 net** after reload and checks consumed-time refusal.

CMS checks the complete frozen revision-2 public preview after a later revision-3
draft edit and reload. CRM checks exact linked conversion, completed follow-up
and dashboards. Removing the conversion form establishes UI prevention. A
separately reported browser-module negative probe checks actual CRM replay refusal
on a detached converted download and preserves input/application save bytes,
without injecting application state.

**Historical operational verification — 2026-10-15:** eight payroll and twelve CMS/CRM browser
checks passed, alongside 26 repository and 22 environment tests. Agent 0 accepted
nine original operational criteria; the catalog reached **42 done / 958 remaining**.
At that checkpoint all **43 CI stages, 56 browser checks and Hosting preflight passed**, with
owned browser/server cleanup.
Read the [operational QA receipt](OPERATIONAL-FOUNDATIONS-QA-2026-10-15.md) for
final gates and the [coverage map](QA-COVERAGE-MAP.md) for each invariant's
model/browser evidence and untested boundaries.

## Try the current portal maturity workflows

The [portal maturity guide](PORTAL-MATURITY.md) covers **WX-0056,
WX-0151–WX-0158, WX-0280, WX-0282, WX-0397, WX-0453, WX-0454, WX-0457 and
WX-0458**, starting from published base
`950f9ba0c4e48faaa65056f504f105201838e3ec`.
Start `npm run dev:mock` and use its printed `/portals` origin.

### Configure fictional payroll explicitly

Fresh seeds and legacy saves have **unconfigured hourly rates**. Existing
`payCents` values do not specify an hourly cadence; the app does not convert
them into rates. Submitted legacy receipts keep their original captured inputs.

1. Open `/hr/demo/admin/payroll` as **Employer owner** or **Payroll admin**.
   Under **Run a simulated payroll**, enter **Sample period start** and
   **Sample period end** for 1–366 inclusive calendar days. For the October
   sample, explicitly choose `2026-10-01` through `2026-10-15`.
2. Choose a **Rate employee**, enter a **Fictional hourly rate (dollars)** and
   **Rate effective date**, then choose **Add sample rate**. Repeat for every
   active employee with approved unpaid time in the period. An applicable rate
   must start on or before that entry's work date. Each later rate change needs
   a later effective date.
3. Review **Time-entry eligibility** for included/excluded rows and reasons.
   Choose **Prepare sample payroll**, **Calculate fictional totals**,
   **Review simulated payroll**, then **Simulate payroll submission**. Prepared
   inputs show each entry's hours, work date and frozen fictional rate.
4. If approved time, eligibility, applicable rates, confirmed benefits or the
   selected period changes, review the stale warning and choose
   **Reprepare sample payroll** intentionally. Calculation, review and submission
   are blocked for a stale preparation. Later rate changes do not rewrite
   submitted receipts or employee statements.

A scoped manager can **Return sample time** with a reason. It becomes an unpaid
draft, visible with that reason and excluded from payroll until resubmitted and
approved. The employee or manager acting on their own unpaid draft can **Edit
draft** or **Delete draft**; deletion needs **Confirm delete draft**, and
**Keep draft** cancels it. Submitted, approved and paid entries are protected.

### Check editing, navigation and recovery

- CMS create/edit forms list all independent field errors and focus the first
  invalid field. A successful save becomes the clean baseline; when switching
  entries with unsaved edits, keep editing or explicitly discard the buffer.
- CRM imports reject unsupported enum values/types, unknown or oversized notes,
  and broken record relationships before replacing current records or saves.
- Open a supported HR subsection, visit the portal directory, then use its card
  or shared navigation to return. That mounted session remembers the supported
  path; unsupported paths cannot replace it. This is separate from durable
  browser saves and the SDK's independent sample state.
- In **Restore points & Undo**, enter a **Restore point name**, select
  **Portals to capture**, and choose **Create named restore point**. Creating or
  renaming a point writes history only and preserves open workspace records,
  workspace saves and unsaved forms. **Inspect captured records** shows collection
  counts and bounded identifiers. Restore/Undo differences run from current to
  target; the selected whole workspaces will be replaced. Undo confirmation
  refuses a point changed or removed after its preview, then refreshes history
  for review. A rename preserves the point's ID, timestamp, scope and payload.

After the same explicit Chromium setup:

```bash
npm run maturity:test
npm run browser:maturity
```

Focused verification records **79 new model tests**, **139 HR tests** and
**13 browser check groups covering all 16 criteria** passing. The maturity
scenario's **10.75 hours / $298.75 gross / $239 net** uses different fictional
inputs from the earlier $401 payroll scenario. Read the
[maturity QA receipt](PORTAL-MATURITY-QA-2026-10-15.md) for exact scope.
Agent 0 accepted all **16 original criteria locally**. The canonical catalog now
records **77 done / 923 remaining**: **96 P1, 670 P2 and 157 P3**, with
**756 local, 127 operator and 40 provider** gates remaining. The full 1,000-item
goal remains active; use `npm run backlog:summary` for current counts.

**Integrated verification passed: all 56 CI stages, 111 browser checks/check groups and Hosting preflight.** The source-derived `ci:plan` report itself executes no gate. These are local fictional-workspace observations; provider, deployed-service, native Windows and production acceptance retain their separate evidence requirements.

## Rehearse an evaluator demonstration

Start only the account-free native portals with `npm run dev:mock`. Open its
printed `/portals` URL in a fresh context owned by your evaluation; keep the same
scheme, hostname and port throughout. Preserve existing profiles, saved samples
and other listeners. Use the [printable worksheet](PORTAL-EVALUATOR-WORKSHEET.md)
with the [HR](demos/HR-FIVE-MINUTE.md), [CMS](demos/CMS-FIVE-MINUTE.md),
[CRM](demos/CRM-FIVE-MINUTE.md) or [single-module recovery](demos/RECOVERY-TEN-MINUTE.md)
script. The [recovery glossary](WORKSPACE-RECOVERY-GLOSSARY.md) distinguishes
save, export, import, restore point, Undo, Reset and origin.

After explicit Chromium installation, run the matching owned browser proof:

```bash
npm run browser:evaluators
# Optional visible automation; it still uses fresh owned contexts:
npm run browser:evaluators -- --headed
```

The named `webappx-portal-smoke-v1` baseline drives actual controls and complete
downloaded/saved record comparisons. Expected outcomes are **17.75 hours,
$532.50 gross and $401 net** in native payroll; frozen CMS revision **2** after
a later revision **3** draft; a **$1,750.25** converted CRM opportunity moved to
proposal and negotiation, retaining **$8,250.25** open pipeline; and **CMS-only**
restore/Undo while HR/CRM save bytes remain unchanged. The four scripts are
designed for five/five/five/ten minutes after setup; automated elapsed time is
separate evidence.

The historical accepted 13-item evaluator/adoption wave starts from
`aae465ae033f3191a69ed7d40056b0c6e2159e17`. Focused results record **25 evaluator
browser checks** and **34 role-example tests** passing. All **54 CI stages,
95 browser checks/check groups and Hosting preflight passed**; read the
[evaluator/adoption QA receipt](EVALUATOR-ADOPTION-QA-2026-10-15.md).
The earlier 48-done/46-stage/62-browser checkpoint is historical.

Before configuring a real app, read the [reviewed HR roles](HR-ROLE-EXAMPLES.md),
[capability adoption gap matrix](GUSTO-CAPABILITY-GAPS.md),
[proposed tenant membership contract](TENANT-MEMBERSHIP-PROPOSAL.md) and
[operations readiness index](OPERATIONS-READINESS.md). For an app that omits HR,
use the [temporary CMS/CRM adoption walkthrough](examples/hr-disabled-adoption.md)
to review bundle and backup decisions. Source examples and synthetic roles grant
no provider access or production membership.

## Create your app

```bash
gh repo create my-app --template WayneTechLab/WebAppX --private --clone
cd my-app
npm run doctor
npm ci
npm run systemx:status
npm run systemx:validate
npm run dev
```

You can also clone `https://github.com/WayneTechLab/WebAppX.git`.
`npm run dev` starts the webapp without requiring Firebase configuration.
Use the URL printed by Vite. The standalone `starter/` copy contains the app;
clone the whole template to include managed SYSTEMX, LAN, research and kits.

## Try the HR workspace without an account

With `npm run dev` running, open `/hr` for the capability entry points or
`/hr/demo` for synthetic management, employee, manager and contractor portals.
Complete onboarding review, elect and confirm benefits, submit and approve
timesheets, then [choose a period and configure explicit fictional rates](#configure-fictional-payroll-explicitly)
before preparing, reviewing and simulating payroll receipts. These app-owned
changes are saved in this browser and survive refresh when local storage is
available. Individual and combined JSON backups can move fictional workspaces
between browsers; combined selective restores also create local restore points
with Undo. Unsaved form fields and running timers remain temporary. Keep real
employee information out of these previews. See the
[portal guide](TEMPLATE-PORTALS.md) and [1,000-item roadmap](WEBAPPX-ROADMAP.md).

The [state contract](PORTAL-STATE-CONTRACT.md) details which records are saved
and which form inputs clear during navigation, Reset, import and Undo. A saved
draft is a domain record; text still held by an unsaved form is temporary.
Complete demo backups include the whole fictional workspace across preview
roles, including private mock drafts. The [capability matrix](PORTAL-CAPABILITIES.md)
explains role projections and their separate export boundary.

`/hr/demo/sdk` uses genuine Gusto React SDK 0.56.6 directory, administrative
onboarding and payroll execution components against an isolated local mock.
The selected SDK journeys use synthetic reads and writes; other SDK workflows
and real provider acceptance remain outside this coverage. The mock API is
available in Vite development and excluded from Hosting and `npm run preview`.

Connected portals require adopted Firebase identity, trusted memberships and
server integration. The optional Firebase module stays disabled and unregistered
by default. Follow [Gusto setup](GUSTO-SETUP.md) and the
[HR wiki guide](../wiki/Gusto-HR-and-Employee-Management.md) before adoption.

## Start the integrated local workspace

From the repository root, use:

```bash
npm run dev:systemx
# Keep a chosen browser-save origin across launches:
npm run dev:systemx -- --host 127.0.0.1 --port 5185
# Or pin the default http://127.0.0.1:5173:
npm run dev:systemx -- --fixed-origin
npm run systemx:session:status
```

The supervisor starts the app, LAN service and Firebase Auth/Firestore/Storage
emulators. Choose one of the launch commands above. Without origin overrides it
selects available loopback ports; `--host` or `--port` fixes the app origin.
Only `127.0.0.1` and `localhost` are accepted app hosts. `--fixed-origin` pins
the defaults when no host/port override is supplied. A busy fixed app port
fails before children start, and Vite binds strictly if a later bind race occurs.
The launcher preserves the existing listener and does not fall back to another
app port. LAN and emulator listeners use `127.0.0.1` independently of the app host.

`SYSTEMX_DEV_HOST` or `SYSTEMX_APP_PORT` also pins the app origin;
`SYSTEMX_FIXED_ORIGIN=true` pins the defaults. To return to automatic selection,
omit the host/port flags and remove these origin overrides. Backend preferred
ports can be set with `SYSTEMX_LAN_PORT`, `SYSTEMX_FIREBASE_AUTH_PORT`,
`SYSTEMX_FIREBASE_FIRESTORE_PORT` and `SYSTEMX_FIREBASE_STORAGE_PORT`.
Their selected ports remain distinct from the app and each other.

Open the printed **Mock save origin** and **Portal directory** URL. Browser saves
belong to the exact scheme, hostname, port and browser profile. If records seem
missing after a launch, compare all four with the previous session. A change
from `127.0.0.1` to `localhost`, another free port, another profile, private
browsing, or cleared site data can open a different or empty browser workspace.
Use a downloaded backup to transfer records deliberately between origins.

The session record reports each of **Vite app, LAN, Auth, Firestore and Storage**
as `starting`, `ready` or `failed`, with its endpoint and message. App readiness
does not wait for complete emulator readiness. A failed Firebase process can
leave the app and LAN usable; inspect the named component's output and correct
its prerequisites before relaunching. Vite, LAN, Auth and Firestore use specific
HTTP responses; Storage readiness means only that its loopback listener is
reachable. These are local startup checks, not emulator workflow acceptance.
`systemx:session:status` reads the last recorded component observations and
checks recorded process liveness/association; it does not run fresh HTTP probes.

Use the printed `/__systemx/` app bridge for the builder. The
Agent 0 panel shows the selected SYSTEMX version and recorded task/role/project
counts. Those records do not start workers or grant cloud permissions.

### Preview a restart

```bash
npm run systemx:session:restart:preview
```

This runs `node .SYSTEMX/LAN/session-control.mjs restart --preview`. It inspects
OS process metadata and listeners, verifies recorded ownership and proposes a
launch with the recorded origin and ports. JSON reports `owned`, `exited` or
`unverified` processes and replacement listeners as `available`,
`release-required`, `blocked` or `unverified`. `release-required` means a
currently owned listener would first need to exit. Foreign listeners,
unverifiable ownership, unavailable inspection metadata or no session record
produce `refused` and exit status 1. A reviewable snapshot exits 0; malformed
arguments exit 2. `restart` without `--preview` is rejected.

The preview sends no signals, opens no probe listeners and changes no session,
token or runtime configuration files. `ready-for-review` is advisory at the
observation time; it neither reserves ports nor performs a restart. Recheck
ownership and listener availability immediately before a later restart.

```bash
npm run systemx:session:stop
```

For a combined session on macOS, stop verifies the recorded live-process
ownership and signals the owned supervisor, which stops its children and clears
runtime state. Unverifiable ownership refuses the stop while preserving the
record and files.

On Windows, combined-session `stop` exits 1 with `status: "refused"` and
`windows-combined-stop-requires-owning-terminal`. It sends no signals and
preserves the record and runtime configuration, including when the recorded
processes appear exited. Press **Ctrl+C in the terminal that owns the session**
so the supervisor can close its children. Inspect the child processes and
listeners after shutdown. If state remains, inspect it before operator recovery:
Windows forced termination cannot prove that descendant cleanup finished.

For a directly started standalone LAN service on Windows, a verified stop can
request termination of that single process. The record remains until exit is
confirmed; wait for the process to exit and rerun stop to clear the verified
exited record if its cleanup handler was bypassed.

Run `npm run systemx:lan` if you need
only the local dashboard service; that command does not start the app or emulators.
Read the [session/contracts QA receipt](SESSION-CONTRACTS-QA-2026-10-15.md) for
the checked revision, local results and remaining platform/runtime boundaries.

## Adopt project records

Read `.SYSTEMX/START-HERE.md` and inspect `INSTALLATION.json`. The selected
release supplies tools and shared standards; the outer `.SYSTEMX` holds your
project's context, plan, task ledger, focus, memory and agent records.

The template ships those records blank. Configure `.SYSTEMX/project.json`,
populate your context and plan, then use the managed command interface:

```bash
npm run systemx:context
npm run systemx -- status
npm run systemx -- menu
npm run systemx -- tools-guide
# Preview optional event/CLI/review roles before explicitly applying setup:
npm run systemx -- roles-init
```

Keep project-specific data in your adopted repository. Upstream imports preserve
existing records and host extensions. See [managed integration](SYSTEMX-INTEGRATION.md).
The access matrix and project map ship blank for your reviewed source/access
references. The registry seeds only Agent 0. Optional Agent Y needs a selected
installed CLI, bounded task and branch/PR policy; role setup does not start it.
For a registered child, use `npm run systemx -- projects context --project NAME --agent agent.0`.

Follow [Agent Y setup for a new app](../wiki/Agent-Y-New-App-Setup.md) for the
complete role/provider setup, real task assignment, clean Git checkpoint,
private prompt, handoff preview and Agent 0 acceptance workflow.
A separately installed current CLI also supports
`systemx projects --target "/path/to/workspace" -- context --project NAME --agent agent.0`.

### Preview reviewed TODO intake

The [backlog adoption workflow](BACKLOG-ADOPTION.md) selects 1–40 catalog
proposals for an explicit already configured adopted app, then maps them to valid
TASK identifiers, registered owners and reviewed dependencies. The app name must
match the selected root or exact registered child; the reusable WebAppX source
and identity are refused. Create a local selection using the guide's schema:

```bash
npm run backlog:adopt -- preview --target ../adopted-app --app 'Example App' --root \
  --catalog-revision FULL_REVIEWED_LOCAL_COMMIT --selection ./local/adoption-selection.json
```

The revision, target and selection above are placeholders. Preview resolves and
checks the explicit available local catalog commit; it creates no records,
locks or workers. Review credential readiness, authorization for the named
action/target and local prerequisites independently. Unreviewed requirements or
missing observations remain `unknown`. TODO status is not a readiness signal,
and completed WebAppX source work does not accept a target dependency.

After reviewing the exact plan, the guide's apply command records the TODO batch
with `--authorize-intake`. That flag authorizes this intake action; execution,
provider access and deployment retain their own applicable authority. Unknown
or blocked action gates can coexist with accepted TODO intake. Existing target
records and blank reusable source records stay protected.

Use [source rebaseline impact](BACKLOG-REBASELINE.md) when reviewing changes
between two explicit local committed revisions:

```bash
npm run backlog:impact -- --from FROM_REVISION --to TO_REVISION --json
```

The bounded report identifies affected proposal scopes and separate definition
review advice. It leaves catalog completion and canonical task state intact.

### Read the selected scope's work status

In the LAN builder, open **AGI / Agent 0**. Its three source cards distinguish
reusable work seeds, WebAppX roadmap counts and recorded work for an explicitly
selected root or exact registered child. No adopted scope is selected by default
or after a page reload. Missing/invalid records remain unavailable; a valid
empty adopted ledger means no work recorded. Recorded roles do not observe
running workers. Exact task/focus/role byte equality does not establish pristine
context/memory, project identity or completion. Read [work status](WORK-STATUS.md)
for the fixed API paths and independent unavailable states.

Agent 0 accepted **WX-0851, WX-0852, WX-0855, WX-0856, WX-0857 and WX-0858**
against their original local criteria. That historical checkpoint recorded **48 done /
952 remaining**, with **125 P1, 670 P2 and 157 P3** remaining and **784 local,
128 operator and 40 provider** gates. Focused checks passed **95 integration,
19 impact, 37 work-status and 13 CI-plan tests**, plus **six owned LAN browser
checks**. Its CI plan contained **46 stages**.

**At that historical checkpoint, all 46 CI stages, 62 browser checks and Hosting preflight passed.**
**Generated catalog/plan, link and preservation checks passed.** GitHub
publication uses final repository-identity and native-wiki parity checks. See the [historical adoption QA receipt](SYSTEMX-ADOPTION-QA-2026-10-15.md) for
examined source, repaired cases, preservation evidence and remaining boundaries.
Earlier 42-done/43-stage/56-browser results are historical operational evidence.

### Inspect ownership before an upstream update

```bash
npm run systemx:provenance -- --limit 40
npm run systemx:provenance -- --path GLOBAL/CONTEXT.md
npm run systemx:upstream:check -- --limit 25
```

The [provenance inventory](SYSTEMX-PROVENANCE.md) verifies all registered
retained snapshots and reports host ownership independently of exact byte or
manifest-equivalent stock relationships. A matching blank seed grants no
overwrite authority. The [bounded upstream review](SYSTEMX-UPSTREAM-REVIEW.md)
binds the exact source/current public-main observation, reports selected/pinned
versions, every preserved host path including host-only extensions, bootstrap
conflicts and complete blocking totals under pagination. A ready preview is
read-only; it applies no import and cannot waive the source/preservation checks
of a later authorized apply.

## Verify an adopted app

```bash
npm run systemx:validate
npm run ci:lint
npm run ci:typecheck
npm test
npm run hr:test
npm run portals:test
npm run browser:smoke
npm run ci:audit
npm run build
```

These commands validate active records and app behavior. `template:check` and
`ci:all` are release-maintenance checks for the reusable blank template; they
intentionally reject populated template seeds. Select your application's checks
in `project.json` and adapt its integration suite as part of adoption.

## Configure services and deployment

Use `.env.example` to create your ignored `.env.local` with approved Firebase
client configuration. Keep server secrets out of client variables and tracked
files. Follow `.SYSTEMX/Template/` for account levels, rules, optional services,
and deployment configuration.

```bash
# Local deployment gates only:
npm run deploy -- hosting --preflight
```

Choose your Firebase project and authorize deployment separately. The template
release and preflight do not create services or establish production acceptance.

Before an already authorized source publication, inspect repository identity:

```bash
npm run repository:identity -- --json
# Adopted repositories must name their intended identity:
npm run repository:identity -- --expected-repository Example/adopted-app --json
```

The [repository receipt](REPOSITORY-IDENTITY.md) separates origin/push identity,
branch/HEAD, direct GitHub main, cached refs and tracked/staged/untracked changes.
It performs no fetch, stage, commit or push. `clean-parity` and `clean-ahead`
are complete clean observations; local commits ahead of the verified remote
ancestor remain subject to publication review. The receipt grants no additional
authority. Existing authorization persists within its original scope. Reusable
template publication requires `ci:all`, `sync:system:check` and Hosting preflight.

Read [command effects](COMMAND-SAFETY.md) before selecting a check, preview or
deployment mode. The [security assumptions](SECURITY-ASSUMPTIONS.md) and
[monitoring contract](MONITORING.md) distinguish source validation, browser
runtime, stored startup readiness, current process ownership, optional provider
connection and deployed health. Local preflight or configuration presence
does not establish live provider or production health.

Read the [command reference](COMMANDS.md), [template maintenance guide](TEMPLATE-MAINTENANCE.md),
and [feature/provenance map](UNIFIED-TEMPLATE.md).
