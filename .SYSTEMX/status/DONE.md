# DONE — WebApp Stack G One Point Zero

Completed work on the generic template system. Newest first.

## 2026-08-05

- ✅ **Unified WebApp/Auth vertical slice** — `/login` now uses the local
  Firebase Auth emulator for email/password account creation and sign-in;
  `/admin` is a Level 4/5 claim-gated shell; and the LAN provider panel plus
  `/api/auth/providers` read from the shared provider registry. Google,
  email-link/code, custom-token, and OIDC/SAML SSO remain visible but fail
  closed until explicitly configured.
- ✅ **LAN Builder Designer research Wave 0** — validated and integrated the supplied
  200-source clean-room package, repaired stale/unsafe Wiki and setup claims,
  restored Step 04 environment/secrets guidance, added Markdown-link checking,
  added the supported/guarded/planned capability manifest, recorded schema
  promotion decisions, and captured the Wave 0 evidence packet. All required
  local gates pass; future Designer kernel waves remain explicitly planned.
- ✅ **Editor application bar and live element inspection** — centered
  desktop/tablet/iOS/Android, exact-width, and Fit controls outside the preview;
  converted Evidence into an on-demand drawer; and added click/right-click
  selection with route, source, DOM path, parent navigation, Navigator/source
  actions, and review-gated module/component staging.
- ✅ **Production LAN isolation gate** — development-only source metadata is
  removed by the production build, and every local/CI build now fails if LAN
  files, labels, inspector markers, or source-location attributes enter `dist`.
- ✅ **Selected-text editor and shared selection model** — clicking safe
  leaf text opens Settings; Preview/Revert are DOM-only; guarded Save requires
  one exact source match and `SAVE TEXT CHANGE`; and Navigator, Components,
  breadcrumbs, source mapping, and the canvas all share the selected target.
- ✅ **SYSTEMX LAN active builder vertical slice** — `.SYSTEMX/LAN` now runs as
  the local-only SYSTEMX Local Control surface for the current checkout, with
  Vite bridge support, direct loopback service, safe automatic ports, and
  session-owned stop/status controls.
- ✅ **Canvas-first LAN designer cleanup** — design mode now shows a clean
  center Vite preview, left structure dock, right tool rail, closed-by-default
  inspector, and `Layers` bottom dock for layer/page-model work.
- ✅ **Responsive LAN workspace shell v2** — replaced the squeezed five-column
  layout with compact rails, resizable/persisted panel tracks, grouped and
  tabbed right inspectors, automatic canvas-width protection, phone focus
  mode, and a non-overlapping bottom evidence row. Browser geometry and
  interaction checks passed at 1440, 1280, 1024, 768, and 640 pixels.
- ✅ **Builder UX evidence register** — documented 56 de-identified public
  builder-interface records and translated their interaction contracts into
  SYSTEMX-specific local-control rules without copying vendor code or branding.
- ✅ **Guarded local edit path** — LAN supports local page metadata,
  node-tree/module fixtures, CMS/CRM fixture records, local user fixtures,
  reusable component registry updates, inventory-only ingest, and allowlisted
  source saves with backup, confirmation, secret checks, and operation
  evidence.
- ✅ **Evidence map and docs sync** — README, wiki, `.SYSTEMX` docs, master plan,
  update log, and status files now identify the template as an advanced local
  builder and co-management system instead of only a starter app.

## 2026-07-01

- ✅ **Unified Setup intake packet** — added `.SYSTEMX/Unified-Setup-Process/intake/`
  with ordered project brief, edition/modules, pages/routes, data/auth/security,
  integrations/deploy, and AI reinjection prompt files.
- ✅ **First-time setup pause** — added `.SYSTEMX/scripts/first-time-setup-packet.sh`
  and wired it into `start-production.sh`, `Template/setup.sh`, and `WSG-MENU`.
- ✅ **WSG Level 0-5 working app layer** — added `src/auth/accountLevels.ts`,
  `src/auth/useAccountLevel.ts`, `/login`, standard test identities, and
  account-level checks in `.SYSTEMX/scripts/account-level-check.mjs`.
- ✅ **Unified Login standard** — documented Google/Firebase default,
  Microsoft 365, GoDaddy DNS, Stripe, sender email, and secret-safe handoff.
- ✅ **Audit-clean dependency model** — removed vendored `firebase-tools`; scripts
  resolve Firebase CLI from PATH or `npx --yes firebase-tools`.
- ✅ **Deploy script expansion** — `.SYSTEMX/scripts/deploy.sh` now supports
  target modes, `--preflight`, `--audit`, `--dry-run`, `--check`,
  `--rollback-info`, `--fast`, and background mode.
- ✅ **Docs alignment** — README, `.SYSTEMX`, template docs, and wiki updated for
  Vite 8, current pages, first-time intake, Level 0-5, Unified Login, deploy
  controls, and zero-warning security/audit gates.

## 2026-06-08

- ✅ **Start Template into Production wizard** — `.SYSTEMX/scripts/start-production.sh`,
  now **menu option #1**. Guided one-time flow: tooling check → identity →
  Firebase/Google config (paste once) → secure `.env` seeding → Prompt Ingest
  `.md` → install/build → deploy → **delete-the-chat security reminder**.
- ✅ **One-time secure env seeding** — `wsg_capture_env_paste` + `wsg_seed_env_files`
  write `.env.local` (client) and `.secrets.env` (server, `chmod 600`), with
  backups; all git-ignored.
- ✅ **Prompt Ingest** — wizard ingests a project build-spec `.md` to
  `PROMPT-INGEST.md` (git-ignored) for the AI agent to build on top of.
- ✅ **`WSG-MENU` terminal command** — `.SYSTEMX/scripts/install-command.sh` adds
  a shell function to `~/.zshrc` / `~/.bashrc` so you can type `WSG-MENU` in any
  terminal (idempotent install/uninstall).
- ✅ **Tooling bootstrap** — `.SYSTEMX/scripts/bootstrap.sh` installs,
  authenticates, and verifies all SDKs + CLIs (Node, Git, gh, gcloud, Firebase,
  optional Stripe) plus app SDKs.
- ✅ **WTL integration** — pulled the generic operational layer out of the WTL
  system into `.SYSTEMX/`: rich submenu `WSG-MENU.sh`, `deploy.sh` (smart Firebase
  targets), focused deploy scripts, `quality-check.sh`, `version-bump.sh`,
  `firebase-setup.sh`, git hooks, and `version/` tracking. Stripped all
  WTL-specific bits (hardcoded project, WTL-AGI, SupportX, admin migration).
- ✅ **WTL folder removed** — `.SYSTEMX/WTL/` deleted after extraction.
- ✅ **WSG-MENU control panel** — one launcher for tooling, Firebase config
  capture (Web/iOS/Android), guided setup, quality, version, Firebase, git, dev.
- ✅ **Firebase project capture** — `Template/lib/firebase-config.sh` lets the
  operator paste per-platform config (Web `firebaseConfig`, iOS
  `GoogleService-Info.plist`, Android `google-services.json`).
- ✅ **Guided playbook** — `Template/` steps 00→12, `setup.sh`, `starter/`.
- ✅ **Docs** — root README, `Template/README.md`, and the GitHub wiki updated.
- ✅ **Git hygiene** — `interview.answers`, `logs/`, `deploy-count.txt`, secrets
  are git-ignored.
