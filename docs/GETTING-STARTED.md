# Getting started with template 3.4.0

The public WebAppX combines a React/TypeScript/Vite/Tailwind/Firebase
webapp, managed dotSYSTEMX 1.9.0-alpha.6 tools, a guarded local LAN builder,
portable Gusto/HR contracts and reusable production/brand kits. Start locally,
then configure your project.

## Prerequisites

Use the documented Node.js 24 baseline, npm, Git and Python 3.12 or newer for
the host import/mirror tools. GitHub CLI is optional for creating a repository.
The Firebase emulator session also needs Firebase CLI and the Java runtime
required by your installed Firebase emulator tooling. Optional browser/cloud
CLIs are installed separately through the setup playbook.

macOS and Windows x64/ARM64 are target platforms. Historical host verification
was recorded on macOS Apple Silicon; use current checks for your selected
revision. Core PowerShell launchers and record tools are included. Native Windows
Agent Y `run --apply` remains unavailable pending verified descendant-process
termination. Read the wiki platform pages for launcher and runtime limits;
macOS checks do not establish Windows runtime acceptance.

## Create your app

```bash
gh repo create my-app --template WayneTechLab/WebAppX --private --clone
cd my-app
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
changes live in React state and reset on refresh. Keep real employee information
out of these previews.

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
