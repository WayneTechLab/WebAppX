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
and the [current QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DEVELOPER-BROWSER-QA-2026-10-14.md)
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
publication gates. The full 1,000-item goal remains active at **24 completed /
976 remaining**; consult the [execution plan](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WEBAPPX-EXECUTION-PLAN.md)
for dependency-ready work.

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
Use [WebAppX Roadmap](WebAppX-Roadmap.md) to review the stable 1,000-item catalog
and completion evidence without activating tasks in the reusable SYSTEMX ledger.

```bash
npm run hr:test
npm run hr:backend:audit
```

## Open the integrated local builder

```bash
npm run dev:systemx
npm run systemx:session:status
```

The supervisor selects free loopback ports for Vite, LAN and Firebase
Auth/Firestore/Storage emulators. Open the printed app URL plus `/__systemx/`
for the same-origin builder bridge. The direct LAN URL is printed separately.
Use the current session's URLs rather than assuming fixed ports.

```bash
npm run systemx:session:stop
```

The stop command affects only owned session processes. `npm run systemx:lan`
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
npm run systemx:upstream:check  # preview reviewed standalone defaults
npm run systemx:upstream:import # explicitly import and pin; preserve host records
npm run deploy -- hosting --preflight
```

Preflight verifies local gates without publishing hosting. Choose the Firebase
project and authorize a deployment separately. Read [Deployment](Deployment.md).

The [unified template guide](Unified-Template-Guide.md) links the complete command,
adoption, mirror-maintenance and provenance references.
