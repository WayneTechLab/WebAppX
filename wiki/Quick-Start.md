# Quick Start — unified template 3.1.0

Start with the webapp, then add the local builder and your project records.
The app boots before Firebase is configured. The full clone includes managed
SYSTEMX, LAN, research and kits; the separate starter folder is an app scaffold.

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
npm run systemx -- roles-init  # preview Agent X/Z setup
```

WSG menu option 12 opens the managed tooling menu. Activate roles explicitly;
registries and task records do not start workers or a scheduler.

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
