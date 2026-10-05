# WebApp Stack G One Point Zero

> **A reusable, enterprise-grade, vendor-neutral blueprint for spinning up a
> TypeScript + React + Vite + Firebase + Stripe web application — over and over,
> the same way, every time.**

This `Template/` directory is a **portable golden path**. Drop it into any new
repository (or pull it from GitHub) and an engineer — or an AI agent — can follow
the steps in order to stand up a production-ready web application from a bare
machine to a deployed, monitored, billing-enabled product.

It is intentionally **generic**. No business names, no hard-coded project IDs, no
customer data. Everything that is project-specific is collected during the
**Interview** step and injected into the generated files.

---

## Full template versus app starter

The root template includes managed SYSTEMX, LAN, both research packages and
production/brand kits. The `starter/` folder contains an app scaffold rather
than that complete operating layer. Read the
[getting-started guide](../../docs/GETTING-STARTED.md) for full adoption,
[command reference](../../docs/COMMANDS.md) for current tools, and
[template maintenance guide](../../docs/TEMPLATE-MAINTENANCE.md) for mirror parity.

## How to use this template

Choose the mode that matches your situation.

| Mode | When to use | Entry point |
| --- | --- | --- |
| **🎛️ Control menu** | You want one launcher for tooling, config, setup, deploy. | Run [`.SYSTEMX/WSG-MENU.sh`](../WSG-MENU.sh) and pick an option. |
| **⚡ Fast start (copy)** | You just want a running app NOW. | Copy the [`starter/`](./starter/) folder → `npm install` → `npm run dev`. |
| **⚡ Fast start (GitHub)** | Start a new repo from the live template. | `gh repo create my-app --template WayneTechLab/WebAppX --private --clone` |
| **Guided (agent)** | You are driving an AI coding agent. | Feed it [`WEBAPP-STACK-G1.0.md`](./WEBAPP-STACK-G1.0.md), then the `steps/` files one at a time. |
| **Guided (human)** | You are a developer doing it by hand. | Read [`WEBAPP-STACK-G1.0.md`](./WEBAPP-STACK-G1.0.md), then work through `steps/00` → `steps/12`. |
| **Scripted** | You want an interactive bootstrap. | Run [`setup.sh`](./setup.sh) and answer the prompts. |
| **Unified setup** | You want edition-aware setup (Enterprise, Business, Consumer, WSGT, WSGD). | Start at [`../Unified-Setup-Process/README.md`](../Unified-Setup-Process/README.md). |

### 🎛️ The control menu (recommended starting point)

[`WSG-MENU.sh`](../WSG-MENU.sh) (in `.SYSTEMX/`) is a single launcher that ties
everything together with submenus:

```bash
bash .SYSTEMX/WSG-MENU.sh
```

### Unified setup and @@CODER.SatoshiUNO

For new modular builds, prefer the unified setup process:
[`../Unified-Setup-Process/`](../Unified-Setup-Process/). It keeps the legacy
steps as source material while adding edition manifests, page caps, repo
learning, and the
[`@@CODER.SatoshiUNO`](../Unified-Setup-Process/standards/@@CODER.SatoshiUNO.md)
human/AI interaction contract.

```
1) 🚀 Start Template into Production   guided one-time setup → live
2) Setup & Tooling   bootstrap · auth · capture Firebase · seed env · guided setup · hooks
3) Deploy            Full · hosting · rules · functions · preflight · bump+deploy
4) Quality Checks    TypeScript · ESLint · tests · audit
5) Version           Bump patch/minor/major · changelog
6) Firebase          Login · projects · emulator · indexes · setup
7) Git               Status · pull · commit · push
8) Dev & App         Install · dev · build · preview
9) Project Info      Versions · repo · recent commits
10) System           Governance sync · structure · security
11) Update           Host and managed upstream update workflows
12) Standalone SYSTEMX  Tasks · context · projects · roles · selected defaults
```

**Option 1 (🚀 Start Template into Production)** is the recommended path: a single
guided, one-time, secure wizard — tooling → identity → capture approved Firebase
client configuration → seed ignored local files → ingest your project build-spec
`.md` → install/build → optional deploy → verify the never-paste secret policy
and provider rotation path. Never put server secrets in AI context, Markdown,
logs, or command-line arguments.

Make the menu typeable in any terminal:

```bash
bash .SYSTEMX/scripts/install-command.sh   # then just type: WSG-MENU
```

The **Setup & Tooling** submenu also includes a **Full bootstrap** that installs,
authenticates, and verifies every SDK + CLI in one pass (Node, Git, `gh`,
`gcloud`, Firebase, optional Stripe) — or run it directly:

```bash
bash .SYSTEMX/scripts/bootstrap.sh --with-stripe --with-mcp --interactive-login
bash .SYSTEMX/scripts/bootstrap.sh --with-stripe --with-mcp --with-m365 --with-godaddy --interactive-login
bash .SYSTEMX/scripts/bootstrap.sh --check
```

Google/Firebase is the default cloud and sender path. Select Microsoft 365 when
the sender/workforce mailbox is Microsoft-managed, and select GoDaddy when DNS
is managed there. The provider flow is documented in
[`../Unified-Setup-Process/standards/Unified-Login.md`](../Unified-Setup-Process/standards/Unified-Login.md).

Auth and tests use the Level 0-5 account ladder in
[`../Unified-Setup-Process/standards/WSG-Account-Levels.md`](../Unified-Setup-Process/standards/WSG-Account-Levels.md).

Before asking an AI/code tool to build project-specific features, fill the
first-time setup packet in
[`../Unified-Setup-Process/intake/`](../Unified-Setup-Process/intake/). The
scripted path shows these files and pauses:

```bash
bash .SYSTEMX/scripts/first-time-setup-packet.sh --pause
```

Inside **Setup & Tooling → Capture Firebase project info** you paste the
Google/Firebase project info you received for each platform — the Web
`firebaseConfig` block, the iOS `GoogleService-Info.plist`, and the Android
`google-services.json` (point it at the file and it auto-parses, or type the
fields in).

For Web, you can paste the **full Firebase SDK snippet** exactly as copied from
Firebase, including imports, comments, blank lines, `firebaseConfig`,
`initializeApp`, and `getAnalytics`. End the paste with `WSG_END` on its own
line. Template examples use shape-matched masked values such as
`AIzaSyCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` and `000000000000`.

The starter app validates the template with five basic pages: Home, About,
Services, Docs, and Contact. Its default visual baseline is black, white, and
neutral gray only; see
[`../Unified-Setup-Process/standards/WSG-Basic-Visual-Baseline.md`](../Unified-Setup-Process/standards/WSG-Basic-Visual-Baseline.md).

The **Deploy** submenu drives [`.SYSTEMX/scripts/deploy.sh`](../scripts/deploy.sh)
— a generic pipeline that runs quality gates → build → version/changelog →
commit → push → Firebase deploy, with **smart targets** (it only deploys what
your `firebase.json` actually defines, so the baseline app deploys hosting +
rules, and functions are added automatically once you create `functions/`).
It also supports target modes (`hosting`, `rules`, `functions`, `app`),
`--dry-run`, `--check`, `--rollback-info`, `--fast`, and background mode.

### The golden rule: one step at a time, in order

The setup is broken into numbered steps. **Do not skip ahead.** Each step:

1. States its **goal** and **preconditions**.
2. Prompts the operator for any **decisions / inputs** it needs.
3. Performs the work (commands + generated files).
4. Ends with a **verification gate** — you must pass it before moving on.

This ordering exists because later steps depend on artifacts (env vars, project
IDs, service accounts, price IDs) produced by earlier steps.

---

## Directory layout

```
Template/
├── README.md                     ← you are here (index + how-to)
├── WEBAPP-STACK-G1.0.md          ← master playbook: use cases + full stack reference
├── setup.sh                      ← interactive orchestrator (calls the steps in order)
├── steps/
│   ├── 00-prerequisites.md       ← install + verify all CLIs & tooling
│   ├── 01-project-interview.md   ← prompt operator for project identity & choices
│   ├── 02-scaffold.md            ← TS + React + Vite + Tailwind app skeleton
│   ├── 03-firebase-provision.md  ← create/convert Firebase project, capture web config
│   ├── 04-env-and-secrets.md     ← .env / .secrets wiring + secret storage
│   ├── 05-stripe.md              ← Stripe products, prices, webhooks, keys
│   ├── 06-cloud-functions.md     ← Cloud Functions (nodejs) backend
│   ├── 07-security-rules.md      ← Firestore / Storage / RTDB rules + tests
│   ├── 08-mcp-servers.md         ← Chrome DevTools MCP + other agent tooling
│   ├── 09-ci-cd.md               ← Local verification + deploy flow, repo secrets
│   ├── 10-testing-qa.md          ← Vitest unit + Playwright e2e + a11y/security gates
│   ├── 11-build-deploy.md        ← build, preview, hosting deploy, smoke test
│   └── 12-post-launch.md         ← monitoring, runbook, backups, cost guardrails
├── templates/
│   ├── env.template              ← client-side VITE_* variables (safe to ship)
│   ├── secrets.env.template      ← server-side secrets (NEVER commit real values)
│   └── interview.answers.template ← captured answers from step 01 (git-ignored)
└── starter/                      ← ⭐ the runnable app you copy to start a new project
    ├── src/  (Home, About, Services, Docs, Login, Contact, 404 + Navbar/Footer layout)
    ├── package.json / vite.config.ts / tsconfig.json / eslint.config.js
    ├── firebase.json / firestore.rules / storage.rules / .firebaserc
    ├── local verification scripts (lint · typecheck · build)
    └── .env.example              ← copy to .env.local and fill VITE_FIREBASE_*
```

> 🌐 **Live GitHub template:** [`WayneTechLab/WebAppX`](https://github.com/WayneTechLab/WebAppX)
> — the `starter/` folder is published as a GitHub *template repo*. Click
> **“Use this template”** there, or copy the local `starter/` folder (below).

---

## The stack at a glance

| Layer | Default choice | Swap-friendly? |
| --- | --- | --- |
| Language | TypeScript (strict) | No — assumed everywhere |
| UI runtime | React 19 | Yes (Preact/Solid possible, not covered) |
| Build / dev server | Vite 8 | No — core of the template |
| Styling | Tailwind CSS 4 + Radix UI primitives | Yes |
| Auth / DB / Storage | Firebase (Auth, Firestore, Storage, RTDB) | Partial (Supabase variant out of scope) |
| Serverless backend | Firebase Cloud Functions (module-selectable runtime) | Yes (Cloud Run variant noted) |
| Payments | Stripe (Checkout + Webhooks) | Yes (optional — skip if no billing) |
| Hosting | Firebase Hosting | Yes (Cloud Run / static host noted) |
| Cloud platform | Google Cloud (`gcloud`) | No — Firebase lives on GCP |
| Errors / tracing | Sentry | Yes (optional) |
| Unit tests | Vitest + Testing Library | Yes |
| E2E tests | Playwright | Yes |
| Lint / format | ESLint 9 (flat config) | Yes |
| CI/CD | Local verification + Firebase deploy | Yes |
| Agent tooling | Chrome DevTools MCP (+ optional MCP servers) | Yes (optional) |

> Full version pins, rationale, and the complete list of "generic use cases"
> live in [`WEBAPP-STACK-G1.0.md`](./WEBAPP-STACK-G1.0.md).

---

## Quick start (TL;DR)

**Option A — copy the local starter folder and finish the project:**

```bash
# 1. Copy the runnable app out of this template into your new project:
cp -R .SYSTEMX/Template/starter ~/projects/my-app   # or anywhere you like
cd ~/projects/my-app

# 2. Install + run — the app boots even before Firebase is configured:
npm install
npm run dev                 # → http://localhost:5173

# 3. Add your Firebase web config, then deploy:
cp .env.example .env.local  # fill VITE_FIREBASE_* from the Firebase console
npm run build
# (optional) bash .SYSTEMX/scripts/deploy.sh hosting --dry-run

# 4. Make it a fresh git repo / push to GitHub:
rm -rf .git && git init && git add -A && git commit -m "chore: init from WebApp Stack G1"
gh repo create my-app --private --source=. --push
```

**Option B — start straight from the live GitHub template:**

```bash
gh repo create my-app --template WayneTechLab/WebAppX --private --clone
cd my-app && npm install && npm run dev
```

**Option C — full guided build (provisioning, Stripe, Functions, CI, monitoring):**

```bash
cd .SYSTEMX/Template
bash setup.sh               # interactive — walks every step with verification gates
# ...or use Unified-Setup-Process first, then work WEBAPP-STACK-G1.0.md steps as needed.
```

---

## Conventions used in every step file

- **🎯 Goal** — what "done" means for this step.
- **✅ Preconditions** — what must already be true before you start.
- **❓ Operator prompts** — questions to ask the human running the setup.
- **⌨️ Commands** — copy-paste-able shell, parameterized by `${PLACEHOLDERS}`.
- **📄 Generated files** — files this step creates or modifies.
- **🔒 Security notes** — guardrails to never violate.
- **🚦 Verification gate** — the check that must pass to advance.

Placeholders are written as `${SCREAMING_SNAKE_CASE}` and are resolved from the
answers captured in [`templates/interview.answers.template`](./templates/interview.answers.template)
during step 01.

---

## Versioning

`G One Point Zero` = **Generation 1.0**. Bump the generation when you make a
breaking change to the step order or the baseline stack (e.g. swapping the build
tool). Patch the individual step files freely.
