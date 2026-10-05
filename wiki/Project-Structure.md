# Project Structure

The repository serves a **multi-role template system**: the root is the
runnable Firebase/Vite app; `.SYSTEMX/` holds the setup, operations, AI, KIT,
and local LAN builder/control plane; `wiki/` holds GitHub Wiki source.

## Repository root (the runnable starter)

```
.
├── index.html                # Vite entry HTML
├── package.json              # scripts + dependencies
├── package-lock.json
├── vite.config.ts            # Vite + React + Tailwind + @ alias + chunking
├── tsconfig.json             # strict TypeScript config
├── eslint.config.js          # ESLint flat config
├── firebase.json             # Hosting + rules + security headers
├── firestore.rules           # Firestore security rules
├── firestore.indexes.json    # Composite indexes
├── storage.rules             # Storage security rules
├── .firebaserc               # Firebase project alias (set your project id)
├── .env.example              # VITE_FIREBASE_* client config template
├── docs/
│   └── assets/               # public repo landing and wiki images
├── public/
│   ├── robots.txt
│   └── favicon.svg
└── src/
    ├── main.tsx              # entry + local router
    ├── router.tsx            # route table
    ├── index.css             # Tailwind entry
    ├── vite-env.d.ts         # Vite types
    ├── config/
    │   └── firebase.ts       # Firebase client init (lazy/guarded)
    ├── components/
    │   └── layout/
    │       ├── Layout.tsx     # Navbar + page content + Footer
    │       ├── Navbar.tsx
    │       └── Footer.tsx
    └── pages/
        ├── HomePage.tsx
        ├── ServicesPage.tsx
        ├── DocsPage.tsx
        ├── LoginPage.tsx
        ├── AboutPage.tsx
        ├── ContactPage.tsx
        └── NotFoundPage.tsx  # catch-all 404
```

## The playbook (`.SYSTEMX/Template/`)

Generic AI, subagent, browser automation, connector, and recovery standards live
under `.SYSTEMX/AI/`.

```
.SYSTEMX/Template/
├── README.md                     # index + how-to for the template
├── WEBAPP-STACK-G1.0.md          # master playbook: use cases + stack reference
├── setup.sh                      # interactive orchestrator (walks steps in order)
├── steps/
│   ├── 00-prerequisites.md       # install + verify all CLIs
│   ├── 01-project-interview.md   # capture project identity & choices
│   ├── 02-scaffold.md            # TS + React + Vite + Tailwind skeleton
│   ├── 03-firebase-provision.md  # create/convert Firebase project, web config
│   ├── 04-env-and-secrets.md     # .env / secrets wiring
│   ├── 05-stripe.md              # products, prices, webhooks (optional)
│   ├── 06-cloud-functions.md     # Cloud Functions backend
│   ├── 07-security-rules.md      # Firestore / Storage rules + tests
│   ├── 08-mcp-servers.md         # Chrome DevTools MCP (optional)
│   ├── 09-ci-cd.md               # Local verification + deploy flow, repo secrets
│   ├── 10-testing-qa.md          # Vitest + Playwright + a11y/security gates
│   ├── 11-build-deploy.md        # build, deploy, smoke test
│   └── 12-post-launch.md         # monitoring, runbook, backups, cost guardrails
├── templates/
│   ├── env.template              # client VITE_* variables
│   ├── secrets.env.template      # server-side secrets (never commit)
│   └── interview.answers.template # captured answers from step 01 (git-ignored)
└── starter/                      # a self-contained copy of the runnable app
```

## SYSTEMX local control layout

```
.SYSTEMX/
├── INSTALLATION.json           # selects reviewed standalone defaults
├── .systemx/releases/          # immutable versioned distributions
├── SYSTEMX.sh / SYSTEMX.ps1    # Bash / PowerShell managed launchers
├── GLOBAL/ PLAN/ MEMORY/       # blank reusable project records
├── WORK/ AGENTS/ Projects/     # tasks, role registry and child-project scopes
├── imports/                    # verified standalone provenance receipts
├── AI/                         # Agent 0, subagents, MCP/browser tooling, recovery
├── KIT/                        # production and brand-guide kits for LLM/tool use
├── LAN/
│   ├── Website_Dashboard.html  # local-only SYSTEMX Local Control entry
│   ├── Website/                # dashboard CSS/JS assets
│   ├── Builder/                # contracts, runtime helpers, importer
│   ├── Temp/                   # ignored runtime evidence and ingest manifests
│   ├── Backup/                 # ignored pre-write snapshots
│   └── Files/                  # ignored local fixtures and component registry
├── Unified-Setup-Process/      # intake, master plan, phases, packet assets
├── Standard-MD-Files/          # source Markdown packet standard
├── Stock-Setup-Files/          # stock Markdown packet mirror
├── scripts/                    # bootstrap, deploy, quality, security, version
├── status/                     # TODO, IN_PROGRESS, DONE
├── webapp-version/             # version.json, app-version.txt, CHANGELOG.md
└── Template/                   # guided playbook and starter copy
```

The LAN files stay outside `src/`, `public/`, and `dist/`. The builder is
served only from loopback during local development and must not become a public
route or Firebase Hosting artifact.

## Full project layout (after the complete playbook)

When you run the full playbook, the project grows to include functions, tests,
and scripts:

```
<repo-root>/
├── src/
│   ├── main.tsx / App.tsx
│   ├── config/                 # firebase.ts, seo.ts, navigation.ts
│   ├── components/  hooks/  lib/  pages/  data/  types/  styles/
│   └── __tests__/
├── functions/
│   ├── package.json / tsconfig.json
│   └── src/                     # index.ts, payments, email, scheduled jobs
├── tests/                       # Playwright specs
├── scripts/                     # deploy, security, seed helpers
├── .SYSTEMX/AI/                 # Agent 0, subagents, browser/MCP, connectors, recovery
├── .SYSTEMX/LAN/                # local-only builder/control surface
├── .SYSTEMX/KIT/                # production and brand-guide kits
├── vitest.config.ts / vitest.setup.ts
└── playwright.config.ts
```

## Key file conventions

- **Path alias:** import from `@/…` (maps to `src/…`) — configured in both
  `tsconfig.json` and `vite.config.ts`.
- **Pages** live in `src/pages/` and are registered in `src/router.tsx`.
- **Layout** wraps all routes via the lightweight local router in `src/router.tsx`.
- **Firebase** is initialized once in `src/config/firebase.ts` and guarded so the
  app boots without credentials.
- **SYSTEMX LAN** owns local builder/runtime evidence. Read
  [SYSTEMX LAN Builder](SYSTEMX-LAN-Builder) and
  [SYSTEMX Logs and Evidence](SYSTEMX-Logs-and-Evidence) before modifying it.

## Standalone integration in this unified template

The current universal tools, docs, examples and MEDIA library are retained in
`.SYSTEMX/.systemx/releases/<selected-version>/`. `INSTALLATION.json` selects and
pins that release; `SYSTEMX.sh` routes to it. Outer `GLOBAL`, `PLAN`, `WORK`,
`MEMORY` and `AGENTS` ship reusable records; `project.json` supplies host
commands and checks to configure for the adopted project. Import receipts
live in `.SYSTEMX/imports/`; manager runtime receipts remain ignored under
`.SYSTEMX/.systemx/operations/`. Historical LAN status and feature evidence retain
their original scope. See [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration).
