# Quick Start — unified template 3.4.0

Start with the webapp, then add the local builder and your project records.
The app boots before Firebase is configured. The full clone includes managed
SYSTEMX, LAN, research and kits; the separate starter folder is an app scaffold.
The selected managed distribution is dotSYSTEMX 1.9.0-alpha.6, including portable
Gusto/HR contracts in `.SYSTEMX/GUSTO/`.

## Prerequisites

- Node.js 24 baseline, npm and Git.
- Python 3.12 or newer for host import/mirror tooling and validation.
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
npm ci
npm run systemx:status
npm run systemx:validate
npm run dev
```

Alternatively, clone `https://github.com/WayneTechLab/WebAppX.git`
into your chosen directory, then run the same commands. Open Vite's printed URL.

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
Use [WebAppX Roadmap](WebAppX-Roadmap.md) to review the 1,000 proposed follow-on
items without activating them in the reusable SYSTEMX ledger.

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
