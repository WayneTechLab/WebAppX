# User Ingest And Production Setup

This guide explains how to use the runnable template and `.SYSTEMX` operations
together when starting a new project from scratch and carrying it through
production deploy.

Use this file inside the repo. The matching GitHub wiki page is
`wiki/User-Ingest-and-Production-Setup.md`.

## Purpose

The template has two layers that must stay together:

- **Root app**: the live React/Vite/Firebase starter that gets copied into a new
  project and becomes the product.
- **`.SYSTEMX`**: the operating system for setup, governance, tooling, security,
  docs, deployment, version history, and AI/human handoff.

Do not treat `.SYSTEMX` as optional project notes. It is the control layer that
keeps the template repeatable from first clone to production.

## Start From A Fresh Template

```bash
gh repo create my-app --template WayneTechLab/WebAppX --private --clone
cd my-app
npm install
npm run dev
```

Then open the control panel:

```bash
bash .SYSTEMX/WSG-MENU.sh
```

Use menu option `1` for the guided production path.

## Required Order

Run setup in this order. Do not skip ahead past a failed gate.

1. **Sync and verify repo**
   - Confirm branch, remotes, repo name, package name, and project purpose.
   - Run `npm run sync:system:check`.
2. **Login and tooling**
   - Run `bash .SYSTEMX/scripts/bootstrap.sh --interactive-login`.
   - Add flags as needed: `--with-stripe`, `--with-mcp`, `--with-m365`,
     `--with-godaddy`.
   - Complete interactive login for GitHub, Google/GCloud, Firebase, Stripe, or
     Microsoft 365 before moving on.
3. **Select stack mode and edition**
   - Stack mode comes first: Google/Firebase, Microsoft 365, or Custom.
   - Enterprise: all options, no template page cap.
   - Business: business tier, 100 page cap.
   - Consumer: standard or commerce web app, 50 page cap.
   - WSGT: test fork for standard tooling and MCP validation.
   - WSGD: dev fork for experiments and future standards.
4. **Fill intake files**
   - Complete every file in `.SYSTEMX/Unified-Setup-Process/intake/` in order.
   - Keep secrets out of markdown.
   - Use placeholders for values that must be created later.
   - Use the packet export/import flow instead of loose markdown folders:

     ```bash
     bash .SYSTEMX/scripts/build-setup-packet.sh
     ```

     Return one updated setup zip and import it into `.SYSTEMX/Setup-Input_MD/`.
5. **Re-inject the AI prompt**
   - Paste the completed
     `.SYSTEMX/Unified-Setup-Process/intake/06-AI-REINJECTION-PROMPT.md` back
     into the AI/code tooling session.
   - The AI must read `.SYSTEMX` first, follow the edition manifest, and ask
     only for decisions that cannot be discovered.
6. **Resolve modules**
   - Use `.SYSTEMX/Unified-Setup-Process/editions/` and `modules/` to decide
     which auth, pages, commerce, Firebase, MCP, CI, security, monitoring, and
     docs surfaces are enabled.
7. **Configure platform**
   - Paste Firebase web config through `.SYSTEMX/Template/lib/firebase-config.sh`
     or the guided menu.
   - Configure `.env.local`, `.secrets.env`, `.firebaserc`, Firebase rules,
     Storage rules, and optional Functions/Stripe values.
8. **Apply account and login standards**
   - Use `.SYSTEMX/Unified-Setup-Process/standards/WSG-Account-Levels.md`.
   - Use `.SYSTEMX/Unified-Setup-Process/standards/Unified-Login.md`.
   - Keep Level 0-5 test identities available for emulator and Playwright
     coverage.
9. **Run gates**
   - `npm run ci:lint`
   - `npm run ci:typecheck`
   - `npm run ci:test`
   - `npm run ci:security`
   - `npm run ci:build`
   - `bash .SYSTEMX/scripts/deploy.sh --preflight`
10. **Deploy production**
    - Start with `bash .SYSTEMX/scripts/deploy.sh --check`.
    - Deploy targeted surfaces first when needed:
      - `bash .SYSTEMX/scripts/deploy.sh hosting --dry-run`
      - `bash .SYSTEMX/scripts/deploy.sh rules`
      - `bash .SYSTEMX/scripts/deploy.sh app --fast`
    - Use full deploy only after preflight gates are green.
11. **Post-launch handoff**
    - Update `.SYSTEMX/status/`.
    - Update `.SYSTEMX/webapp-version/CHANGELOG.md`.
    - Confirm runbooks in `.SYSTEMX/docs/` and root `docs/`.
    - Archive setup answers and document next actions.

## Intake Files

The human fills these files before asking the AI to continue the build:

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

Run:

```bash
bash .SYSTEMX/scripts/first-time-setup-packet.sh --pause
```

This prints the ordered file list and records the setup pause in
`.SYSTEMX/logs/setup-history.jsonl`.

## Standard MD Export And Ingest

When a user needs files outside the codebase for a browser LLM, run:

```bash
bash .SYSTEMX/scripts/build-setup-packet.sh
```

The script asks `Mac` or `Windows`, stack mode, edition, packet tier, and
packet shape, then writes a single zip to the OS Downloads folder.

To import and validate the returned packet by command, run:

```bash
bash .SYSTEMX/scripts/import-setup-packet.sh
```

## Human And AI Contract

Use `@@CODER.SatoshiUNO` as the operating contract:

- Human sets purpose, stack mode, edition, constraints, provider choices, and approval
  boundaries.
- AI reads `.SYSTEMX` first and checks repo state before editing.
- AI follows the edition manifest and module docs.
- AI records assumptions, gates, and outputs in setup/status docs.
- Secrets are never pasted into persistent docs.
- Live-key sessions include deletion and rotation warnings.

## Production Definition Of Done

A setup is production-ready when:

- The selected stack mode and edition manifest have been resolved.
- Intake files are complete and re-injected.
- Firebase/GCloud/GitHub login and project selection are confirmed.
- Sender email provider is selected: Google Workspace/Firebase default,
  Microsoft 365 if mail lives there, or other documented provider.
- Account Levels 0-5 and Unified Login are wired.
- Firestore and Storage rules are deny-by-default.
- CI, security, build, and deploy preflight gates pass.
- Runbooks, secrets docs, monitoring docs, and deployment history are updated.
- No live secrets are committed or left in AI-visible persistent markdown.
