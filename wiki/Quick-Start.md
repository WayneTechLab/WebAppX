# Quick Start — unified template 3.4.0

Start with the webapp, then add the local builder and your project records.
The app boots before Firebase is configured. The full clone includes managed
SYSTEMX, LAN, research and kits; the separate starter folder is an app scaffold.
The selected managed distribution is dotSYSTEMX 1.9.0-alpha.6, including portable
Gusto/HR contracts in `.SYSTEMX/GUSTO/`.

## Prerequisites

- Node.js >=24.0.0, npm and Git with parseable installed versions.
- Root/starter runtime pins select Node **24.22.0**; package metadata pins npm **11.11.0**.
- Python >=3.12.0 for host import/mirror tooling and validation.
- GitHub CLI optionally, to create a repository from the template.
- Firebase CLI and its emulator Java prerequisites for `dev:systemx`.

Read [Windows Setup](Windows-Setup.md), [Platform Matrix](Platform-Matrix.md), and
[Setup Playbook](Setup-Playbook.md) for platform and optional tooling details.
Managed SYSTEMX includes Bash and PowerShell launchers. The WSG lifecycle menu
and complete template gate use Bash; the webapp/LAN supervisor uses Node.
Use the [dependency installation guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DEPENDENCY-INSTALLATION.md)
for locked installs, runtime selection and the optional Functions adapter's
separate Node 22 environment.

## Create and run an app

```bash
gh repo create my-app --template WayneTechLab/WebAppX --private --clone
cd my-app
npm run doctor
npm ci
npm run systemx:status
npm run systemx:validate
npm run dev
```

Alternatively, clone `https://github.com/WayneTechLab/WebAppX.git`
into your chosen directory, then run the same commands. Open Vite's printed URL.

For only the native account-free HR/CMS/CRM portals, use:

```bash
npm run dev:mock
# Keep the same origin across sessions when needed:
npm run dev:mock -- --port 5185
```

The launcher prints its own `127.0.0.1` portal URL and ignores `.env` files and
inherited provider/client configuration. Firebase, emulator and LAN integrations
stay disabled. The default uses a free port; an occupied requested port fails
without stopping the existing listener. Ctrl+C cleans up only this launcher's
resources. Browser saves belong to the exact origin, so use the printed address
or choose a consistent port deliberately. With Firebase unset, the visible
**Account-free mode** notice links to the portals and optional sign-in setup.

## Check tools and run the account-free browser smoke

`npm run doctor` is a dependency-free, read-only report of installed Node.js,
npm, Git and Python versions. Use `npm run --silent doctor -- --json` for structured
output. Node/Python use the minimums above; npm/Git have no specified minimum.
The command installs nothing and does not prove platform runtime acceptance.
The quiet JSON command suppresses npm's headers. If npm is missing, run
`node scripts/developer-prerequisites.mjs` directly; project dependencies are
not required for this report.

`npm run development:check` verifies root/starter runtime pins, supported engine
and package-manager declarations, public client-variable example coverage and
ignored local environment-file rules. It reads tracked source/examples without
opening private `.env` files or reporting secret values. Select Node 24.22.0
with an installed version manager for the checked-in baseline, then use `npm ci`.

Check the public configuration proposal with:

```bash
npm run environment:check
npm run environment:check -- --json
npm run environment:test
```

This validates six fixed tracked public schema/example/declaration/guide files
and prints names, classifications and counts. Private environment files and
shell values are excluded. The [configuration proposal](https://github.com/WayneTechLab/WebAppX/blob/main/docs/ENVIRONMENT-CONFIGURATION.md)
documents browser versus server settings and safe examples; it supplies no
runtime configuration enforcement or provider acceptance.

After `npm ci`:

```bash
npm run browser:install
npm run browser:smoke
# Optional:
npm run browser:smoke -- --headed
npm run browser:smoke -- --output /path/to/local/artifacts
```

The first command explicitly installs Chromium for exact pinned Playwright
**1.64.1**. The smoke never auto-downloads browsers; missing Chromium fails with
the install instruction. It launches its own Vite server on an available
`127.0.0.1` port and a fresh Chromium context, preserving running app listeners
and the user's browser records. No accounts, provider credentials or Firebase
emulators are required.

The run checks a named deterministic synthetic seed/hash and expected dashboard
totals, makes an HR/CMS/CRM domain change through each interface, reloads and
compares complete exports. It prints temporary report, screenshots and trace
paths, then cleans up only its browser/server. Read [Testing & QA](Testing-and-QA.md#automated-developer-and-portal-smoke-checks)
and the [historical smoke QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DEVELOPER-BROWSER-QA-2026-10-14.md)
for checked behavior. A macOS Chromium result does not verify Windows runtime
or live provider integration.

**Local verification — 2026-10-14:** the actual doctor report, 18 doctor
regressions, 16 seed/runner regressions and all seven browser checks passed.
The run created an HR goal, saved a CMS draft revision and created a CRM lead;
reloads and complete exports matched expected records. A second context retained
the untouched baseline, browser/network error checks passed and owned browser
and server cleanup both succeeded. The only warning was expected missing
Firebase configuration. Consult the receipt for final publication gates.

### Keyboard onboarding and recovery

```bash
npm run browser:keyboard:test
npm run browser:keyboard
```

The keyboard journeys reuse the same explicit Chromium setup and isolated
runner. They traverse controls with Tab, use Enter/Space and keyboard typing,
and check visible focus through native onboarding and selective restore/Undo.
The earlier `browser:smoke` remains a separate journey. Initial navigation/reload
and setting a local file in a keyboard-opened native chooser are explicit harness
boundaries; its OS key sequence is not automated.

When testing manually, use Tab/Shift+Tab to move through normal page controls.
Onboarding focus advances to the next required step and finally its receipt
status. Restore/Undo previews focus their headings and return to the opening
control after cancellation or success; an unavailable Undo opener falls back to
the history heading. Read [Template Portals](Template-Portals.md#keyboard-onboarding-and-recovery)
and the [keyboard QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/KEYBOARD-PORTALS-QA-2026-10-15.md)
for coverage and current results. These checks are not a screen-reader or
whole-site WCAG assessment.

**Accepted locally — 2026-10-15:** nine browser checks passed (three onboarding,
six recovery), recording 110/266 focus observations respectively. Eleven
keyboard guards and 16 existing seed/runner guards passed. The onboarding
receipt/state, selective restore/Undo and raw saved/exported payloads survived
their reload checks; unselected records stayed intact and focus returned to the
expected opener or retained-history fallback. Both owned resources closed.
**WX-0653/WX-0654** are complete; final publication gates remain in the receipt.

### Check the shared portal foundation

Run **`npm run browser:foundation`** for directory cards, deep-link normalization,
breadcrumbs, unsupported-page return links and save-summary states. Cards show
registry-defined workflows/roles and **Ready / Saved / Recovered / Unavailable**.
The shared fictional-data banner links to handling details. The authored test
uses isolated synthetic storage faults for recovery/unavailability and preserves
existing user browsers. Read [Template Portals](Template-Portals.md#shared-directory-and-route-recovery)
and the [foundation QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/EXECUTION-FOUNDATION-QA-2026-10-15.md).

**Accepted locally — 2026-10-15:** 15 contract and 14 mock-launcher tests passed,
including actual cold-module startup and owned cleanup. All nine foundation
browser checks and nine existing keyboard checks passed; 121 portal model tests
also passed. The receipt records exact planner/CI metadata checks and final
publication gates. At that checkpoint the catalog held **24 completed /
976 remaining**. The full goal remains active; consult `npm run backlog:summary`
and the [execution plan](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WEBAPPX-EXECUTION-PLAN.md)
for current counts and dependency-ready work.

### Run complete payroll, CMS and CRM journeys

After the same explicit Chromium setup, run:

```bash
npm run browser:payroll
npm run browser:lifecycles
```

Both commands use the named synthetic seed, owned loopback Vite and a fresh
browser context. Payroll checks two employees' onboarding/benefits/approved time,
preparation through simulated submission, statements, reload and consumed-time
refusal. The actual combined download reconciles **17.75 hours, $532.50 gross
and $401 net**. CMS checks the complete frozen public preview after a later
draft edit and reload. CRM checks linked conversion and completed follow-up;
form removal establishes UI prevention, while a separately reported actual-browser
module probe checks replay refusal on a detached download without injecting
application state.

**Historical focused results — 2026-10-15:** eight payroll and twelve CMS/CRM browser checks,
26 repository tests and 22 environment tests passed. Agent 0 accepted the nine
operational criteria; the catalog then reached **42 done / 958 remaining**. At that checkpoint,
**43-stage full CI, 56 browser checks and Hosting preflight passed**, with
owned browser/server cleanup. Read the
[operational QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/OPERATIONAL-FOUNDATIONS-QA-2026-10-15.md)
and [coverage map](https://github.com/WayneTechLab/WebAppX/blob/main/docs/QA-COVERAGE-MAP.md)
for the checked source, exact records and remaining boundaries.

## Try the portal maturity workflows

The [maturity guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-MATURITY.md)
covers the current 16-criterion wave from published base
`950f9ba0c4e48faaa65056f504f105201838e3ec`: **WX-0056, WX-0151–WX-0158,
WX-0280, WX-0282, WX-0397, WX-0453, WX-0454, WX-0457 and WX-0458**.
Use `npm run dev:mock` and its printed `/portals` origin.

Fresh seeds and legacy HR saves have **unconfigured fictional hourly rates**;
older `payCents` amounts supply no hourly cadence. Before preparing native payroll:

1. Open `/hr/demo/admin/payroll` as **Employer owner** or **Payroll admin**.
   Choose **Sample period start** and **Sample period end** for 1–366 inclusive
   calendar days; explicitly choose `2026-10-01` through `2026-10-15` for the
   October example.
2. Select each **Rate employee**, enter a **Fictional hourly rate (dollars)**
   and **Rate effective date**, then choose **Add sample rate**. Cover every
   eligible employee/work date; a rate applies from its effective date and later
   changes need later dates.
3. Check **Time-entry eligibility**, then prepare, calculate, review and simulate
   submission. Prepared inputs freeze work dates, hours and the applicable rates.
   A stale preparation blocks later steps until intentional **Reprepare sample
   payroll**. Submitted receipts and statements retain their frozen inputs.

Managers can return submitted unpaid time with a reason; its owner can edit the
returned draft and resubmit it. Own unpaid drafts support edit/cancel and explicit
delete/keep confirmation. Submitted, approved and paid rows stay protected.
CMS forms expose complete field-error summaries and first-invalid focus; entry
switching offers keep/discard when a buffer is dirty. CRM rejects malformed
enums, unsupported/oversized notes and invalid relationships before an import
can replace current records or save bytes.

The directory card and shared navigation return to the last supported HR
subsection in the mounted session; unsupported routes cannot replace it. Browser
save persistence and the SDK's separate sample state keep their existing scope.
Use **Create named restore point** to capture selected live portals without
restoring. Creating or renaming a point changes only history, preserving workspace
saves and unsaved forms. **Inspect captured records** shows all collection
counts with bounded identifiers. Restore/Undo differences show current-to-target
changes; confirmation refuses a point changed or removed since its preview.

```bash
npm run browser:install # explicit first-time Chromium installation
npm run maturity:test
npm run browser:maturity
```

Focused results record **79 new model tests**, the **139-test HR suite**, and
**13 browser check groups covering all 16 criteria** passing. The maturity payroll
scenario reconciles **10.75 hours / $298.75 gross / $239 net**, separately from
the historical evaluator's inputs below. The
[maturity QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-MATURITY-QA-2026-10-15.md)
retains the source and local evidence boundaries.
Agent 0 accepted all **16 original criteria locally**. The canonical catalog now
records **77 done / 923 remaining**: **96 P1, 670 P2 and 157 P3**, with
**756 local, 127 operator and 40 provider** gates remaining. The full 1,000-item
goal remains active; use `npm run backlog:summary` for current counts.

**Integrated verification passed: all 56 CI stages, 111 browser checks/check groups and Hosting preflight.** The source-derived `ci:plan` report itself executes no gate. These are local fictional-workspace observations; provider, deployed-service, native Windows and production acceptance retain their separate evidence requirements.

## Rehearse the historical evaluator and adoption wave

Use `npm run dev:mock` and its printed `/portals` origin in a fresh evaluation
context. The [printable worksheet](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-EVALUATOR-WORKSHEET.md)
links the paced [HR](https://github.com/WayneTechLab/WebAppX/blob/main/docs/demos/HR-FIVE-MINUTE.md),
[CMS](https://github.com/WayneTechLab/WebAppX/blob/main/docs/demos/CMS-FIVE-MINUTE.md),
[CRM](https://github.com/WayneTechLab/WebAppX/blob/main/docs/demos/CRM-FIVE-MINUTE.md)
and [recovery](https://github.com/WayneTechLab/WebAppX/blob/main/docs/demos/RECOVERY-TEN-MINUTE.md)
demonstrations. Preserve your ordinary browser profile and saved work. The
[glossary](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WORKSPACE-RECOVERY-GLOSSARY.md)
explains the different effects of save, backup, selective restore, Undo and Reset.

```bash
npm run browser:install # explicit one-time Chromium installation
npm run browser:evaluators
npm run hr:roles:check
npm run hr:roles:test
npm run gusto:capabilities:check
```

The evaluator owns its Vite server and fresh browser contexts. Focused evidence
records **25 browser checks** passing: native payroll reconciles **17.75 hours,
$532.50 gross and $401 net**; the CMS published projection stays at revision **2**
after a revision-**3** draft; CRM moves the converted **$1,750.25** opportunity
through proposal and negotiation while open pipeline remains **$8,250.25**;
and CMS-only restore/Undo preserves HR/CRM saved bytes. Five/ten-minute script
pacing is a human presentation design, separate from automated execution time.
The [reviewed role examples](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-ROLE-EXAMPLES.md)
also have **34 focused tests** reported passing.

For adoption decisions, read the [Gusto capability gap matrix](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-CAPABILITY-GAPS.md),
[proposed tenant membership contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/TENANT-MEMBERSHIP-PROPOSAL.md),
[operations readiness index](https://github.com/WayneTechLab/WebAppX/blob/main/docs/OPERATIONS-READINESS.md),
and [HR-disabled CMS/CRM walkthrough](https://github.com/WayneTechLab/WebAppX/blob/main/docs/examples/hr-disabled-adoption.md).
The [import rehearsal](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-IMPORT-REHEARSAL.md)
uses temporary fictional records; [documentation freshness](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DOCUMENTATION-FRESHNESS.md)
retains dated source/evidence qualifications.

Agent 0 accepted **WX-0503, WX-0800, WX-0859 and WX-0901–WX-0910** from
published base `aae465ae033f3191a69ed7d40056b0c6e2159e17`. All **54 CI stages, 95 browser checks/check groups and
Hosting preflight passed**; read the
[evaluator/adoption QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/EVALUATOR-ADOPTION-QA-2026-10-15.md).
Earlier **48-done / 46-stage / 62-browser** results retain their historical
receipt scope. Preview roles, source documentation and local simulations supply
no provider membership or production authorization.

## Test HR and selected Gusto workflows

While Vite development is running, use:

| Route | Preview |
| --- | --- |
| `/hr` | HR entry points and connection requirements |
| `/hr/demo` | Synthetic management, employee, manager and contractor portals |
| `/hr/demo/sdk` | Genuine Gusto React SDK 0.56.6 directory, administrative onboarding and payroll execution with isolated local mock records |

The native HR actions complete onboarding, benefit elections, timesheet approval
and simulated payroll receipts with fictional records saved in this browser.
Saved domain changes survive refresh when local storage is available. HR, CMS
and CRM support individual/combined JSON backups, selective restore and automatic
restore points with Undo. Unsaved forms and running timers remain temporary.
The SDK mock is development-only; it is absent from Hosting and `npm run preview`.
Other SDK workflows and live payroll remain separate adoption work. Connected
portals require trusted identity/memberships and an adopted backend. The optional
Firebase module is disabled by default. Read
[Gusto HR and Employee Management](Gusto-HR-and-Employee-Management.md) and
[the setup guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md).
The [portal state contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-STATE-CONTRACT.md)
lists retained domain records and temporary inputs with each portal's actual
navigation, Reset and restore behavior. Saved drafts are records; unsaved forms
and active timers are temporary. Complete JSON backups include the whole
fictional workspace across preview roles, including private mock drafts; read
the [capability matrix](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-CAPABILITIES.md)
for role projections and export scope. Run `npm run browser:state-contract`
for the isolated browser journey against these boundaries.
Use [WebAppX Roadmap](WebAppX-Roadmap.md) to review the stable 1,000-item catalog
and completion evidence without activating tasks in the reusable SYSTEMX ledger.

```bash
npm run hr:test
npm run hr:backend:audit
```

## Open the integrated local builder

```bash
npm run dev:systemx
# Choose this launch instead to retain a specific app origin:
npm run dev:systemx -- --host 127.0.0.1 --port 5185
npm run systemx:session:status
```

The default supervisor selects free loopback ports for Vite, LAN and Firebase
Auth/Firestore/Storage emulators. `--host` or `--port` fixes the app origin;
`--fixed-origin` pins the default `http://127.0.0.1:5173` when no overrides are
supplied. A busy fixed app port fails without choosing another port or stopping
the existing listener. Vite also binds strictly during startup. Supported app
hosts are `127.0.0.1` and `localhost`; LAN/emulators bind to `127.0.0.1`.

Open the printed **Mock save origin** and **Portal directory** URL. The scheme,
hostname, port and browser profile identify the saved samples. Switching between
`localhost` and `127.0.0.1`, another port or profile opens separate storage.
Private browsing or cleared site data can remove saves. Use a downloaded backup
to transfer fictional records between browser workspaces deliberately.

Vite, LAN, Auth, Firestore and Storage have separate `starting`, `ready` and
`failed` observations. A usable app can coexist with unavailable emulators.
Vite/LAN/Auth/Firestore use specific HTTP responses; Storage reports only its
reachable listener. Status reads the recorded observations and process checks,
without making fresh service probes. Open the printed `/__systemx/` app bridge
for the builder; the direct LAN URL is printed separately.

```bash
npm run systemx:session:restart:preview
```

This prints a read-only process/listener snapshot and proposed launch at the
recorded origin and ports. It changes no processes or runtime files. Unverified
ownership, foreign listeners, missing records or unavailable metadata refuse
the preview. `ready-for-review` is advisory and does not reserve ports or perform
a restart; recheck ownership and availability before a later restart.
The [session guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GETTING-STARTED.md#start-the-integrated-local-workspace)
details environment overrides, JSON states and exit codes. Actual verification
is recorded in the [session/contracts QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SESSION-CONTRACTS-QA-2026-10-15.md).

```bash
npm run systemx:session:stop
```

On macOS, combined-session stop verifies the recorded live processes before
signaling the owned supervisor to stop its children and clear runtime state.
Ownership uncertainty refuses the stop while preserving the record and files.
On Windows, combined-session stop exits 1 with
`windows-combined-stop-requires-owning-terminal`, sends no signals and preserves
the record/configuration. Press **Ctrl+C in the owning terminal**, then inspect
child processes/listeners and any remaining state before operator recovery.
A verified standalone Windows LAN stop can terminate its single process; wait
for exit and rerun stop to clear the verified exited record if it remains.
`npm run systemx:lan`
starts just the direct dashboard service. Read [LAN Operations](SYSTEMX-LAN-Operations-Manual.md)
and [LAN API Reference](SYSTEMX-LAN-API-Reference.md) before guarded edits.

## Configure your project's operating records

The template ships blank context, plan, task, focus and memory records.
Read `.SYSTEMX/START-HERE.md`, inspect `.SYSTEMX/INSTALLATION.json`, and configure
`.SYSTEMX/project.json`. Selected defaults supply tools/shared standards; outer
records hold your project's accepted work.

```bash
npm run systemx:context
npm run systemx -- status
npm run systemx -- menu
npm run systemx -- tools-guide
npm run systemx -- roles-init  # preview optional Agent X/Y/Z setup
```

WSG menu option 12 opens the managed tooling menu. Activate roles explicitly;
registries and task records do not start workers or a scheduler.
Follow [Agent Y setup for a new app](Agent-Y-New-App-Setup.md) to configure real
app checks, authenticate an installed CLI, assign one bounded task and review
its local result or explicitly opted-in draft PR.

### Review a small proposal intake

Use the [reviewed adoption guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/BACKLOG-ADOPTION.md)
to select 1–40 proposals for an already configured adopted app. The explicit
app name must match its selected root or registered child configuration; the
tool refuses this reusable WebAppX identity. Create the local selection using
the guide's schema, then preview with an available reviewed catalog commit:

```bash
npm run backlog:adopt -- preview --target ../adopted-app --app 'Example App' --root \
  --catalog-revision FULL_REVIEWED_LOCAL_COMMIT --selection ./local/adoption-selection.json
```

These operands are placeholders for the reviewed target and local files.
Preview writes no tasks or workers. Review every owner, scope, dependency,
next action and independent credential/authorization/local-prerequisite gate.
Omitted requirements or observations remain `unknown`; a source `done` item
does not satisfy a target dependency automatically. The guide's apply command
uses the unchanged reviewed plan and `--authorize-intake` to record TODOs.
Accepted intake does not authorize execution or prove provider readiness.

`npm run backlog:impact -- --from FROM_REVISION --to TO_REVISION --json`
compares two explicit local committed revisions and requests review of affected
proposal scopes. It changes no completion or canonical task state. Read
[source impact](https://github.com/WayneTechLab/WebAppX/blob/main/docs/BACKLOG-REBASELINE.md)
for catalog binding, definition advice and bounded output.

### Inspect recorded work

Open **AGI / Agent 0** in the LAN builder. It separates reusable work seeds,
WebAppX proposal counts and recorded work for an explicitly selected root or
exact registered child. Reload starts with no selected adopted scope. Missing,
invalid or unsupported records display unavailable; readable empty work means
no work recorded. An exact work-seed match does not establish project identity,
completion or running workers. See the
[work-status contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WORK-STATUS.md).

The historical adoption checkpoint recorded **48 done / 952 remaining**, with **125 P1,
670 P2 and 157 P3** remaining and **784 local, 128 operator and 40 provider**
gates. WX-0851, WX-0852, WX-0855, WX-0856, WX-0857 and WX-0858 have focused
local acceptance at that checkpoint. Its source-derived plan had 46 stages.

**At that historical checkpoint, all 46 CI stages, 62 browser checks and Hosting preflight passed.**
**Generated catalog/plan, link and preservation checks passed.** GitHub
publication uses final repository-identity and native-wiki parity checks.
The [historical adoption QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-ADOPTION-QA-2026-10-15.md)
records 95 integration, 19 impact, 37 work-status and 13 CI-plan tests plus six
owned LAN browser checks. Earlier 42-done/43-stage/56-browser results belong to
the historical operational checkpoint.

## Verify the app

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
npm run preview
```

Template maintainers also run `npm run ci:all` and `template:check`. These
validate blank reusable seeds; an adopted app with active records chooses its
own integration/release checks. See [Testing & QA](Testing-and-QA.md).

## Configure Firebase and login

Copy `.env.example` to the ignored `.env.local` and add approved client
configuration. Server secrets belong outside client variables and tracked files.
The local Auth provider is emulator email/password; `/admin` remains claim-gated.
See [Environment Variables](Environment-Variables.md) and
[Unified Login and Admin Operations](Unified-Login-and-Admin-Operations.md).

## Setup, updates and deployment

`bash .SYSTEMX/WSG-MENU.sh` exposes the retained guided setup and deploy flows.
Use `bootstrap.sh --check` for read-only tooling inspection before optional
installation or login. Configure cloud services for the adopted project.

```bash
npm run systemx:provenance -- --limit 40
npm run systemx:provenance -- --path GLOBAL/CONTEXT.md
npm run systemx:upstream:check -- --limit 25
npm run systemx:upstream:import # explicitly import and pin; preserve host records
npm run deploy -- hosting --preflight
```

The [ownership inventory](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-PROVENANCE.md)
verifies retained snapshots and distinguishes host ownership from exact or
manifest-equivalent stock matches. A matching blank seed grants no overwrite
authority. The [bounded upstream review](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-UPSTREAM-REVIEW.md)
reports the exact source/current public-main observation, selected/pinned
versions, preserved host-only paths and bootstrap conflicts. Its pagination
retains full blocking totals. Review is read-only and applies no import; use
the same actual reviewed commit and applicable authority for a later apply.

Preflight verifies local gates without publishing hosting. Choose the Firebase
project and authorize a deployment separately. Read [Deployment](Deployment.md).

For an already authorized source publication, capture the read-only repository
observations from the intended checkout:

```bash
npm run repository:identity -- --json
# Supply the intended repository explicitly after adopting the template:
npm run repository:identity -- --expected-repository Example/adopted-app --json
```

The [receipt guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/REPOSITORY-IDENTITY.md)
explains direct GitHub main versus cached refs, worktree categories and
`clean-parity` / `clean-ahead`. Clean local commits ahead of a verified remote
ancestor are a valid observation for publication review; this report performs no
fetch, stage, commit or push and grants no authority. Existing authorization
continues to apply within its scope. Template publication also requires
`ci:all`, `sync:system:check` and Hosting preflight.

Use [command effects](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMMAND-SAFETY.md)
before choosing a check, preview or deployment mode. The
[security assumptions](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SECURITY-ASSUMPTIONS.md)
and [monitoring contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/MONITORING.md)
distinguish source checks, browser workflows, stored startup readiness, current
process ownership, provider connection and deployed health. Local preflight and
configuration badges establish no live provider or production health result.

The [unified template guide](Unified-Template-Guide.md) links the complete command,
adoption, mirror-maintenance and provenance references.
