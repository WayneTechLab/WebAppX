# User Ingest And Production Setup

This page shows how to use the runnable template and `.SYSTEMX` together from a
fresh project to production deploy. The matching in-repo operator file is
`.SYSTEMX/USER-INGEST-AND-PRODUCTION-SETUP.md`.

## The model

WebApp Stack G1 has two parts:

- **Root template app**: the React/Vite/Firebase starter that becomes the product.
- **`.SYSTEMX` control layer**: setup, scripts, edition manifests, security,
  deployment, version history, and human/AI handoff.

Use them together. The root app is what ships; `.SYSTEMX` is how it is safely
configured, checked, and deployed.

## Fresh start

```bash
gh repo create my-app --template WayneTechLab/WebAppX --private --clone
cd my-app
npm install
npm run dev
bash .SYSTEMX/WSG-MENU.sh
```

Choose menu option `1` to start the guided production path.

## Correct order

| Order | Action | Gate |
| --- | --- | --- |
| 1 | Sync repo, branch, remotes, project name, and purpose | `npm run sync:system:check` |
| 2 | Login and tooling for GitHub, Google/GCloud, Firebase, and optional Stripe/MCP/M365/GoDaddy | `bash .SYSTEMX/scripts/bootstrap.sh --interactive-login` |
| 3 | Select OS target, stack mode, and edition | Setup state recorded |
| 4 | Export one setup packet zip, complete it externally, and import it back | Packet validated |
| 5 | Re-inject `06-AI-REINJECTION-PROMPT.md` into the AI/code tooling session | AI has current project context |
| 6 | Resolve modules for pages, auth, Firebase, commerce, local gates, security, monitoring, and docs | Module list approved |
| 7 | Configure Firebase, env files, rules, secrets, sender provider, authorized domains, and optional Stripe/Functions | Config sanity checks pass |
| 8 | Apply WSG Account Levels 0-5, Unified Login, and Firebase sender/auth/MFA order | Account-level and auth/MFA checks pass |
| 9 | Run lint, typecheck, tests, security, build, and deploy preflight | All gates green |
| 10 | Deploy production and record handoff | Deploy history and status updated |

## Intake packet

Before the AI continues deep setup, the human fills these files:

- `.SYSTEMX/Unified-Setup-Process/intake/01-PROJECT-BRIEF.md`
- `.SYSTEMX/Unified-Setup-Process/intake/02-EDITION-MODULES.md`
- `.SYSTEMX/Unified-Setup-Process/intake/03-PAGES-ROUTES.md`
- `.SYSTEMX/Unified-Setup-Process/intake/04-DATA-AUTH-SECURITY.md`
- `.SYSTEMX/Unified-Setup-Process/intake/05-INTEGRATIONS-DEPLOY.md`
- `.SYSTEMX/Unified-Setup-Process/intake/07-MASTER-PLAN.md`
- `.SYSTEMX/Unified-Setup-Process/intake/08-INSTRUCTIONS-AND-CONSTRAINTS.md`
- `.SYSTEMX/Unified-Setup-Process/intake/09-BUSINESS-PLAN.md`
- `.SYSTEMX/Unified-Setup-Process/intake/10-FIRST-PHASE-TODO.md`
- `.SYSTEMX/Unified-Setup-Process/intake/11-PROJECT-ARCHITECTURE.md`
- `.SYSTEMX/Unified-Setup-Process/intake/12-FRONTEND-UI-UX-PLAN.md`
- `.SYSTEMX/Unified-Setup-Process/intake/13-BACKEND-DATA-INTEGRATION-PLAN.md`
- `.SYSTEMX/Unified-Setup-Process/intake/14-SECURITY-OPERATIONS-PLAN.md`
- `.SYSTEMX/Unified-Setup-Process/intake/15-LAUNCH-POST-LAUNCH-PLAN.md`
- `.SYSTEMX/Unified-Setup-Process/intake/06-AI-REINJECTION-PROMPT.md`

Use:

```bash
bash .SYSTEMX/scripts/first-time-setup-packet.sh --pause
```

Then paste the completed `06-AI-REINJECTION-PROMPT.md` into the AI session.

## Standard LLM packet

When the goal is to produce an updated template version, or when a new LLM
session needs the full reusable standard before project-specific intake, copy
the files in `.SYSTEMX/Standard-MD-Files/` first.

Start with `.SYSTEMX/Standard-MD-Files/00-COPY-ORDER.md`, then paste the
remaining files in order. After that, paste project-specific intake files if the
LLM is setting up a concrete project.

That packet includes design, media/assets, content/SEO, accessibility/UX, and
brand token standards so visual and content work does not drift away from the
setup/security/deploy system.

To use the stock setup files locally or create a user-friendly copy outside the
codebase, run:

```bash
bash .SYSTEMX/scripts/build-setup-packet.sh
```

The script asks `Mac` or `Windows`, stack mode, edition, packet tier, and
packet shape, then writes one setup zip to the OS Downloads folder.

To inspect the updated files by command, run:

```bash
bash .SYSTEMX/scripts/import-setup-packet.sh
```

## Edition choices

| Edition | Use when | Page cap |
| --- | --- | --- |
| Enterprise | Full platform with all modules, security, monitoring, commerce, MCP, local gates, and repo-learning | No template cap |
| Business | Business site or app with selected business modules | 100 pages |
| Consumer | Standard web app or commerce web app | 50 pages |
| WSGT | Test fork for tooling, MCP, local gates, and template validation | Test-defined |
| WSGD | Dev fork for experiments and future standards | Dev-defined |

## AI/human operating standard

Use `@@CODER.SatoshiUNO`:

- Human gives purpose, stack mode, edition, constraints, and approval boundaries.
- AI reads `.SYSTEMX` first and checks repo state before editing.
- AI follows edition manifests and module docs.
- AI asks only for decisions that cannot be discovered.
- AI records assumptions, gates, and outputs in `.SYSTEMX/status/` and setup docs.
- Secrets are never stored in persistent markdown.

## Production gates

Run these before deploy:

```bash
npm run sync:system:check
npm run ci:lint
npm run ci:typecheck
npm run ci:test
npm run ci:security
npm run auth:mfa:check
npm run ci:build
bash .SYSTEMX/scripts/deploy.sh --preflight
```

Deploy with:

```bash
bash .SYSTEMX/scripts/deploy.sh --check
bash .SYSTEMX/scripts/deploy.sh hosting --dry-run
bash .SYSTEMX/scripts/deploy.sh app --fast
```

Production is complete when the app is live, sender email and authorized domains
are verified, account levels and Unified Login are verified, MFA/admin policy is
documented, rules are deny-by-default, runbooks are updated, and no live secrets
exist in git history or persistent AI-visible docs.
