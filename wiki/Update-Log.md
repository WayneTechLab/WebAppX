# Update Log

## 3.4.0 browser fixes — 2026-10-14

- Keep pending onboarding review consistent with profile edits. A changed work
  email invalidates profile/summary review; unchanged saves and later contact
  changes after completed hiring preserve accepted history.
- Bind sample timers to their original employee, role and work date. Changing
  preview identity/role or using Reset cancels the timer and clears stale inputs.
- Verify Jordan's approved eight hours stay excluded while onboarding, then
  become payroll eligible after completion and Active directory readback.
  Unconfirmed retirement is ignored; confirming after preparation leaves the
  frozen $192 net until a new preparation captures the plan. The resulting
  $240 gross/$48 illustrative withholding/$25 benefit/$167 net run produces
  `MOCK-PAYROLL-0004`.
- Verify Avery's confirmed waiver produces $192 net in `MOCK-PAYROLL-0007`,
  excluding Jordan's receipted hours and enrollment from the new run.
- Record **41 passing HR tests**: 16 native, 11 SDK-client mock and 14 optional
  backend boundary checks. Preserve the October 13 release receipt and its
  historical 39-test result.

Read the [2026-10-14 browser QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-BROWSER-QA-2026-10-14.md)
for exact steps and results. This is a fixes/documentation update to **3.4.0**,
not a new tagged release. It verifies linked native mock state; the separate SDK
UI was not retested, and no provider, Firebase deployment or financial acceptance
is implied. Managed dotSYSTEMX **1.9.0-alpha.6**, immutable snapshots and blank
adoption seeds remain unchanged.

## 3.4.0 — 2026-10-13

Complete the account-free mock journeys for employee onboarding, payroll,
benefits and time tracking. Native HR controls now validate transitions, scope
employee/manager actions, freeze approved payroll inputs and produce fictional
receipts. The development SDK adapter adds isolated administrative onboarding
and payroll execution samples. Simulated submission never contacts Gusto or
moves funds.

Read [Gusto setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
and the [3.4.0 validation receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.4.0.md).
The selected dotSYSTEMX defaults remain **1.9.0-alpha.6** with the original import
fingerprint. Earlier release receipts, snapshots and blank seeds remain intact.

## 3.3.0 — 2026-10-13

- Select managed dotSYSTEMX 1.9.0-alpha.6, including the portable
  `.SYSTEMX/GUSTO/` route, role, ownership, capability and adoption package.
- Add `/hr` entry points and synthetic `/hr/demo` management, employee,
  manager and contractor workspaces. App-owned checklist, time and time-off
  actions use local React state that resets on refresh.
- Integrate genuine Gusto React SDK 0.56.6 employee directory reads at
  `/hr/demo/sdk` against development-only local wire-format fixtures. The mock
  endpoint is absent from Hosting and `npm run preview`.
- Add an optional isolated Firebase HR/Gusto backend foundation, disabled and
  unregistered by default. Protected connected portals remain unconfigured;
  trusted memberships, provider access and enabled live workflows need adoption.
- Add `npm run hr:test` and `npm run hr:backend:audit`, and document the
  preview/setup path in [Gusto HR and Employee Management](Gusto-HR-and-Employee-Management.md).
- Preserve blank reusable coordination seeds, immutable earlier snapshots,
  research package bytes and host extensions. The historical 3.2.0 and 3.1.0
  receipts keep their original revisions and results.

The [3.3.0 validation receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.3.0.md)
records actual source/local checks. Directory mocks and synthetic workflows do
not establish full SDK support, live payroll or production Firebase acceptance.

## 3.2.0 — 2026-10-12

- Select managed dotSYSTEMX 1.9.0-alpha.5 from public main
  `aba9620ac07c9fe27572fd37ba80df8d1deeded4`, with manifest fingerprint
  `483e564855c8f3ecd9255a06fdb7994a0df85cc23fa3a531ecd638746378cd37`.
- Extend import preview/apply with recognized stock bootstrap migration and
  exact local backups before selecting new defaults. Preserve original snapshots,
  downstream records, configured commands and webapp/LAN/KIT/setup extensions.
- Include optional Agent Y CLI handoffs and branch/PR controls, the CLI/tools
  guide, explicit installed-CLI `.SYSTEMXP` routing and blank access/map seeds.
  The public registry remains Agent 0 only; this import activates no roles.
- Add [Agent Y New App Setup](Agent-Y-New-App-Setup.md) with Bash/PowerShell role
  previews, adopted-app check configuration, private prompt/state verification,
  clean-repository setup checkpoints, local CLI handoffs and optional draft PR
  gates. The examples create no active records in the reusable template.
- Refresh README/wiki navigation, Quick Start, the platform matrix and testing
  guidance for 3.2.0. The wiki exporter converts local page links to rendered
  GitHub wiki URLs while preserving repository copies and code examples.
- Verify schema 2 media and unknown files byte for byte while retaining the
  historical manifest contract for earlier snapshots.
- Keep native Windows Agent Y execution unavailable pending verified descendant
  process termination. Platform tests and Firebase deployment remain distinct
  acceptance boundaries; the historical 3.1.0 receipt retains its original scope.

The release gates are `npm run ci:all`, `npm run sync:system:check` and
`npm run deploy -- hosting --preflight`. This entry describes the source change;
it does not claim completed publication, Windows runtime tests or hosting deployment.

## 3.1.0 documentation refresh — 2026-10-04

- Add getting-started, current command and identical-mirror maintenance guides.
- Align README, wiki navigation and folder diagrams with managed defaults,
  canonical WORK records and `webapp-version/`.
- Document the included PowerShell launcher and retained Bash-only host flows.
- Distinguish blank reusable-template gates from adopted-project validation.
- Document managed operating summaries in the local LAN API and dashboard.


## 3.1.0 — 2026-10-04

Unified public/private template with managed SYSTEMX 1.8.6-alpha.1, blank adoption
records, retained LAN/Firebase/KIT capabilities, both research packages, and
tracked-tree mirror verification. No production hosting deployment is implied.


## 3.0.0 - 2026-10-04

- Refreshed compatible dependency locks, aligned Firebase to 12.19.0 and pinned
  the transitive @grpc/grpc-js dependency to patched 1.x (^1.14.5); strict root
  and starter dependency audits are part of release verification.

- Adopted the standalone public dotSYSTEMX 1.8.6-alpha.1 distribution from
  public main b69801848a4f7b990c4ab4380bf435f37671e13a as immutable managed defaults.
- Added explicit, verified public-source preview/import commands and versioned
  commit/fingerprint receipts; imports preserve host records and end pinned.
- Added the project plan, canonical maintenance task ledger, project context,
  current focus and configured webapp checks.
- Connected the standalone menu and import actions to the retained WSG lifecycle.
- Updated private host and starter versions, README/wiki identity, integration
  guide, adoption example and integration preservation tests.
- Preserved Firebase/LAN functionality, production kits, sanitized placeholders,
  research source credit and historical logs. No public upstream or deployment
  was changed by this integration.


This page is the public-facing update log for WebAppX. README is the
landing page; release history belongs here and in `.SYSTEMX/webapp-version/CHANGELOG.md`.

## Unreleased local working tree

- Added the fuller standard public route pack: icon-rail `/`, `/about`,
  `/contact`, `/social`; public `/services`, `/features`, `/docs`, `/faq`,
  `/support`, `/security`; governance `/accessibility`, `/privacy`, `/terms`,
  `/changelog`; and system-state `/403`, `/500`, `/offline`.
- Updated the site drawer to use a compact horizontal four-icon primary row,
  a separate public-pages stack, a claim-gated staff section, and a bottom
  Login Portal bar so the default shell better matches the template standard.
- Added the shared Firebase Auth provider registry and local-emulator
  email/password flow for the public `/login` route.
- Added the claim-gated `/admin` management shell for CMS/CRM, Cloud, Stripe,
  SEO, and SYSTEMX LAN entry points without granting browser-side authority.
- Added LAN `/api/auth/providers` status and a Unified Authentication panel that
  reports the actual dynamic emulator ports and fail-closed Google,
  email-link/code, custom-token, and OIDC/SAML readiness states.
- Updated `dev:systemx` to own Firebase Auth, Firestore, and Storage emulator
  children with automatic port selection, session ownership, and cleanup so it
  cannot attach to another local project's familiar ports.
- Added the unified-auth contract, structure/test coverage, root/.SYSTEMX docs,
  and the [Unified Login and Admin Operations](Unified-Login-and-Admin-Operations.md)
  wiki page.
- Added the Style inspector Font browser with a checked-in offline Google Fonts
  catalog, optional server-side Google Fonts Developer API metadata, live Vite
  `document.fonts` inventory, CSS2 preview loading, and guarded project font
  writes using `SAVE FONT CHANGE`.
- Added independent editor dock visibility controls. Left and right menus now
  report `Auto` or `Always shown`, support an explicit Keep open confirmation,
  and reconcile collapsed/pinned state on every layout save so refreshes and
  editor saves do not unexpectedly close a working menu.
- Aligned the public `/login` and Level 4/5 `/admin` front-end with the LAN
  status read model. Both local surfaces now show the owned Vite/Firebase
  session, dynamic emulator ports, current-template mode, provider state,
  repository/data evidence, and detected tooling; admin cards no longer claim
  every backend surface is green, and production correctly describes the LAN
  as documentation-only.

## 2.4.0 - 2026-08-05

- Added the full [SYSTEMX LAN Operations Manual](SYSTEMX-LAN-Operations-Manual.md)
  and [SYSTEMX LAN API Reference](SYSTEMX-LAN-API-Reference.md), covering the
  dynamic session supervisor, safe ports, builder screen map, guarded writes,
  local provider lanes, ingest, evidence, security boundaries, and staff
  start/end-of-day handoff sequence.

- Integrated the validated `SFWA-WTL-LAN-BUILDER-DESIGNER-RESEARCH-PACKAGE-v1.0.0`
  clean-room research package under `.SYSTEMX/LAN/Research/LAN-Builder/`:
  200 sources, 29 research documents, 13 roadmap waves, feature/backlog
  matrices, risks, acceptance criteria, and Wiki repair work.
- Added the research-backed LAN Builder Designer master plan, status board,
  Wiki page, and nine draft Designer contracts while preserving the current
  G1 LAN implementation boundary and explicitly labeling later waves planned.
- Added `npm test` LAN characterization coverage for loopback health,
  current-repository read models, session-token mutation authority,
  allowlisted source paths, and runtime/API isolation.
- Added the supported/guarded/planned capability manifest, schema promotion
  decisions, Wave 0 evidence packet, and `npm run docs:links` extensionless Wiki
  link validation.
- Repaired stale Wiki installer/command/version claims, restored the missing
  Step 04 environment/secrets guide, and replaced AI secret-paste guidance with
  a never-paste policy plus rotation procedure.

- Moved responsive preview controls into a centered editor application bar
  outside the canvas, with exact pixel width, named Apple/Android presets, and
  Fit mode.
- Converted Evidence into an on-demand drawer instead of permanent screen
  content.
- Added same-origin live preview inspection with hover/click selection,
  route/source/DOM location, parent selection, source and Navigator actions,
  and review-gated module/component staging.
- Added a mandatory public-build isolation scan; developer source hints remain
  available to LAN in Vite development but are absent from `dist`.
- Added safe selected-text editing with automatic Settings context, local
  Preview/Revert, mapped source opening, explicit guarded save, and one shared
  target across Navigator, Components, breadcrumbs, and the canvas.
- Promoted `.SYSTEMX/LAN` from planning language to the active local
  current-template builder and co-management surface.
- Added the canvas-first LAN designer behavior: left structure dock, center
  Vite preview, right tool rail, closed-by-default inspector, and `Layers`
  bottom dock for page-model work.
- Documented the active local-edit vertical slice: routes/pages, source view
  and save, page metadata, typed node-tree fixtures, CMS/CRM fixtures, user
  fixtures, reusable component registry, and inventory-only existing-project
  ingest.
- Documented LAN evidence and log locations, including local operations JSONL,
  backup snapshots, ingest manifests, component registry exports, and SYSTEMX
  status/update files.
- Synchronized root README, wiki pages, `.SYSTEMX` status docs, and version
  metadata to the advanced SYSTEMX Local Control direction.

## 2.3.0 - 2026-07-31

- Added **WTL Brand Guide Standard Template v1.0** under
  `.SYSTEMX/KIT/Brand/`.
- Added the SYSTEMX-facing Brand Guide Kit index and wiki page.
- Documented the six-page PDF brand-guidelines workflow, prompt-ingest order,
  locked-logo rules, local Python preflight/stitch commands, and LLM entry
  prompt.
- Added Brand Kit anchors to the local structure check.

## 2.2.0 - 2026-07-31

- Added **Wayne Tech Lab LLC. Master Production Kit v1.0** under
  `.SYSTEMX/KIT/Production/`.
- Added `.SYSTEMX/KIT/README.md`, `.SYSTEMX/KIT/Production/SYSTEMX-KIT-INDEX.md`,
  and the wiki [Production Kit](Production-Kit.md) page.
- Documented dual use: local SYSTEMX production source and standalone GitHub
  folder for LLM/SDK/CLI/MCP/browser-agent consumption.
- Added kit integrity anchors to the SYSTEMX structure check.

## 2.1.1 - 2026-07-31

- Updated the SYSTEMX logo to the exact public product label:
  **WebAppX — ".SYSTEMX Forever WebApp" — A Product Provided by Wayne Tech Lab LLC. — Version. Generation 1**.
- Added `docs/assets/systemx-logo.svg` as the deterministic vector master and
  refreshed `docs/assets/systemx-logo.png` as a compatibility render.
- Updated README and wiki home image references, alt text, and product-label copy.

## 2.1.0 - 2026-07-31

- Added Wayne Tech Lab and SYSTEMX visual assets.
- Reworked the README into a public landing page with calls to action, benefit
  sections, and Mermaid diagrams.
- Updated the wiki home page to read like a branded documentation landing page.
- Added this dedicated update log page.
- Linked WayneTechLab.com, SYSTEMX AI standards, Playwright, Chrome DevTools MCP,
  setup, testing, security, deployment, and wiki pages together.
- Kept connector and vendor language generic so private project-specific IP does
  not enter the public template.
- Replaced the external router dependency with a lightweight local router and
  refreshed the root and starter lockfiles to zero high/critical audit findings.

## 2.0.0 - 2026-07-31

- Removed runner-based workflow automation from the base public template.
- Added `.SYSTEMX/AI` as the generic home for Agent 0, subagent lanes, message
  envelopes, browser/MCP tooling, external connector adapters, and recovery
  playbooks.
- Added `npm run ai:standard:check`, `npm run browser:install`,
  `npm run browser:codegen`, and `npm run mcp:chrome`.
- Added the wiki page [Agent Mesh And Tooling Standard](Agent-Mesh-and-Tooling-Standard.md).
- Published tag `v2.0.0`.

## Log Policy

- Keep this page human-readable and public.
- Put operational detail in `.SYSTEMX/webapp-version/CHANGELOG.md`.
- Put deep process documentation in the relevant wiki page.
- Do not store secrets, private customer names, proprietary vendor workflows, or
  paid-service account details in the public update log.
