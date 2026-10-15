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

macOS and Windows x64/ARM64 are target platforms. Historical host verification
was recorded on macOS Apple Silicon; use current checks for your selected
revision. Core PowerShell launchers and record tools are included. Native Windows
Agent Y `run --apply` remains unavailable pending verified descendant-process
termination. Read the wiki platform pages for launcher and runtime limits;
macOS checks do not establish Windows runtime acceptance.

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
and the [QA receipt](DEVELOPER-BROWSER-QA-2026-10-14.md) for coverage and current
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
timesheets, and prepare, review and simulate payroll receipts. These app-owned
changes are saved in this browser and survive refresh when local storage is
available. Individual and combined JSON backups can move fictional workspaces
between browsers; combined selective restores also create local restore points
with Undo. Unsaved form fields and running timers remain temporary. Keep real
employee information out of these previews. See the
[portal guide](TEMPLATE-PORTALS.md) and [1,000-item roadmap](WEBAPPX-ROADMAP.md).

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
npm run systemx:session:status
```

The supervisor starts the app, LAN service and Firebase Auth/Firestore/Storage
emulators. It selects available loopback ports and records owned processes.
Open the printed app URL and its `/__systemx/` bridge for the builder. The
Agent 0 panel shows the selected SYSTEMX version and recorded task/role/project
counts. Those records do not start workers or grant cloud permissions.

```bash
npm run systemx:session:stop
```

This stops the session's owned processes. Run `npm run systemx:lan` if you need
only the local dashboard service; that command does not start the app or emulators.

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

Read the [command reference](COMMANDS.md), [template maintenance guide](TEMPLATE-MAINTENANCE.md),
and [feature/provenance map](UNIFIED-TEMPLATE.md).
