# 3.4.0 follow-up — SYSTEMX refresh and 1,000-item roadmap — 2026-10-14

- Verify public dotSYSTEMX main still provides alpha.6 with an identical complete
  `.SYSTEMX` Git tree; preserve original import receipt and immutable snapshots.
- Accept documentation-only source advancement only after receipt identity,
  manifest, historical commit identity and full SYSTEMX tree equality checks.
- Add 1,000 proposed TODOs across 20 areas with concrete acceptance/source,
  priorities, phases, dependencies and local/provider/operator gates.
- Generate Markdown and CSV from canonical JSON; add local query, schema,
  validation and CI checks while keeping reusable context/task/memory seeds blank.
- Refresh README/wiki, host planning links, managed integration and quick-start
  persistence wording. App version 3.4.0 and deployment count 0 remain unchanged.

# 3.4.0 follow-up — Automatic restore points and Undo — 2026-10-14

- Save a validated browser-local point of only the selected portals before each
  combined restore. Refuse overwrite if the checkpoint cannot fit or save.
- Persist history through refresh and show time, affected portals and summaries
  before explicit Undo confirmation. Undo replaces full captured portals and
  first saves a new point, allowing the Undo to be reversed.
- Retain at most five points within 2,000,000 serialized characters with oldest
  pruning. Reject malformed/unsupported history until explicit history clearing;
  clearing points leaves all current workspaces intact.
- Preserve unselected records/saved bytes/interface state, existing import and
  Reset behavior, JSON formats, and selected-write rollback warnings.
- Keep plain-text history origin-local and out of exported files; use fictional
  data only. No account, cloud upload or provider authority is added.
- Record this update’s checks in the [restore-point QA receipt](../../docs/RESTORE-POINTS-QA-2026-10-14.md).
  Version 3.4.0/deploy count 0, managed releases, research fingerprints and blank
  adoption seeds remain unchanged.

# 3.4.0 follow-up — Combined backups and selective restore — 2026-10-14

- Add directory-level combined HR/CMS/CRM JSON export, including current fixtures
  for untouched portals, alongside the unchanged individual backup formats.
- Validate the complete bundle before showing summaries and unchecked module
  selections; require at least one full portal and explicit restore confirmation.
- Replace/save only selected portals, preserving unselected memory and exact
  saved bytes; reset selected forms/timers only after a successful restore.
- Revalidate before apply, attempt all selected writes before changing memory,
  and attempt prior-byte rollback on failure. Keep old memory and warn explicitly
  about potentially partial storage if rollback fails; no multi-key atomic claim.
- Document recovery, combined size/schema limits, whole-workspace private mock
  contents, and absence of merging, uploads, accounts or provider authority.
- Record the current checks in the [combined QA receipt](../../docs/COMBINED-BACKUP-QA-2026-10-14.md).
  Preserve earlier receipts, managed releases/research fingerprints and blank seeds.

# 3.4.0 follow-up — Portable mock workspace backups — 2026-10-14

- Export native HR, CMS and CRM separately as validated plain-text JSON snapshots.
- Read imports locally without account/upload, preview their module/time/file and
  require explicit replacement confirmation; Cancel leaves current records intact.
- Validate file size, backup format/version, module and complete nested records.
  Invalid files or replacement-save failure preserve the prior workspace.
- Persist successful replacement only for the named portal; preserve other modules,
  existing local-storage formats and the independent SDK sample.
- Document manual browser/origin transfer, whole-workspace private draft contents,
  saved-action scope and absence of merging, encryption or provider authority.
- Record this update’s verification in the [backup QA receipt](../../docs/PORTAL-BACKUP-QA-2026-10-14.md).
  Preserve earlier receipts, managed releases/research fingerprints and blank seeds.

# 3.4.0 follow-up — Browser-local HR, CMS and CRM persistence — 2026-10-14

- Save native HR, CMS and CRM domain actions in separate versioned browser-local
  snapshots; restore at the same origin after refresh or leaving and returning.
- Restore native HR after SDK preview remounts while keeping SDK state separate.
- Clear only the selected module’s saved snapshot on Reset and restore fixtures.
- Surface storage failure as a visible memory fallback; reject malformed or
  unsupported snapshots into fresh fixtures with a notice.
- Document origin/private-browser limits, saved-action scope, inspectable
  fictional data and the absence of live merging between tabs.
- Verify browser restoration of HR hire/onboarding/time/payroll, benefits,
  performance and surveys; CMS draft/publication revisions; and CRM lead-to-won
  pipeline, plus isolated module Reset followed by refresh.
- Record current verification in the [persistence QA receipt](../../docs/PORTAL-PERSISTENCE-QA-2026-10-14.md);
  preserve earlier receipts and managed SYSTEMX/research fingerprints.

# 3.4.0 follow-up — HR talent, CMS and CRM portals — 2026-10-14

- Add account-free recruiting through native employee onboarding, goals and
  private staged reviews, and identified employee survey programs.
- Connect role-scoped talent counts and action links to HR dashboards/reports.
- Add `/portals`, `/cms/demo` and `/crm/demo` with independent roles, records,
  receipts and Reset controls; preserve module state across shared navigation.
- Add CMS exact-revision review, frozen publication previews and retirement.
- Add CRM companies/contacts, lead conversion, opportunity stages and follow-ups.
- Record 109 HR and 20 CMS/CRM model tests plus the [browser verification](../../docs/HR-TALENT-QA-2026-10-14.md).
- Preserve native/SDK separation and the protected live-provider boundary.

# 3.4.0 follow-up — Connected HR portal — 2026-10-14

- Add role-scoped dashboards, actionable assignment inboxes and live mock reports.
- Add reserved vacation/sick balances, leave decisions, cancellation and overlap guards.
- Connect policy acknowledgment to the related task and pending onboarding check;
  connect starter training to its assigned task without completing profile onboarding.
- Add own-only document acknowledgments, training completion and asset return tracking.
- Add scoped HR requests with assignment, resolution, reopening and sample receipts.
- Freeze per-employee payroll totals, cap deductions to each person's available
  sample pay and display own submitted receipts in employee pay history.
- Preserve imported contracts and live-provider gates. See the [portal guide](../../docs/HR-PORTAL.md)
  and [verification receipt](../../docs/HR-PORTAL-QA-2026-10-14.md).

# 3.4.0 follow-up — Gusto browser fixes — 2026-10-14

- Invalidate pending onboarding profile/summary review after a changed work
  email; preserve accepted employment and historical receipts after hiring.
- Bind sample timers to their original employee, role and work date. Identity
  changes and Reset cancel the timer and clear stale local form values.
- Verify onboarding eligibility, confirmed enrollment/waiver deductions,
  approved-time inclusion, frozen payroll inputs and receipt replay guards in
  an isolated browser session. Retain the 41-test HR regression result and
  [dated browser QA receipt](../../docs/GUSTO-BROWSER-QA-2026-10-14.md).

# 3.4.0 — Complete account-free HR mock journeys — 2026-10-13

- Add onboarding review/completion, benefit election/confirmation and timesheet
  submission/approval with memory-only synthetic records and visible receipts.
- Prepare simulated payroll from approved eligible hours and confirmed sample
  elections; freeze inputs, review fictional totals and prevent receipt replay.
- Extend the development-only genuine SDK adapter for administrative onboarding
  and payroll execution, including isolated sessions, version checks, async
  calculation/submission contracts and explicit simulated completion review.
- Document repeatable no-account scenarios and separate SDK/native coverage from
  Gusto Demo acceptance. Retain the immutable alpha.6 distribution and blank seeds.

# 3.3.0 — Gusto and standard HR workspaces — 2026-10-13

- Add portable GUSTO capability, route, role and data contracts with synthetic
  fixtures, source attribution and the pinned SDK endpoint inventory.
- Add management, employee, manager and contractor HR previews with scoped
  fictional records, checklists, time requests and payroll/payment previews.
- Render the genuine Gusto SDK employee directory using a development-only,
  credential-free mock API; deny unknown operations and all writes.
- Add an optional disabled Firebase Functions foundation, tenant data model,
  rules and tests; keep real provider transport and payroll execution gated.
- Document account requirements, provider/native ownership and migration to
  verified Demo/production. Preserve prior immutable SYSTEMX snapshots.

# 3.2.0 — Managed SYSTEMX 1.9 integration — 2026-10-12

- Import public dotSYSTEMX 1.9.0-alpha.5 at
  aba9620ac07c9fe27572fd37ba80df8d1deeded4; retain the immutable 1.8.6-alpha.1
  snapshot and select the new release with a manual pin.
- Include optional Agent Y CLI handoffs and draft PR workflows, explicit child
  project CLI routing, blank access matrices and maps, and current tools guides.
- Preview and back up recognized stock bootstrap changes before imports;
  preserve adopted records and host extensions and support exact reviewed commits.
- Verify schema-2 media byte for byte, retained snapshots and stock launchers;
  expand blank-seed checks and ignore private root and child CLI runtime state.
- Refresh reviewed stock outer guidance while retaining webapp/LAN functionality,
  production kits, research packages and their checksums, and frozen media.
- Patch the root and starter source-map-js locks to 1.2.2 after the strict audit
  detected GHSA-68fv-2mgg-jv7q in 1.2.1.
- Stage unchanged upstream tests with exact, source-bound packaging metadata in
  temporary copies; keep Markdown validation out of private runtime folders and
  symlink targets.
- Keep Hosting preflight from appending deployment-history entries; preserve
  version, changelog and deployment metadata during check modes.

# 3.1.0 — Unified public and private template

- Combine managed dotSYSTEMX 1.8.6-alpha.1 tooling, project/workspace lifecycle, agent records, event/review roles and reusable seeds with the Firebase webapp.
- Retain LAN runtime, session controls, guarded builder, both research packages, setup workflows and production kits.
- Ship blank project records and identical public/private template trees; retain repository histories separately.
- Add template publication and mirror verification, including snapshot integrity and research checksums.

# Changelog

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


All notable deploys are appended here automatically by
`.SYSTEMX/scripts/deploy.sh` (and version bumps by
`.SYSTEMX/scripts/version-bump.sh`).

Format: each deploy adds a timestamped section with the version and the files
that changed in that run.

## Unreleased local working tree

- Added the fuller standard public route pack: icon-rail `/`, `/about`,
  `/contact`, `/social`; public `/services`, `/features`, `/docs`, `/faq`,
  `/support`, `/security`; governance `/accessibility`, `/privacy`, `/terms`,
  `/changelog`; and system-state `/403`, `/500`, `/offline`.
- Updated the site drawer to use a compact horizontal four-icon primary row,
  a dedicated public-pages stack, a claim-gated staff section, and a bottom
  Login Portal bar.
- Unified the public `/login` and `/admin` routes with the LAN status model so
  local Firebase emulator state, dynamic owned-session ports, and Level 4 / 5
  admin readiness are evidence-based instead of hard-coded.

## 2.4.0 - 2026-08-05

- Integrated the validated `SFWA-WTL-LAN-BUILDER-DESIGNER-RESEARCH-PACKAGE-v1.0.0`
  clean-room package: 200 sources, 29 research documents, 13 roadmap waves,
  planning matrices, risks, acceptance criteria, and Wiki repair work.
- Added the supported/guarded/planned capability manifest, Wave 0 schema
  decisions, evidence packet, and `npm run docs:links` extensionless Wiki link
  validator.
- Repaired stale installer/command/version claims and restored the missing Step
  04 environment/secrets guide. Setup capture now rejects secret-shaped keys,
  does not solicit server secrets, and documents the never-paste policy.
- Moved responsive controls into a centered editor application bar outside the
  preview and added persisted desktop, tablet, iOS, Android, exact-width, and
  Fit iframe preview modes.
- Converted the always-visible Evidence row into a button-controlled drawer.
- Added same-origin live preview inspection: hover/click selection,
  route/source/DOM location, right-click parent and source actions, Navigator
  handoff, and review-gated staging as a reusable module or component.
- Added source metadata to the current and starter app shells for header,
  footer, page navigation, help desk, and accessibility controls in development
  only.
- Added a mandatory post-build LAN isolation scan for local and CI builds.
- Added selected-text editing for safe leaf elements with DOM-only Preview and
  Revert, mapped-source opening, exact-occurrence validation, explicit
  `SAVE TEXT CHANGE`, and reuse of the existing backup/secret-scan/atomic-write
  source gate.
- Synchronized live preview selection across Settings, Navigator hierarchy,
  Components, breadcrumbs, and stack-location feedback.
- Promoted `.SYSTEMX/LAN` to the active local current-template builder and
  co-management layer for SFWA-WTL-G1.
- Rebuilt the LAN workspace shell with compact rails, docked resizable panels,
  persisted layout state, four grouped inspector modes, secondary tool tabs,
  automatic canvas-width protection, phone focus mode, and a bottom evidence
  row that cannot overlay the canvas.
- Added a 56-record de-identified public builder-interface research register
  covering the interaction contracts used by the LAN Builder shell.
- Added the canvas-first LAN designer contract: left structure dock, center
  Vite preview, right tool rail, right inspector closed by default, and a
  `Layers` bottom dock for layer tree and page-model tools.
- Synchronized README, wiki, master plan, status files, and update log so the
  public template reads as an advanced local SYSTEMX builder rather than only a
  starter app.
- Documented local evidence locations for operations JSONL, backups, ingest
  manifests, component registry exports, owned sessions, and ignored runtime
  logs.
- Preserved the production boundary: LAN remains loopback-only, outside
  `public/`, outside `src/`, outside `dist/`, and subordinate to existing
  `.SYSTEMX` quality/deploy gates.

## 2.3.0 - 2026-07-31

- Added **WTL Brand Guide Standard Template v1.0** under
  `.SYSTEMX/KIT/Brand/`.
- Added `.SYSTEMX/KIT/Brand/SYSTEMX-KIT-INDEX.md` as the SYSTEMX-facing
  operator and LLM entry point for six-page PDF brand-guidelines production.
- Added the wiki Brand Guide Kit page and linked it from README, wiki home,
  sidebar, and wiki page map.
- Added Brand Kit integrity anchors to the SYSTEMX structure check.
- Preserved the kit source contract, examples, prompt ingest files, page
  prompts, preflight scripts, PDF stitching scripts, and checksum records.

## 2.2.0 - 2026-07-31

- Added **Wayne Tech Lab LLC. Master Production Kit v1.0** under
  `.SYSTEMX/KIT/Production/`.
- Added `.SYSTEMX/KIT/README.md`, `.SYSTEMX/KIT/Production/SYSTEMX-KIT-INDEX.md`,
  and the wiki Production Kit page.
- Documented dual use: local SYSTEMX production source and standalone GitHub
  folder for LLM/SDK/CLI/MCP/browser-agent consumption.
- Added kit integrity anchors to the SYSTEMX structure check.

## 2.1.1 - 2026-07-31

- Updated the SYSTEMX logo to the exact public product label:
  **S.F.W.A. Template — ".SYSTEMX Forever WebApp" — A Product Provided by Wayne Tech Lab LLC. — Version. Generation 1**.
- Added `docs/assets/systemx-logo.svg` as the deterministic vector master and
  refreshed `docs/assets/systemx-logo.png` as a compatibility render.
- Updated README and wiki home image references, alt text, and product-label copy.

## 2.1.0 - 2026-07-31

- Added Wayne Tech Lab and SYSTEMX visual assets for the public README.
- Reworked the README into a website-style landing page with calls to action,
  beneficiary sections, and flow diagrams.
- Added a dedicated wiki update log so README stays focused on onboarding.
- Linked WayneTechLab.com, SYSTEMX AI standards, Playwright, Chrome DevTools MCP,
  setup, deployment, testing, and security documentation from the landing pages.
- Kept the public template generic and free of private project-specific vendor
  logic.
- Replaced the external router dependency with a lightweight local router and
  refreshed the root and starter lockfiles to zero high/critical audit findings.

## 2.0.0 - 2026-07-31

- Removed runner-based workflow automation from the public template.
- Added the `.SYSTEMX/AI` standard for Agent 0, subagents, MCP/browser tooling,
  connector adapters, and recovery playbooks.
- Added local drift checks for SYSTEMX AI standards.
