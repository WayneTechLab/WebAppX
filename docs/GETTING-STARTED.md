# Getting started with template 3.1.0

The public WebAppX combines a React/TypeScript/Vite/Tailwind/Firebase
webapp, managed dotSYSTEMX 1.8.6-alpha.1 tools, a guarded local LAN builder,
and reusable production/brand kits. Start locally, then configure your project.

## Prerequisites

Use the documented Node.js 24 baseline, npm, Git and Python 3.12 or newer for
the host import/mirror tools. GitHub CLI is optional for creating a repository.
The Firebase emulator session also needs Firebase CLI and the Java runtime
required by your installed Firebase emulator tooling. Optional browser/cloud
CLIs are installed separately through the setup playbook.

macOS and Windows x64/ARM64 are target platforms. This release's recorded local
acceptance is on macOS Apple Silicon; read the wiki platform pages for the
available launchers and platform-specific limits.

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
# Preview event/review role setup before explicitly applying it:
npm run systemx -- roles-init
```

Keep project-specific data in your adopted repository. Upstream imports preserve
existing records and host extensions. See [managed integration](SYSTEMX-INTEGRATION.md).

## Verify an adopted app

```bash
npm run systemx:validate
npm run ci:lint
npm run ci:typecheck
npm test
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
