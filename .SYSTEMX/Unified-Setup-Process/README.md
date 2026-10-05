# WSG Unified Setup

The Unified Setup Process is the modular, edition-aware successor to the
original linear `Template/steps/00-12` playbook. The legacy steps remain the
golden-path source material; this process adds stack modes, edition manifests,
phase packs, repo-learning, and the `@@CODER.SatoshiUNO` human/AI interaction
standard.

The canonical model is now a 20-phase master plan. The current 10-phase and
15-step flow remains as a compatibility map for existing scripts and docs.

## Editions

| Edition | Purpose | Page Cap |
| --- | --- | --- |
| Enterprise | All options for production-grade systems | None |
| Business | Selected business-tier options | 100 |
| Consumer | Standard WebApp and Commerce WebApp | 50 |
| WSGT | Web Stack Generation Edition Test fork | 50 |
| WSGD | Dev Stack Generation Edition Dev fork | 50 |

Edition manifests live in [`editions/`](./editions/). The setup flow resolves
modules and limits from the selected manifest before scaffolding or deployment.

## Stack Modes

Stack mode is selected before edition:

| Stack Mode | Purpose |
| --- | --- |
| Google/Firebase | Default WSG stack with Firebase, GCloud, React, Vite, Stripe, and Google Workspace defaults |
| Microsoft 365 | Microsoft 365 sender/tenant workflow while preserving Firebase/GCloud unless explicitly changed |
| Custom | Explicit service selection; Supabase only if the user explicitly selects it |

Stack definitions live in [`stacks/`](./stacks/).

## 10 Phases / 15 Steps

| Phase | Name | Steps |
| --- | --- | --- |
| 01 | Sync, Identity, And Interaction | 01-02 |
| 02 | Repo Learning And Template Context | 03-04 |
| 03 | Edition Manifest Resolution | 05 |
| 04 | Tooling And Environment | 06 |
| 05 | App Structure And Page Plan | 07-08 |
| 06 | Platform And Data | 09 |
| 07 | Security And Governance | 10 |
| 08 | Commerce, Business, And Feature Modules | 11 |
| 09 | CI, MCP, QA, And Automation | 12-13 |
| 10 | Build, Deploy, And Post-Launch | 14-15 |

Start at [`steps/01-sync-repo-login-edition.md`](./steps/01-sync-repo-login-edition.md).

For the canonical model, read
[`master-plan/20-PHASE-OUTLINE.md`](./master-plan/20-PHASE-OUTLINE.md).

The planned local current-template builder is documented in
[`../LAN/BUILDER-SYSTEM-PLAN.md`](../LAN/BUILDER-SYSTEM-PLAN.md). It overlays
the canonical phases and uses Vite plus Firebase emulators for local preview;
it does not create a second public app or replace the `.SYSTEMX` deploy
authority. Wave 0 contracts and Wave 1 current-template inventory are complete;
the Wave 2 local-edit slice now supports guarded page/node/source changes,
local CMS/CRM and user fixtures, backups, and operation evidence. Emulator and
authenticated provider adapters remain separate gates.

For new projects, use the first-time setup zip flow: choose OS, stack mode, and
edition; export one setup zip to Downloads; complete the intake/master-plan
documents; then import the returned zip into `.SYSTEMX/Setup-Input_MD/` and
re-inject [`intake/06-AI-REINJECTION-PROMPT.md`](./intake/06-AI-REINJECTION-PROMPT.md)
before continuing implementation.

For the operator-facing flow that connects the root template app, `.SYSTEMX`,
the intake pause, edition manifests, and production deploy, read
[`../USER-INGEST-AND-PRODUCTION-SETUP.md`](../USER-INGEST-AND-PRODUCTION-SETUP.md).

## Operating Rule

Use [`standards/@@CODER.SatoshiUNO.md`](./standards/@@CODER.SatoshiUNO.md) for
every human/AI setup run. The human sets purpose and boundaries; the AI reads
`.SYSTEMX`, follows edition manifests, and records gates/assumptions.

Use [`standards/WSG-Basic-Visual-Baseline.md`](./standards/WSG-Basic-Visual-Baseline.md)
for the starter app's default black, white, and gray color scheme.

Use [`standards/WSG-Account-Levels.md`](./standards/WSG-Account-Levels.md)
for the Level 0-5 access ladder, standard test identities, Firebase custom
claims, emulator fixtures, and Playwright storage-state naming.

Use [`standards/Unified-Login.md`](./standards/Unified-Login.md) for the
five-step login process, provider-aware sender email setup, Google/Firebase
defaults, Microsoft 365 option, GoDaddy DNS option, and secret-safe handoff.

Use [`standards/Firebase-Sender-Auth-MFA.md`](./standards/Firebase-Sender-Auth-MFA.md)
for the durable ordered setup across Firebase Auth domains, sender email, DNS,
primary providers, account bootstrap, custom claims, MFA challenges, rules, and
preview-first smoke tests.

Use [`master-plan/`](./master-plan/) for the canonical 20-phase scratch-to-100%
done model.

## Repo Learning

The scraper in [`scrape/`](./scrape/) inventories accessible WayneTechLab repos
for reusable structure and tooling patterns. It should learn from manifests,
scripts, docs, and workflows, not copy project-specific app code into this
template.
