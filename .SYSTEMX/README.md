# SYSTEMX for the unified public webapp template

The current universal operating standard is provided by the managed standalone
[dotSYSTEMX](https://github.com/WayneTechLab/dotSYSTEMX) release. Read the selected
release's START-HERE and STANDARD alongside this project's outer context and
records. `npm run systemx:status` identifies that release and checks integrity.

Use [the host integration guide](../docs/SYSTEMX-INTEGRATION.md) for ownership,
version selection, menus and repeatable public-source imports. `SYSTEMX.sh`
executes selected defaults; `WSG-MENU.sh` retains the webapp lifecycle. Adopted project
tasks live in `WORK/TASKS.json`; legacy `status/` files retain the LAN
feature roadmap. The sections below describe retained webapp extensions.

For public template improvement planning, use the host-owned
[WebAppX roadmap pointer](WEBAPPX-ROADMAP.md) and its 1,000 improvement items.
Read one bounded area at a time. The catalog does not populate the reusable
task, context, plan or memory seeds and does not start agents or providers.
Verified completions link their evidence. **WX-0051 and WX-0451** complete the
first P1 follow-up with a shared registry and restore storage-budget preview.
**WX-0001, WX-0651 and WX-0652** add verified developer readiness, named seeds
and automated browser smoke. The catalog retains exactly **1,000 records**, with
**five completed and 995 remaining: 162 P1, 675 P2 and 158 P3**.
The host pointer links implementation and local browser/QA evidence
without changing selected upstream defaults.

Host-owned developer checks now include `npm run doctor` (or
`npm run --silent doctor -- --json`) for read-only prerequisite versions and
`npm run browser:smoke` for deterministic
HR/CMS/CRM browser checks. Install Chromium explicitly after `npm ci` with
`npm run browser:install`; the smoke never auto-downloads. It owns an available
loopback Vite server and fresh Chromium context, without provider accounts or
emulators. Read the [command guide](../docs/COMMANDS.md#developer-prerequisites-and-browser-smoke)
and [QA receipt](../docs/DEVELOPER-BROWSER-QA-2026-10-14.md). These host tools do
not mutate immutable defaults or activate reusable task/agent records.
Local focused verification passed 18 doctor tests, 16 seed/runner tests and all
seven authored browser gates, with both owned resources cleaned up. Independent
review had no unresolved findings; final publication gates remain in the receipt.

# .SYSTEMX — WebAppX operational system

This directory is the **operational control layer** for the template: the launcher
menu, the setup/deploy/quality scripts, git hooks, version tracking, and the full
guided playbook.

> The runnable app lives at the **repo root**. `.SYSTEMX/` is the tooling that
> sets it up, deploys it, and keeps it healthy.

This template is Firebase-first and locally verifiable. Use local verification
scripts and direct Firebase deploys from the workstation instead of runner-
based automation.

Public home: [WayneTechLab.com](https://WayneTechLab.com)

Template repo: [WayneTechLab/WebAppX](https://github.com/WayneTechLab/WebAppX)

## Layout

```
.SYSTEMX/
├── INSTALLATION.json        # selected, pinned managed defaults
├── .systemx/releases/        # immutable upstream distributions
├── SYSTEMX.sh / SYSTEMX.ps1  # managed launchers
├── GLOBAL/ PLAN/ MEMORY/     # adopted project context, plan and memory
├── WORK/ AGENTS/ Projects/   # canonical records and child-project scopes
├── AI/                      # Agent mesh, tool calling, browser automation, recovery standards
├── KIT/                     # production kits for SYSTEMX and standalone LLM use
├── WSG-MENU.sh              # ⭐ the control panel — start here
├── wsg-agi.sh               # governance/sync orchestrator
├── scripts/
│   ├── start-production.sh # 🚀 guided one-time setup → live (menu option #1)
│   ├── bootstrap.sh        # install + auth + verify ALL SDKs/CLIs
│   ├── install-command.sh  # add the `WSG-MENU` terminal command to your shell
│   ├── deploy.sh           # full deploy pipeline (smart Firebase targets)
│   ├── deploy-hosting.sh   # hosting only
│   ├── deploy-rules.sh     # Firestore + Storage rules only
│   ├── deploy-functions.sh # Cloud Functions only
│   ├── quality-check.sh    # typecheck + lint + tests
│   ├── security-check.mjs   # generic rules/config/audit check
│   ├── verify-template-structure.mjs
│   ├── version-bump.sh     # semver bump + version files
│   └── firebase-setup.sh   # firebase login + project selection
├── deploy/                 # production policy docs: canary, MFA, storage, alerts
├── docs/                   # operator runbooks: secrets, monitoring, recovery
├── hooks/                  # git hooks (install-hooks.sh, pre-push, post-merge, post-checkout)
├── logs/                   # local script logs (git-kept, contents ignored downstream)
├── LAN/                    # local-only builder/control surface for the current checkout
├── tooling/                # reusable helper tooling
├── Standard-MD-Files/      # source markdown set used to build setup packet zips
├── Stock-Setup-Files/      # stock markdown source mirror for packet generation
├── Setup-Input_MD/         # default import workspace for unpacked setup packets
├── Unified-Setup-Process/  # stack modes, master plan, editions, and setup flow
├── webapp-version/                # app-version.txt, version.json, CHANGELOG.md
├── status/                 # TODO.md, IN_PROGRESS.md, DONE.md (this template's build log)
└── Template/               # the guided playbook (steps 00→12, setup.sh, starter/, lib/)
    └── lib/firebase-config.sh  # paste/seed helpers (config capture + .env seeding)
```

## Start here

```bash
bash .SYSTEMX/WSG-MENU.sh
```

Or make it typeable in any terminal:

```bash
bash .SYSTEMX/scripts/install-command.sh   # then just type: WSG-MENU
```

| Menu | What it does |
| --- | --- |
| 1 · 🚀 Start into Production | Guided one-time wizard: tooling → packet export/import → config → build → deploy → security |
| 2 · Setup & Tooling | Bootstrap, doctor, packet export/import, Firebase config, guided setup, hooks, install command |
| 3 · Deploy | Full / hosting / rules / functions / preflight / bump+deploy |
| 4 · Quality Checks | TypeScript · ESLint · tests · audit |
| 5 · Version | Bump patch/minor/major · changelog |
| 6 · Firebase | Login · projects · emulator · indexes · setup |
| 7 · Git | Status · pull · commit · push |
| 8 · Dev & App | Install · dev · build · preview |
| 9 · Project Info | Versions · repo · recent commits |
| 10 · System | WSG-AGI sync · structure check · security check |
| 11 · Update | Update main · update menu/system · update code · checks · deploy update-all |
| 12 · Standalone SYSTEMX | Managed menu for tasks, context, projects, roles and selected defaults |

## AI and tool automation standard

Generic agent coordination, browser automation, external connector, and
recovery rules live in [AI/](AI/README.md). These files define Agent 0,
subagent lanes, message envelopes, Playwright and Chrome DevTools MCP routing,
desktop automation boundaries, popup/apply recovery, and external service
adapter rules without carrying private project-specific vendor logic.

Run the local drift check with:

```bash
npm run ai:standard:check
npm run docs:links
```

## LAN Builder Designer research

`.SYSTEMX/LAN/Research/LAN-Builder/` contains the validated clean-room research
package and its 13-wave implementation overlay. The current capability truth
is the checked-in
[`LAN/Builder/contracts/capability-manifest.json`](LAN/Builder/contracts/capability-manifest.json);
`npm test` is the first characterization gate. Future Designer schemas remain
draft contracts until their wave exit criteria, source ownership, migrations,
tests, documentation, and rollback evidence are complete.

## SYSTEMX Kits

Reusable brand, media, platform, web, mobile, and document production assets
live in [`KIT/Production/`](KIT/Production/SYSTEMX-KIT-INDEX.md).

Use this as both:

- a local SYSTEMX tool source for approved Wayne Tech Lab LLC production assets;
- a standalone GitHub folder that LLMs, SDKs, CLIs, MCP tools, and browser
  agents can read directly when generating brand-compliant output.

Start with [`KIT/Production/SYSTEMX-KIT-INDEX.md`](KIT/Production/SYSTEMX-KIT-INDEX.md).

The Brand Guide Kit lives in
[`KIT/Brand/`](KIT/Brand/SYSTEMX-KIT-INDEX.md). It packages the WTL Brand Guide
Standard Template v1.0 for producing six-page brand-guidelines PDFs from
approved logos, intake answers, page prompts, and local preflight/stitch scripts.

## SYSTEMX LAN builder

The local builder plan lives in [`LAN/`](LAN/README.md). It is designed to
re-imagine the reusable visual-CMS patterns from
[WTL-Instatic](https://github.com/WayneTechLab/WTL-Instatic) for this
Firebase/Vite template. The target is the current checkout in
`template-edit` mode: inspect and safely edit existing pages, routes, modules,
tokens, collections, and assets while previewing through Vite and Firebase
emulators.

The builder's provider model keeps the storage choices explicit:

- Firestore and optional Realtime Database for document/realtime workloads;
- Firebase SQL Connect backed by Cloud SQL PostgreSQL for relational workloads;
- Cloud Storage for Firebase for web media;
- Google Drive/Shared Drive for operator documents and production-kit files;
- Google Cloud Storage for approved internal archive workflows.

These are separate capabilities with separate security and sync rules. The LAN
surface is loopback-only, runs outside the public app build, and delegates
quality, security, and deploy authority to the existing `.SYSTEMX` CLI.

The LAN is also the planned co-management control plane for the codebase:
named tool actions, backend/source diagnostics, humanized run states,
sanitized logs, Agent 0 checkpoints, subagent handoffs, provider preflight, and
last-deploy evidence. See
[`LAN/CONTROL-PLANE-PLAN.md`](LAN/CONTROL-PLANE-PLAN.md) for the execution
waves and safety contract. Backend function or provider-file editing remains
gated until its file-class validator, backup, diff, secret scan, and post-write
quality checks exist.

Start the current-template WebApp, Firebase emulators, and LAN builder together with:

```bash
npm run dev:systemx
```

Then open:

```text
http://127.0.0.1:7331/
```

Or start the public Vite app and LAN shell together:

```bash
npm run dev:systemx
```

That exposes:

```text
http://127.0.0.1:<app-port>/       # public app
http://127.0.0.1:<app-port>/__systemx/ # LAN through Vite dev proxy
http://127.0.0.1:<lan-port>/       # LAN direct loopback service
http://127.0.0.1:<auth-port>/      # Firebase Auth emulator
```

Use the URLs printed by the supervisor or
`npm run systemx:session:status`; the placeholders are intentional because
another local project may already own the preferred ports.

If another local project already owns an app, LAN, Auth, Firestore, or Storage
port, `dev:systemx` checks both `127.0.0.1` and `::1`, chooses the next free
port for each owned child, and records the session in
ignored `.SYSTEMX/state/local-session.json`, and prints the active URLs. Use
the session controls for start-of-day/end-of-day ownership:

```bash
npm run systemx:session:status
npm run systemx:session:stop
```

This G1 builder shows controller health, Vite preview status, repository state,
builder waves, route inventory, provider readiness, source files, page models,
typed modules, CMS/CRM fixtures, local account fixtures, and a Font browser
with loaded-font inventory. It can write
allowlisted local source and model changes only with a session token, backup,
secret scan, operation evidence, and explicit confirmation. The workspace and
provider contracts are under `LAN/Builder/`; live cloud mutations remain
separate authenticated adapters and the existing `.SYSTEMX` quality/deploy
gates remain authoritative.

The active UI contract is canvas-first: left structure dock, center Vite
preview, icon-first right tool rail, docked right inspector open by default in
a fresh layout, and a `Layers` bottom dock for page-model work. The Style
inspector can preview Google Fonts CSS2 families in the live Vite frame and
save a selected project font only after `SAVE FONT CHANGE`. Local evidence is documented in
[`../wiki/SYSTEMX-Logs-and-Evidence.md`](../wiki/SYSTEMX-Logs-and-Evidence.md)
and recorded under ignored LAN runtime folders.

The left and right editor docks have independent close controls plus an
explicit **Keep open / Always shown** policy button. Auto visibility is the
default; the layout save loop reconciles dock classes and pin state so source,
page-model, refresh, and responsive-width operations do not unexpectedly
reopen or collapse an editor menu.

### Unified WebApp and Firebase Auth

The public WebApp and LAN use the same provider contract in
[`LAN/Builder/contracts/auth-provider-registry.json`](LAN/Builder/contracts/auth-provider-registry.json).
Start the owned local WebApp, Firebase data plane, and LAN together:

```bash
npm run dev:systemx
```

The local `/login` page uses only Firebase Auth emulator email/password.
Google, email-link/code, trusted custom-token, and OIDC/SAML SSO remain visible
as readiness states but fail closed until a project configures them. The
authenticated `/admin` shell is Level 4/5 claim-gated, and the LAN `Providers`
panel mirrors the same status through `/api/auth/providers`. The complete
boundary is documented in
[`LAN/UNIFIED-AUTH-AND-STACK-CONTRACT.md`](LAN/UNIFIED-AUTH-AND-STACK-CONTRACT.md).

When the owned session is running, `/login` and authorized `/admin` also read
the LAN's read-only `GET /__systemx/api/status` bridge. This keeps the WebApp
staff shell aligned with the LAN on the current app URL, session-owned Auth /
Firestore / Storage ports, emulator health, template-edit mode, repository
changes, local data counts, detected Node/Firebase/gcloud/Stripe/Playwright
tooling, and provider readiness. Admin surface cards are evidence-based: they
show local-ready, guarded, planned, tooling-gap, or offline states rather than
pretending a cloud adapter is active. Production builds show documentation-only
state because the loopback bridge and LAN files never enter `dist`.

### LAN Builder Designer research overlay

The local builder has a research-backed future architecture under
[`LAN/Research/LAN-Builder/`](LAN/Research/LAN-Builder/). It includes 29 research
documents, 200 de-identified source records, a 13-wave roadmap, risks, acceptance criteria,
Wiki repair work, and draft Designer contracts. The canonical implementation
plan is [`LAN/LAN-BUILDER-DESIGNER-MASTER-PLAN.md`](LAN/LAN-BUILDER-DESIGNER-MASTER-PLAN.md)
and the current gate is [`status/LAN-BUILDER-DESIGNER-MASTERPLAN.md`](status/LAN-BUILDER-DESIGNER-MASTERPLAN.md).

The current G1 LAN remains the supported implementation: a guarded local
current-template editor with page/node/module/CMS fixtures, source inspection,
allowlisted writes, backups, evidence, and Vite preview. The full visual
Designer is **not** advertised as complete. Research Wave 0 truth, safety,
documentation, and characterization now pass; Wave 1 modular kernel work is
not started. Use `npm test` to run the current LAN characterization suite before
changing the editor kernel.

## Tooling the bootstrap guarantees

| Tool | Type | Purpose |
| --- | --- | --- |
| Node.js + npm | runtime | Build/dev + package manager |
| Git | CLI | Version control |
| GitHub CLI (`gh`) | CLI | Repo + secrets automation |
| Google Cloud SDK (`gcloud`) | SDK/CLI | GCP/Firebase platform |
| Firebase CLI (`firebase-tools`) | CLI | Provisioning + deploy, resolved from PATH or `npx --yes firebase-tools` |
| Firebase Web SDK (`firebase`) | SDK | App auth/data/storage (in `package.json`) |
| Stripe CLI (`stripe`) | CLI | Payments (optional) |
| Stripe SDK (`@stripe/stripe-js`, `stripe`) | SDK | Payments (optional) |

Google/Firebase is the default cloud and sender path. When the project needs
more provider coverage, run:

```bash
bash .SYSTEMX/scripts/bootstrap.sh --with-stripe --with-mcp --with-m365 --with-godaddy --interactive-login
```

Use `Unified-Login.md` for the five-step login flow,
`WSG-Account-Levels.md` for Level 0-5 Firebase, security, emulator, and
Playwright standards, and `Firebase-Sender-Auth-MFA.md` for the sender email,
authorized-domain, MFA, claims, and smoke-test order that prevents unified login
drift.

Use the stack definitions in `.SYSTEMX/Unified-Setup-Process/stacks/` to keep
`Google/Firebase` as the default setup path, `Microsoft 365` as the alternative
sender/tenant path, and `Custom` as the explicit service-selection path.

See [status/](status/TODO.md) for the build log and [webapp-version/CHANGELOG.md](webapp-version/CHANGELOG.md).

## First-Time Setup Intake

When a repo is opened from this template as a new project, run:

```bash
bash .SYSTEMX/scripts/first-time-setup-packet.sh --pause
```

The script asks `Mac` or `Windows` first, then stack mode, edition, packet
tier, and packet shape. It exports one setup zip to Downloads, pauses for
external work, imports the returned zip into `.SYSTEMX/Setup-Input_MD/`, and
then continues the guided setup.

Fill the intake and master-plan files in `.SYSTEMX/Unified-Setup-Process/intake/`,
then re-inject `06-AI-REINJECTION-PROMPT.md` into the AI/code tooling session.
Setup/deploy events append to `.SYSTEMX/logs/setup-history.jsonl` and
`.SYSTEMX/logs/deploy-history.jsonl`.

For the full scratch-to-production flow, read
[`USER-INGEST-AND-PRODUCTION-SETUP.md`](USER-INGEST-AND-PRODUCTION-SETUP.md).

## Deploy Controls

```bash
bash .SYSTEMX/scripts/deploy.sh --preflight
bash .SYSTEMX/scripts/deploy.sh hosting --dry-run
bash .SYSTEMX/scripts/deploy.sh rules
bash .SYSTEMX/scripts/deploy.sh app --fast
bash .SYSTEMX/scripts/deploy.sh --check
bash .SYSTEMX/scripts/deploy.sh --rollback-info
```

Firebase CLI is no longer vendored into app dev dependencies; scripts resolve it
from local PATH or `npx --yes firebase-tools` to keep generated apps audit-clean.

## Governance sync

Run WSG-AGI before releases to validate the operational layer:

```bash
npm run sync:system:check
npm run sync:system
npm run auth:mfa:check
```

## Unified setup

The modular edition-aware setup process lives at
[`Unified-Setup-Process/`](Unified-Setup-Process/). It defines stack modes, five
edition manifests, the 20-phase canonical master plan, the 10-phase/15-step
compatibility flow, repo learning, and the
[`@@CODER.SatoshiUNO`](Unified-Setup-Process/standards/@@CODER.SatoshiUNO.md)
human/AI interaction standard.

The original [`Template/steps/`](Template/steps/) flow remains the legacy
golden-path source material.

## Standard MD files

Use [`Standard-MD-Files/`](Standard-MD-Files/) when a human needs the source set
that WSG uses to build setup packet zips for an LLM to produce an updated
template version, initialize a new project from the template, or continue setup
without relying on chat memory.

Run this to export one setup packet zip to the user's Downloads folder and
create a matching setup import target:

```bash
bash .SYSTEMX/scripts/build-setup-packet.sh
```

The script asks the operator for OS, stack mode, edition, packet tier, and
packet shape, then writes a timestamped zip to the OS Downloads folder.

After receiving an updated setup zip, import and validate it with:

```bash
bash .SYSTEMX/scripts/import-setup-packet.sh
```

<!-- WSG-AGI:START -->

## System Map (Synced By WSG-AGI)

This block is generated by `.SYSTEMX/wsg-agi.sh`.

| Surface | Entry point |
| --- | --- |
| Managed standalone runner | `.SYSTEMX/SYSTEMX.sh` |
| Standalone import | `scripts/sync-systemx.py` (preview; explicit --apply) |
| Selected defaults | `.SYSTEMX/INSTALLATION.json` |
| Canonical task ledger | `.SYSTEMX/WORK/TASKS.json` |
| Control panel | `.SYSTEMX/WSG-MENU.sh` |
| Governance sync | `.SYSTEMX/wsg-agi.sh` |
| Quality gate | `.SYSTEMX/scripts/quality-check.sh` |
| Security gate | `.SYSTEMX/scripts/security-check.mjs` |
| Auth/MFA readiness | `.SYSTEMX/scripts/auth-mfa-readiness-check.mjs` |
| Packet export | `.SYSTEMX/scripts/build-setup-packet.sh` |
| Packet import | `.SYSTEMX/scripts/import-setup-packet.sh` |
| Packet validate | `.SYSTEMX/scripts/validate-setup-packet.mjs` |
| System audit | `.SYSTEMX/scripts/system-audit.sh` |
| Structure check | `.SYSTEMX/scripts/verify-template-structure.mjs` |

Run `bash .SYSTEMX/wsg-agi.sh --check` before deploys to detect drift.

<!-- WSG-AGI:END -->
