# Existing-work reconciliation and acceptance — 2026-10-15

**Agent 0 accepted 23 additional original criteria after the complete local gates.**
The source audits examined `8308237b6bff9e5c6b8c6beb1b54b5c91c82a683`; the only later executable
change at `4e025a3b5c21d0accef4e2e02add2c7eff54d589` aligns the LAN assertion deadline. Relevant existing
implementation and evidence bindings retain their exact source bytes.

Together with the 22-criterion [CRM/adoption acceptance](CRM-ADOPTION-QA-2026-10-15.md),
this adds **45 completions** from published baseline 134: **179 done / 821 remaining**.
Remaining priorities: **38 P1 · 633 P2 · 150 P3**.
Remaining gates: **673 local · 109 operator · 39 provider**.

The root verified **1,000 = 134 prior completions + 22 current candidates + 844
individually audited other TODOs**, with no duplicates, omissions or changed original
criteria/dependencies. The [complete source-audit snapshot](evidence/existing-work-reconciliation-2026-10-15.json)
retains every assessed ID, evidence and concrete gap. Source classifications are advisory;
the canonical catalog alone owns completion.

## Checked original criteria

| Checked ID / original title | Exact original acceptance | Original gate / dependencies |
| --- | --- | --- |
| [x] **WX-0073** — Add a compact mobile portal switcher | At narrow widths, switching portals remains available without a horizontal overflow trap or obscured active label. | local / `[]` |
| [x] **WX-0087** — Specify trusted portal membership contracts | The proposed connected model defines tenant, module, role and revocation fields separately from existing account levels and mock selectors. | local / `[]` |
| [x] **WX-0088** — Specify tenant selection behavior | The adoption contract describes explicit tenant selection and prohibits implicitly sharing records between tenants or demo storage. | local / `["WX-0087"]` |
| [x] **WX-0198** — Add a payroll-ready time reconciliation report | The report compares approved unpaid hours, included payroll hours and consumed entries for a selected period. | local / `[]` |
| [x] **WX-0281** — Add unsaved draft change tracking | Editing a draft shows a dirty indicator that clears only after a successful save or explicit discard. | local / `[]` |
| [x] **WX-0461** — Add record difference inspection for HR restores | A preview can show changed fictional employee counts, time approvals, benefit elections and payroll receipts before whole-module replacement. | local / `["WX-0458"]` |
| [x] **WX-0572** — Add optional safe directory field projections | An adopted projection test fails when an unapproved restricted field appears in the directory response. | operator / `[]` |
| [x] **WX-0616** — Inventory optional SDK network destinations | A source-backed document separates account-free mock endpoints from destinations an adopted real Gusto adapter could contact. | local / `[]` |
| [x] **WX-0632** — Document origin migration privacy implications | Explain that localhost and 127.0.0.1 have separate saves and that moving JSON files creates additional copies beyond the app's erase controls. | local / `[]` |
| [x] **WX-0639** — Define optional privileged action reason policy | For optional operator-approved adoption: The adopted app plan requires a human-readable reason and scoped target for selected owner actions without accepting reason text as authorization. | operator / `[]` |
| [x] **WX-0744** — Add a responsive portal directory comparison | Users can compare portal workflows, roles and account-free boundaries with a layout that stacks labels on small screens. | local / `[]` |
| [x] **WX-0758** — Document local session ownership diagnosis | A runbook shows how to identify the checkout, command and owner of a listener before choosing another port or using the owned stop control. | local / `[]` |
| [x] **WX-0798** — Document SDK preview and HR demo data separation | Support guidance explicitly explains why SDK session fixtures and persisted HR workspace data do not automatically reflect one another. | local / `[]` |
| [x] **WX-0864** — Add an outer-versus-selected guidance diff view | A read-only tool shows which outer instructional files differ from selected defaults and labels host-owned customization rather than overwriting it. | local / `[]` |
| [x] **WX-0873** — Add handoff scope comparison | A review helper compares the accepted task paths with an Agent Y result's actual changed paths and reports unapproved expansion. | local / `[]` |
| [x] **WX-0876** — Add a versioned host evidence index | A maintained index links historical QA receipts to their examined commit and scope without presenting old evidence as current acceptance. | local / `[]` |
| [x] **WX-0879** — Add event-time interpretation examples | Examples distinguish scheduled due time, event occurrence, recorded time and observed execution without starting schedules. | local / `[]` |
| [x] **WX-0890** — Add explicit public versus private publication examples | The adoption guide demonstrates retaining private project records downstream and publishing only reviewed reusable source upstream. | local / `[]` |
| [x] **WX-0891** — Add task acceptance examples for portal work | Examples define observable HR, CMS, CRM and recovery outcomes while separating implementation from browser and provider acceptance. | local / `[]` |
| [x] **WX-0915** — Add a recovery limits summary card | The user guide summarizes per-module, combined-file and history limits with exact current values and their distinct units. | local / `[]` |
| [x] **WX-0929** — Add a short nondeveloper evaluation guide | An evaluator can start an already-installed local app and complete fictional portal journeys without using backend or cloud tooling. | local / `[]` |
| [x] **WX-0934** — Add a mock workspace portability guide | The guide demonstrates moving a real exported combined file between two independent origins and verifying selected records after refresh. | local / `[]` |
| [x] **WX-0944** — Add a training exercise for storage denial | A controlled test profile demonstrates visible save warnings and explains which in-memory actions can be lost on refresh. | local / `[]` |

WX-0087 is accepted before its dependent WX-0088 in this batch. WX-0461 retains
the previously accepted WX-0458 dependency. WX-0572 accepts the actual optional
directory projection/test contract, and WX-0639 accepts the reviewed reason-policy plan;
their operator gates do not become deployed service or human operator acceptance.

## Deliberately unfinished nominations

- **WX-0750:** related documented browser review exists; its original WX-0718 prerequisite remains unfinished.
- **WX-0877:** a guide/proposal freshness warning exists, but the required task-review source/evidence mismatch warning was not found. Root retains it as partial.
- All other partial/gap/manual or external criteria remain unchecked. These audit labels include missing local designs as well as actual manual/provider proof; they do not automatically require accounts or prevent preparing local work.

## Current gate basis

The [CRM/adoption receipt](CRM-ADOPTION-QA-2026-10-15.md) and
[local-gate facts](evidence/crm-adoption-local-gates-2026-10-15.json) bind the exact
68-stage CI terminal 0, separate Hosting preflight terminal 0 and 226 actual browser/
rehearsal groups to `4e025a3b5c21d0accef4e2e02add2c7eff54d589`. The independent final review hash is
`58bcf57c53b94637a5c3a4fca8263824e39cf8dcfdc983e74a880b7aa3ff35d9`. Earlier observations retain their original source.
No provider operation or production deployment occurred.

## Preserved source-audit detail

The appendix below records the source-audit nominations before root acceptance.
Dependency/status observations there describe source 8308237; the checked table above
records the later decision. The frozen six author reports and root disposition remain
unchanged. In particular, no original criterion is weakened to fit an overlapping feature.

## Input report receipts

| Report basename | SHA-256 | Audited rows |
| --- | --- | ---: |
| `webappx-existing-hr-reconciliation.json` | `5ab3d8bcd1befed3b5c137d4ab8ebb4fccf46770abda0d05c133fdb297f40a24` | 120 |
| `webappx-existing-cms-crm-reconciliation.json` | `ce7a7e723587908cca3f2946ecdbf3e3444b48eea18806e6355c749f274345b4` | 185 |
| `webappx-existing-shell-recovery-design-reconciliation.json` | `0817f4445bab694903942cdc144175914dc519c53ff294f9b41406fd78079816` | 124 |
| `webappx-existing-identity-firebase-security-reconciliation.json` | `de3d7242c44928c515ab3ab9079744ff466089096ed6520845b9134bb6f25284` | 136 |
| `webappx-existing-setup-operations-adoption-reconciliation.json` | `a82396030aea0d881afbec175c5f3ad2868cb7e5d805ae388f199ecbb291b8df` | 190 |
| `webappx-existing-quality-integrations-reconciliation.json` | `04a847e36a31ce36e1e2d344cd9c7092b9b80610a95be80b6402b257a6bcda5d` | 89 |

## Classification counts

| Class | Count |
| --- | ---: |
| implemented-and-evidence-candidate | 24 |
| partial | 401 |
| gap | 359 |
| manual-or-external | 60 |

## Known root review qualifications

- **WX-0877** — root audit disposition recorded; canonical acceptance pending: A guide/proposal freshness preview is not direct evidence of an actual Agent Z task-review evidenceRevision warning. Root and independent provenance review did not locate that direct proof.

## Separate root review dispositions

Frozen author classifications are preserved under sourceClassification;
the following explicit review layer changes only this audit view.

### WX-0877 — root review disposition

**Exact original acceptance:** A review preview flags evidence tied to a different source revision and asks the coordinator to judge the changed scope.

- Gate: `local`.
- Dependencies: `[]`.
- Author class: `implemented-and-evidence-candidate`; root audit class: `partial`.

**Root rationale:** Root review agrees with the independent operations cross-review at source830: preserve the original task-review requirement and the author nomination as historical evidence. Leave this original criterion unfinished; no author report is rewritten.

**Remaining original requirement:** A task-review preview must flag a source/evidence revision mismatch and ask the coordinator to judge the changed task scope. The existing guide/proposal freshness preview is related work; Agent Z currently copies both revision fields without that warning.

No canonical acceptance is recorded by this disposition.


## Source nominations at the examined audit revision

The source audits nominate these rows. A nomination does not replace the
original criterion, declared dependencies or local/operator/provider gate.
A document/plan criterion is evaluated at artifact scope; it does not claim
runtime enforcement or provider activation.

### WX-0073 — Add a compact mobile portal switcher

**Exact original acceptance:** At narrow widths, switching portals remains available without a horizontal overflow trap or obscured active label.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-shell-recovery-design-reconciliation.json`.

**Remaining original requirement/evidence:** Root must review retained exact evidence; no implementation gap identified for this narrow-switching criterion.

**Preserved combined assessment:** Wrapped minimum-height links retain visible active aria-current labels; existing narrow/x-large directory control audits cover labels and bounds.

**Evidence qualification:** Existing authored literal assertions/historical receipts only; no new test/browser execution.

**Evidence mapping:**

- `docs/PORTAL-STATUS-INVENTORY.md:178,178`
- `docs/PORTAL-STATUS-INVENTORY.md:20,20`
- `src/pages/TemplatePortalsPage.tsx`
- `src/pages/TemplatePortalsPage.tsx:48,48`
- `tests/browser/portal-quality.mjs:337,337` — WX-0722: actual Extra large preference yields 20px root text at 390px width; HR, CMS and CRM labels/entered values/save actions fit, survive Tab/Enter and match complete independent exports and saved envelopes
- `tests/browser/portal-quality.mjs:392,392` — WX-0655: real accessible names are measured across directory/HR/CMS/CRM/import/selective restore/Undo with hidden portal modules mounted; duplicate global selectors are recorded and each repeated record action/import is resolved by a unique semantic scope
- `tests/portals/registry.test.mjs:55,55` — every directory card and crosslink has metadata and points to its own route family

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0087 — Specify trusted portal membership contracts

**Exact original acceptance:** The proposed connected model defines tenant, module, role and revocation fields separately from existing account levels and mock selectors.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-shell-recovery-design-reconciliation.json`.

**Remaining original requirement/evidence:** Design-scope evidence only; no adopted backend, rules or provider authority is implied.

**Preserved combined assessment:** Proposed membership and separate portal grants define tenant/UID, module roles/bundles, status and revision/revocation independently of tiers and selectors.

**Evidence qualification:** Existing authored literal assertions/historical receipts only; no new test/browser execution.

**Evidence mapping:**

- `docs/IDENTITY-ADOPTION-CONTRACTS.md:118,118`
- `docs/IDENTITY-ADOPTION-CONTRACTS.md:81,81`
- `docs/TEMPLATE-PORTALS.md:672,672`
- `docs/TEMPLATE-PORTALS.md`
- `docs/TENANT-MEMBERSHIP-PROPOSAL.md:38,38`
- `src/portals/PortalChrome.tsx:14,14`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0088 — Specify tenant selection behavior

**Exact original acceptance:** The adoption contract describes explicit tenant selection and prohibits implicitly sharing records between tenants or demo storage.

- Original gate: `local`.
- Original dependencies: `["WX-0087"]`.
- Source report: `webappx-existing-shell-recovery-design-reconciliation.json`.
- Dependency states at basis: WX-0087 = todo.

**Remaining original requirement/evidence:** Documentation scope only; original WX-0087 dependency remains. No tenant UI/connected execution is claimed.

**Preserved combined assessment:** Proposed operations bind explicitly selected organization and same-tenant resource ownership; selector intent is untrusted and mock state is separate from adopted storage.

**Evidence qualification:** Existing authored literal assertions/historical receipts only; no new test/browser execution.

**Evidence mapping:**

- `docs/TEMPLATE-PORTALS.md:672,672`
- `docs/TEMPLATE-PORTALS.md:880,880`
- `docs/TEMPLATE-PORTALS.md`
- `docs/TENANT-MEMBERSHIP-PROPOSAL.md:46,46`
- `src/portals/PortalChrome.tsx:14,14`
- `src/portals/PortalWorkspaceProvider.tsx:79,79`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0198 — Add a payroll-ready time reconciliation report

**Exact original acceptance:** The report compares approved unpaid hours, included payroll hours and consumed entries for a selected period.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-hr-reconciliation.json`.

**Existing fulfilment:** Selected-period eligibility table compares each approved/unpaid or consumed time row with frozen prepared entries and hours; stale/changed-period warnings require reprepare. Existing actual UI journey asserts inclusion/exclusion, literal frozen inputs, intervening approved hours and consumed receipt.

**Remaining original requirement/evidence:** No implementation gap found under the original literal criterion. No separate new route or aggregate-total layout is required by that wording.

**Evidence qualification:** Current source implements the literal criterion and existing authored product tests plus historical QA observations cover its clauses. This is a candidate for Agent 0 acceptance, not a new execution result.

**Evidence mapping:**

- `docs/HR-PORTAL.md:51,91`
- `docs/PORTAL-MATURITY-QA-2026-10-15.md:14,20`
- `docs/PORTAL-MATURITY-QA-2026-10-15.md:15,20`
- `docs/PORTAL-MATURITY-QA-2026-10-15.md:62,66`
- `src/hr/components/HrWorkspace.tsx:217,249`
- `src/hr/components/HrWorkspace.tsx:232,245`
- `src/hr/mock-workflows.ts:344,389`
- `src/hr/mock-workflows.ts:62,116`
- `src/hr/mock-workflows.ts:62,80`
- `src/hr/mock-workflows.ts:9,45`
- `tests/browser/portal-maturity.mjs:153,171`
- `tests/browser/portal-maturity.mjs:153,191`
- `tests/browser/portal-maturity.mjs:173,191`
- `tests/hr/mock-workflows.test.mjs:230,230` — payroll freezes approved time and elections, calculates separate fictional deductions and blocks receipt replay
- `tests/hr/mock-workflows.test.mjs:289,289` — payroll caps each employee benefit to their own pay and freezes reconciled statement totals
- `tests/hr/payroll-periods-rates.test.mjs:109,109` — newly approved hours mark preparation stale and block every next stage until intentional reprepare
- `tests/hr/payroll-periods-rates.test.mjs:66,66` — chosen periods exclude draft, inactive, paid and outside dates with an explanation for every row
- `tests/hr/payroll-periods-rates.test.mjs:79,79` — per-employee effective rates freeze beside hours and reconcile independent totals
- `tests/hr/selected-payroll-insights.test.mjs:25,25` — dashboard readiness uses the chosen run period and explicit effective rate eligibility

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0281 — Add unsaved draft change tracking

**Exact original acceptance:** Editing a draft shows a dirty indicator that clears only after a successful save or explicit discard.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-cms-crm-reconciliation.json`.

**Preserved combined assessment:** The existing CMS editor computes save-normalized dirty state, renders a visible unsaved indicator, clears its buffer only after accepted Save or explicit discard, and keeps invalid/refused drafts. Existing literal model/browser tests and public guide cover the dirty baseline and Keep/Discard semantics. It is a reconciliation candidate, not a new acceptance.

**Evidence qualification:** No authored browser assertion directly matching the indicator text was found. Existing literal tests establish dirty normalization and save/discard baseline behavior; the visible indicator is an explicit conditional in the reviewed source. Agent0 must judge this evidence before any completion; this is not an acceptance or a new browser result.

**Evidence mapping:**

- `docs/PORTAL-MATURITY.md:39,50`
- `src/cms/CmsDemo.tsx:156,156`
- `src/cms/CmsDemo.tsx:236,245`
- `src/cms/CmsDemo.tsx:314,314`
- `src/cms/model.ts:51,55`
- `tests/browser/portal-maturity.mjs:242,268` — WX-0282: a successful save is a clean baseline; keep-editing retains the unsaved buffer and discard switches without changing complete saved records
- `tests/portals/cms.test.mjs:218,229` — dirty checks ignore save normalization and detect actual content changes including invalid drafts
- `tests/portals/cms.test.mjs:231,242` — a successful normalized save becomes a clean baseline and leaves another entry and publication unchanged

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0461 — Add record difference inspection for HR restores

**Exact original acceptance:** A preview can show changed fictional employee counts, time approvals, benefit elections and payroll receipts before whole-module replacement.

- Original gate: `local`.
- Original dependencies: `["WX-0458"]`.
- Source report: `webappx-existing-shell-recovery-design-reconciliation.json`.
- Dependency states at basis: WX-0458 = done.

**Remaining original requirement/evidence:** Root must review evidence; original completed WX-0458 dependency remains.

**Preserved combined assessment:** Complete HR comparison includes employees/status, approval-bearing time entries, employee-plan elections and payroll receipt collections; restore/Undo render differences before replacement and literal nested/full-field fixtures exist.

**Evidence qualification:** Existing authored literal assertions/historical receipts only; no new test/browser execution.

**Evidence mapping:**

- `docs/PORTAL-STATUS-INVENTORY.md:20,20`
- `src/hr/persistence.ts`
- `src/portals/CombinedWorkspaceBackup.tsx:14,14`
- `src/portals/WorkspaceInspection.tsx:117,117`
- `src/portals/workspace-inspection.ts:420,420`
- `src/portals/workspace-inspection.ts:421,421`
- `src/portals/workspace-inspection.ts:422,422`
- `src/portals/workspace-inspection.ts:430,430`
- `tests/browser/portal-maturity.mjs:493,493` — WX-0458: combined restore and Undo show literal directional added/removed/changed counts and IDs before any write; Undo and its reversal recover the complete target/current graphs while existing point labels, times and payloads remain intact
- `tests/portals/workspace-inspection.test.mjs:123,123` — hidden nested fields change the complete parent and nested rows without doublecounting module totals
- `tests/portals/workspace-inspection.test.mjs:138,138` — all stored entity fields participate in change detection without being returned
- `tests/portals/workspace-inspection.test.mjs:288,288` — presentation exposes scoped regions, all collection counts, omission notices and no hidden free text
- `tests/portals/workspace-inspection.test.mjs:78,78` — all nested HR, CMS and CRM collections report literal nonempty captured counts without free text

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0572 — Add optional safe directory field projections

**Exact original acceptance:** An adopted projection test fails when an unapproved restricted field appears in the directory response.

- Original gate: `operator`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-identity-firebase-security-reconciliation.json`.

**Existing fulfilment:** directoryProjection uses a closed named-field whitelist; existing literal test injects SSN, nested bank/tax/compensation, payCents, DOB and homeAddress and asserts the exact directory keys. The implemented backend.directory consumes this projection.

**Remaining original requirement/evidence:** No implementation gap found for the narrow optional projection-test criterion. Root must review scope and obtain/qualify the existing test execution receipt; no deployed/provider adoption is inferred.

**Evidence mapping:**

- `integrations/gusto/functions/src/backend.mjs:15,33,37,46`
- `integrations/gusto/functions/src/projections.mjs:3,5,13,41`
- `tests/hr/gusto-backend.test.mjs:100,104,106`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0616 — Inventory optional SDK network destinations

**Exact original acceptance:** A source-backed document separates account-free mock endpoints from destinations an adopted real Gusto adapter could contact.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-identity-firebase-security-reconciliation.json`.

**Existing fulfilment:** The existing source-backed CSP finite inventory explicitly separates /__gusto_mock__/ same-origin SDK requests from overridden API defaults, real Gusto/hosted-flow candidates and optional Auth/DEV origins; no accepted real provider origin is selected.

**Remaining original requirement/evidence:** No implementation gap found for requested source-backed destination document. Reuse it rather than author another inventory; retain historical/source-only qualifications and root acceptance.

**Evidence mapping:**

- `docs/CSP-REPORT-ONLY-ADOPTION-PROPOSAL.md:24,34`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0632 — Document origin migration privacy implications

**Exact original acceptance:** Explain that localhost and 127.0.0.1 have separate saves and that moving JSON files creates additional copies beyond the app's erase controls.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-identity-firebase-security-reconciliation.json`.

**Existing fulfilment:** TEMPLATE-PORTALS explicitly states localhost and127.0.0.1 use separate sample saves. Backup QA documents importing into another origin creates an independent save. State contract says downloaded files remain separate and browser/site clearing does not manage those copies.

**Remaining original requirement/evidence:** No missing documentation clause found across these maintained guides. Historical executed backup receipt remains its original source; no fresh browser proof is asserted for this documentation criterion.

**Evidence mapping:**

- `docs/PORTAL-BACKUP-QA-2026-10-14.md:26,33`
- `docs/PORTAL-STATE-CONTRACT.md:39,229,247,248`
- `docs/SECURITY-ASSUMPTIONS.md:28`
- `docs/TEMPLATE-PORTALS.md:326,339,346`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0639 — Define optional privileged action reason policy

**Exact original acceptance:** For optional operator-approved adoption: The adopted app plan requires a human-readable reason and scoped target for selected owner actions without accepting reason text as authorization.

- Original gate: `operator`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-identity-firebase-security-reconciliation.json`.

**Existing fulfilment:** Reviewed identity design requires redacted human-readable reason2–500 characters, exact operation/tenant/target UID and expected revision for selected membership/owner operations. Protected independent approval and verified identity are required; browser approval/role fields cannot substitute. Section7 binds selected owner assign/revoke/recover actions to exact scope.

**Remaining original requirement/evidence:** Artifact-design criterion appears fully covered by existing reviewed plan. This does not install a reason/enforcement service or grant authority from reason text; root accepts policy reuse separately.

**Evidence mapping:**

- `docs/IDENTITY-ADOPTION-CONTRACTS.md:69,114,134,148,149`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0744 — Add a responsive portal directory comparison

**Exact original acceptance:** Users can compare portal workflows, roles and account-free boundaries with a layout that stacks labels on small screens.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-shell-recovery-design-reconciliation.json`.

**Remaining original requirement/evidence:** Root must review retained exact evidence; no implementation gap identified for responsive comparison.

**Preserved combined assessment:** Directory workflow/role/save cards and fictional/account-free boundaries stack below lg; narrow control audits cover labels/entry points.

**Evidence qualification:** Existing authored literal assertions/historical receipts only; no new test/browser execution.

**Evidence mapping:**

- `docs/PORTAL-STATUS-INVENTORY.md:178,178`
- `docs/PORTAL-STATUS-INVENTORY.md:20,20`
- `src/pages/TemplatePortalsPage.tsx`
- `src/pages/TemplatePortalsPage.tsx:59,59`
- `src/pages/TemplatePortalsPage.tsx:62,62`
- `src/portals/registry.ts:22,22`
- `tests/browser/portal-quality.mjs:337,337` — WX-0722: actual Extra large preference yields 20px root text at 390px width; HR, CMS and CRM labels/entered values/save actions fit, survive Tab/Enter and match complete independent exports and saved envelopes
- `tests/browser/portal-quality.mjs:392,392` — WX-0655: real accessible names are measured across directory/HR/CMS/CRM/import/selective restore/Undo with hidden portal modules mounted; duplicate global selectors are recorded and each repeated record action/import is resolved by a unique semantic scope
- `tests/portals/registry.test.mjs:55,55` — every directory card and crosslink has metadata and points to its own route family

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0750 — Create a cross-portal interaction review checklist

**Exact original acceptance:** A documented browser review covers focus, text scaling, empty states, errors and restore controls with named screenshots and unresolved findings.

- Original gate: `local`.
- Original dependencies: `["WX-0718"]`.
- Source report: `webappx-existing-shell-recovery-design-reconciliation.json`.
- Dependency states at basis: WX-0718 = todo.

**Remaining original requirement/evidence:** Artifact criterion has evidence; original WX-0718 dependency remains TODO and blocks root acceptance.

**Preserved combined assessment:** Status inventory plus keyboard/safety QA document focus/text scale/empty/errors/restore with named screenshots and remaining limitations.

**Evidence qualification:** Existing authored literal assertions/historical receipts only; no new test/browser execution.

**Evidence mapping:**

- `docs/KEYBOARD-PORTALS-QA-2026-10-15.md:64,64`
- `docs/PORTAL-SAFETY-QA-2026-10-15.md:155,155`
- `docs/PORTAL-STATUS-INVENTORY.md:164,164`
- `docs/PORTAL-STATUS-INVENTORY.md:178,178`
- `docs/PORTAL-STATUS-INVENTORY.md:20,20`
- `docs/PORTAL-STATUS-INVENTORY.md:41,41`
- `src/pages/TemplatePortalsPage.tsx`
- `src/pages/TemplatePortalsPage.tsx:48,48`
- `src/portals/CombinedWorkspaceBackup.tsx:14,14`
- `tests/browser/portal-quality.mjs:337,337` — WX-0722: actual Extra large preference yields 20px root text at 390px width; HR, CMS and CRM labels/entered values/save actions fit, survive Tab/Enter and match complete independent exports and saved envelopes
- `tests/browser/portal-quality.mjs:389,389` — WX-0722: all three individual import confirmations/cancel actions and selective restore/Undo confirmations retain labels/actions at actual x-large/narrow width; Tab/Enter confirms real replacements and Undo restores complete prior records and saved bytes
- `tests/browser/portal-quality.mjs:529,529` — WX-0720 auditor negative DOM fixture: record titles containing converted/won cannot satisfy absent product status badges

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0758 — Document local session ownership diagnosis

**Exact original acceptance:** A runbook shows how to identify the checkout, command and owner of a listener before choosing another port or using the owned stop control.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** PID/parent/command/CWD diagnosis, alternate port and owned stop/recheck are documented.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `.SYSTEMX/LAN/session-restart-preview.mjs`
- `.SYSTEMX/LAN/tests/session-restart-preview.test.mjs`
- `docs/GETTING-STARTED.md`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0798 — Document SDK preview and HR demo data separation

**Exact original acceptance:** Support guidance explicitly explains why SDK session fixtures and persisted HR workspace data do not automatically reflect one another.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** SDK/native data, persistence, Reset and payroll-input separation is explicit.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/GUSTO-SETUP.md`
- `docs/PORTAL-STATE-CONTRACT.md`
- `tests/hr/gusto-sdk-mock.test.mjs`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0864 — Add an outer-versus-selected guidance diff view

**Exact original acceptance:** A read-only tool shows which outer instructional files differ from selected defaults and labels host-owned customization rather than overwriting it.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Read-only provenance identifies modified outer instructions and host-owned customization.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/SYSTEMX-PROVENANCE.md`
- `scripts/systemx-provenance.py`
- `tests/systemx/test_provenance.py`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0873 — Add handoff scope comparison

**Exact original acceptance:** A review helper compares the accepted task paths with an Agent Y result's actual changed paths and reports unapproved expansion.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Changed-path helper rejects tracked/untracked out-of-allowlist and linked result changes.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `.SYSTEMX/.systemx/releases/1.9.0-alpha.6/scripts/agent_y.py`
- `.SYSTEMX/.systemx/releases/1.9.0-alpha.6/tests/test_agent_y.py`
- `.SYSTEMX/docs/AGENT-Y.md`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0876 — Add a versioned host evidence index

**Exact original acceptance:** A maintained index links historical QA receipts to their examined commit and scope without presenting old evidence as current acceptance.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Versioned freshness map retains historical receipt source/date/category/scope/hash independently.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/DOCUMENTATION-FRESHNESS.md`
- `docs/evidence/documentation-freshness-map.json`
- `tests/backlog/documentation-freshness.test.mjs`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0879 — Add event-time interpretation examples

**Exact original acceptance:** Examples distinguish scheduled due time, event occurrence, recorded time and observed execution without starting schedules.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Agent X examples distinguish due/occurrence/recording/actual execution without scheduling jobs.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `.SYSTEMX/.systemx/releases/1.9.0-alpha.6/scripts/agent_x.py`
- `.SYSTEMX/docs/AGENT-X.md`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0890 — Add explicit public versus private publication examples

**Exact original acceptance:** The adoption guide demonstrates retaining private project records downstream and publishing only reviewed reusable source upstream.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Private adoption/public upstream publication are distinct and preserve adopted records.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/SYSTEMX-INTEGRATION.md`
- `docs/examples/private-template-adoption.md`
- `tests/systemx/test_adoption.py`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0891 — Add task acceptance examples for portal work

**Exact original acceptance:** Examples define observable HR, CMS, CRM and recovery outcomes while separating implementation from browser and provider acceptance.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Four portal demos define literal observable outcomes with browser/provider boundaries.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/PORTAL-EVALUATOR-WORKSHEET.md`
- `docs/demos/CMS-FIVE-MINUTE.md`
- `docs/demos/CRM-FIVE-MINUTE.md`
- `docs/demos/HR-FIVE-MINUTE.md`
- `docs/demos/RECOVERY-TEN-MINUTE.md`
- `tests/browser/evaluator-demos.mjs`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0915 — Add a recovery limits summary card

**Exact original acceptance:** The user guide summarizes per-module, combined-file and history limits with exact current values and their distinct units.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Exact file-byte/decoded/envelope/history-character and point limits/units are documented.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/TEMPLATE-PORTALS.md`
- `src/portals/backup.ts`
- `src/portals/combined-backup.ts`
- `src/portals/restore-points.ts`
- `tests/portals/restore-budget.test.mjs`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0929 — Add a short nondeveloper evaluation guide

**Exact original acceptance:** An evaluator can start an already-installed local app and complete fictional portal journeys without using backend or cloud tooling.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Installed native evaluator start and four paced journeys need no backend/cloud tools.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/GETTING-STARTED.md`
- `docs/PORTAL-EVALUATOR-WORKSHEET.md`
- `tests/browser/evaluator-demos.mjs`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0934 — Add a mock workspace portability guide

**Exact original acceptance:** The guide demonstrates moving a real exported combined file between two independent origins and verifying selected records after refresh.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Actual combined transfer/selective replacement/refresh guidance links historical two-origin proof.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/COMBINED-BACKUP-QA-2026-10-14.md`
- `docs/TEMPLATE-PORTALS.md`
- `tests/browser/portals-smoke.mjs`
- `wiki/Template-Portals.md`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

### WX-0944 — Add a training exercise for storage denial

**Exact original acceptance:** A controlled test profile demonstrates visible save warnings and explains which in-memory actions can be lost on refresh.

- Original gate: `local`.
- Original dependencies: `[]`.
- Source report: `webappx-existing-setup-operations-adoption-reconciliation.json`.

**Preserved combined assessment:** Controlled denied-storage guide/profile proves warning, memory export and refresh loss.

**Remaining proof/observation:**

- Agent 0 reviews exact original scope and existing evidence applicability after required completed gates. This audit accepts no criterion.

**Evidence mapping:**

- `docs/PORTAL-RECOVERY-FAILURE-DRILL.md`
- `docs/PORTAL-STATE-CONTRACT.md`
- `tests/browser/portal-state-contract.mjs`
- `tests/browser/recovery-failure-drill.mjs`

**Remaining decision:** Agent 0 must review the exact criterion, dependencies,
scope and evidence qualification, then bind the final gate result separately.
This helper does not select an accepted list or edit canonical completion.

## Limits and preservation

- The public candidate contains repository-relative evidence paths only.
- Private report locations are represented only by basenames and SHA-256 digests.
- Input report bytes are preserved; differing classification vocabulary is mapped
  to four finite audit classes without promoting any row to done.
- No tests, source code, package scripts, service state or Git refs are changed.
