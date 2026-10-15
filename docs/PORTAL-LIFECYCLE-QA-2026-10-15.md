# HR lifecycle, CMS releases and CRM ownership verification — 2026-10-15

Status: **verification in progress; all sixteen criteria remain TODO**.
This receipt follows the published
[safety checkpoint](PORTAL-SAFETY-QA-2026-10-15.md). Agent 0 will record
acceptance only after the current browser evidence, independent review and
integration requirements are complete. The active goal covers all 1,000
original criteria; this bounded implementation does not finish that goal.

## Source and preservation contract

Implementation began in an isolated checkout from
`61d39c9c855fb3f56913cb7c2f8010a6a485b746`. The preceding safety checkpoint was
subsequently published at `f5ed3ded151d2dee94c9abc0588f4f3a1d31e8ec` with
test-fixture and documentation descendants. Their application source is equal.

The initial lifecycle runtime freeze contained **100 application source files**,
with manifest SHA-256
`66301a29537c8d189547174f3480ab2d7cfaf7f6767bf0d56cb4035cc9010493`.
It followed the independently reviewed model, import-validation,
functional-update, inspection and CMS sibling-key fixes.

The actual narrow/x-large browser check then found a real min-content overflow
after directory history existed: a refusal paragraph measured x = −140 px and
670.796875 px wide in a 390 px viewport. Its outer text sample points were
outside the viewport. The retained `webappx-browser-portal-lifecycle-FXpynX`
diagnostic records the measurement and element capture; a complete element
screenshot alone would not establish that the user could see its full text.

The correction root and history scroller now allow shrinking, the full seven
column table retains horizontal scrolling, local live messages wrap, and the
two existing directory/profile wrappers use an explicit single flexible grid
track. No content is hidden or removed. Independent review confirmed these are
layout-only changes. The final **100-file** manifest is
`48fb5c3a1b0aeebbb6d52f982aa95c5689c9c26b1b9e325c8c39b0b4a99d4882`.
Only two sources differ from the initial freeze:

| Source | Final SHA-256 |
| --- | --- |
| `src/hr/components/HrDirectoryCorrections.tsx` | `84b456d3d44cf83b2cedbf2d253a932a11522beb29e31e71510572d8779e953c` |
| `src/hr/components/HrWorkspace.tsx` | `297f4fb063ca37a98a22566a67ec3fe64d92c392931d15d2691261aeba96c9fb` |

The other 98 sources remain byte-identical. The two affected source fingerprints
were deliberately reviewed and refreshed in both role/capability evidence and
their generated guides. Final browser verification must bind to these bytes;
a later product change requires a new freeze and relevant verification.

The selected SYSTEMX release remains **1.9.0-alpha.6**, manually pinned with
manifest `009e6b6c2f1359fa4c88e3961164d28cc89f65cea2a6682200fb2953caf326e3`.
Managed snapshots, research inventories, SDK pin/license/vendor inventory and
reusable context/plan/task/memory seeds are outside this implementation.

## Original acceptance scope

Definitions, source fields, priorities, gates and dependencies are preserved.
All sixteen gates are local. CMS and CRM include their P2 predecessors before
their dependent P1 operation can be accepted.

| Criterion | Implemented contract awaiting final acceptance |
| --- | --- |
| WX-0101 | Rehire keeps the employee ID and archives original instance onboarding/receipt before creating a new instance and incomplete captured checklist. |
| WX-0102 | Transfer preview shows previous/proposed department and manager, the explicitly chosen effective date and affected report scopes. |
| WX-0103 | Leave, return and termination require a sample reason and retain prior/proposed state in an ordered event. |
| WX-0104 | Termination creates exactly three local asset/access/handover captures and linked ordinary tasks. |
| WX-0105 | Rehire comparison separates retained identity and original records from the new instance and checklist requirements. |
| WX-0106 | Direct-report scope comparison lists old/new manager relationships; self-management is refused. |
| WX-0107 | Reporting-cycle refusal identifies affected employee IDs and preserves the complete accepted state. |
| WX-0108 | Accepted email edits expose old/new values, actor preview and action sequence in saved directory history. |
| WX-0109 | Own-employee correction requests leave the directory unchanged until an HR outcome; acceptance records the change atomically and rejection records its reason. |
| WX-0110 | Selected onboarding template is captured for new hires and rehires; earlier completed checklists and receipts retain their original binding. |
| WX-0314 | A publisher captures two or more separately approved entries in a named release; preparation changes no publication or ordinary receipt. |
| WX-0315 | Read-only release preview identifies stale approvals and duplicate routes; invalid activation accepts no entries. |
| WX-0316 | Valid activation accepts all frozen publications and ordinary receipts together, or retains the entire prior CMS state. |
| WX-0379 | Owner/manager lead reassignment records both fictional assignees and the acting preview identity. |
| WX-0380 | Account transfer lists every linked contact, converted lead, opportunity and task, including closed/completed records. |
| WX-0381 | Confirmation accepts one complete graph ownership result or refuses without changing any record/receipt. |

## Behavioral boundaries

### HR identity, scope and history

`workflow.onboarding` remains the sole editable active onboarding payload.
The optional lifecycle extension captures instance identity, templates, archived
payloads, events, directory history, corrections and offboarding assignments.
Legacy saves need no extension or mandatory date step for ordinary onboarding.
Legacy instance start dates remain unknown; chosen simulation/effective dates
are explicit inputs, with no background scheduler or clock inference.

Every display and domain action uses the same effective employee fixture.
Manager changes affect current report scope; changing the manager of an
unfinished review is refused until that review is acknowledged. Import
validation also refuses a graph that would strand an unfinished review.
Self-management and reporting cycles are checked before acceptance.

Rehire retains balances, rate history, benefits and frozen payroll receipts;
it does not silently reset financial or time history. Original consumed time
retains its prior payroll receipt. A new instance captures its own checklist
and later completion receipt. Termination creates fictional local assignments;
it changes no real asset, account access or provider system.

Corrections are currently bounded to fictional work email. Own employee and
manager proposals remain page/identity scoped. HR can edit directly or record
an accepted/rejected request with a reason. Stale confirmation, no-op and
invalid input accept no state and consume no sequence. Preview roles are
workflow inputs, without trusted authentication or tenant authority.

### CMS releases

Preparation captures entry identity, immutable collection/author, approved
revision/content, approval receipt and previous frozen publication. Historical
captures remain valid after ordinary editing makes them ineligible to activate.
Activation rechecks the complete latest workspace, actor and captured facts,
then builds and validates one replacement containing every member publication.
There is no partial accepted release or replay action.

Current and frozen publication routes participate in collision checks. Normal
strict authoring/import validation prevents malformed duplicate routes from
entering accepted React state. The browser therefore tests a real invalid
duplicate-route upload and exact preservation, complemented by a pure preview
regression for the defensive duplicate-route diagnostic. It does not inject
invalid product state to manufacture a reachable activation screen.

### CRM ownership

Unconverted lead reassignment is separate from account graph transfer.
Transfers include company, contacts, converted leads, all linked opportunities
and their tasks. A free-text company-name match creates no relationship and
does not move an unconverted lead. Historical activity keeps its captured
ownership and text; a new receipt lists actor, old/new assignees and affected IDs.

Only canonical owner or sales-manager previews can inspect ownership changes
from a complete validated workspace. Representative projections are refused.
No-op/stale choices, conflicting company names, malformed links and graphs
over the 200-record review limit accept no partial result.

### Persistence and recovery

Absent optional extensions remain absent in legacy workspaces until a meaningful
accepted action. Individual export/import and combined selected restore/Undo
retain complete new records. Inspection compares optional collections in both
directions and fingerprints complete hidden captures; safe visible metadata
stays bounded to identifiers, dates, states and counters. Nested captures do
not inflate primary record totals. Free email/body/title/reason content is
excluded from structured inspection metadata.

## Independent source review and focused checks

Review closed concrete findings before runtime freeze:

- Imported hire/rehire instances cannot claim active status without a valid
  instance-bound completed checklist and receipt event. Original assignment is
  anchored to the raw seed or immutable captured hire.
- Transfer and rehire cannot strand an unfinished review under its former
  manager; import validation enforces the same graph relationship.
- CMS preparation/activation rechecks through the actual synchronous functional
  provider updater. A captured stale callback accepts zero commits and retains
  the latest workspace. Captured collection/author forgery is rejected.
- Backup and CMS release controls use separate sibling key namespaces, fixing
  a real browser React/DOM collision before the final runtime freeze.
- Inspection preserves exact legacy report hashes, directional optional-field
  differences, reorder stability, complete hidden fingerprints and safe output.

| Focused scope | Completed local evidence |
| --- | --- |
| HR lifecycle model | 29 regression cases; 206 HR behavior cases excluding separately owned role/capability suites. |
| Employment UI callbacks | Four actual callback cases. |
| Directory correction callbacks | Seven cases, including page/identity scope and latest-state confirmation. |
| CMS releases and related editor/persistence | 53 cases: 12 release, three actual callback, 12 editor, 17 CMS and nine persistence cases. |
| CRM ownership and existing graph/import | 39 cases: ten new ownership cases and 29 prior regressions. |
| Shared inspection/differences | 43 cases: 15 new extension cases and 28 prior cases. |
| Role/capability source review | 57 cases; 50 reviewed role sources and 51 gap sources. Seven role projections, 18 literal transitions, 33 canonical SDK mappings and vendor fingerprint semantics are preserved. |

These focused totals overlap existing domain suites and are not added together
as a unique assertion count. Typecheck and scoped lint passed on frozen source.
The configured full integration gate remains pending; this document currently
grants no catalog acceptance.

## Final standalone native browser evidence

The retained `webappx-browser-portal-lifecycle-izeHOX/report.json` passed
**20/20 checks/check groups** on the final 100-file runtime freeze. It uses four
fresh account-free contexts, the canonical native seed and real controls,
downloads and uploads. Complete independent expected records cover all three
portals, including unrelated saved envelopes and preferences. No domain/model
generator or invalid React-state injection supplies expected results.

| Scope | Actual recorded result |
| --- | --- |
| HR legacy and instance onboarding | Original onboarding works without a new date requirement. Rehire archives original receipt `MOCK-ONBOARDING-0002`; the selected v2 instance completes under a separate `MOCK-ONBOARDING-0003` receipt. |
| Selected version on a recruiting hire | Real publish/screen/interview/offer/hire controls create a new hired employee, instance and three pending v2 tasks while retaining both earlier onboarding receipts. |
| Transfers and reasons | Actual old/new assignment and report scopes, self-manager disabled option, exact cycle-member IDs, unfinished-review refusal, explicit effective dates, required sample reasons, leave/return/termination and three linked offboarding tasks. |
| Corrections/history | Actual own proposal, accepted/rejected HR outcomes, direct edit, intervening accepted profile edit and stale refusal; visible literal history sequence rows 2, 6 and 7. |
| CMS release | Two independently approved entries, saved preparation without publication, stale approval refusal, valid atomic publication, no replay, identity-induced out-of-date confirmation and strict malformed-route import refusal. |
| CRM ownership | Owner and manager lead assignments; seven-record actual account graph including a converted lead, closed opportunity and completed task; excluded name-only lead, historical activity preservation, stale/no-op refusals and old/new representative scopes. The focused model's separate eight-record fixture remains distinct. |
| Recovery | Refresh, legacy/new individual imports, module-only selected combined restore and Undo for all changed domains; complete new optional records and unchecked bytes preserved. |
| Large text and controls | Actual Extra large preference and computed 20 px root text at 390 × 844 in all four lanes; 129 retained-control box measurements, 20 caller-literal input-value probes and 22 Tab-reachability probes. |
| Accessible names | 22 strict semantic accessible-name audits; no unresolved visible ambiguity. |
| New status meanings | Separate finite inventory: 46 expected, 46 observed, zero missing; each has a scoped real-text monochrome witness and uncovered sample points. This is separate from the historical legacy/native and SDK inventories, not a unique global status total. |
| Corrected history layout | Refusal paragraph now x = 46 px, width = 298 px, height = 50 px; all sampled text points are uncovered. Seven headers/rows retain their values and horizontal scroll reaches the final Origin column. |
| Resource ownership | Owned loopback preview PID 2832, child exit 0, browser/server cleanup both true; user tabs/listeners are outside the runner. |

Evidence manifest `portal-lifecycle-manifest.json` SHA-256:
`05a50a9844067db6ca5f77c0226ded9ae2c7aef6d780b4c2d6c485349e3da8f9`.
Agent 0 independently verified exact fingerprints for **100 runtime sources,
ten harness sources and 178 artifacts**. Generated Vite dependency caches and
the self-referential report/manifest are explicitly excluded. Before/after
runtime equality is recorded; both isolated and primary sources match the
final freeze. Final visual review is recorded separately before acceptance.

Earlier diagnostic runs remain retained. `UZm2d6` passed 17 functional checks
before the final quality/new-hire additions and before the layout correction;
it is not relabeled as final source acceptance. `FXpynX` records the concrete
off-screen refusal. Harness corrections preserve strict console/network/error
checks, replace an incorrect native-option enabled expectation with actual
disabled attribute/property checks, use the actual accessible textbox name,
and require caller-supplied literal form values instead of self-derived values.

## Publication gate progress

`npm run deploy -- hosting --preflight` passed on the integrated final-runtime
working tree: typecheck, lint, production build and LAN isolation. Version
remains 3.4.0 and deployment count 0; push/deploy were skipped. The earlier
preflight before the layout correction remains a separate diagnostic record.
Full configured CI, final documentation/preservation checks, catalog acceptance
and GitHub/wiki publication remain pending.

## Evidence limits

All records, identities, reasons, dates, receipts and amounts are fictional.
Local browser storage and complete backups are readable by their user and do
not provide authenticated field or tenant isolation. The selected SDK mock is
a separate session; this wave extends the native account-free portal state.

No provider account, credentials, real recruiting communication, payroll,
funding, tax/legal acceptance, asset/access change or production deployment is
established. Local automated checks do not establish native Windows runtime,
manual screen-reader acceptance or accessibility conformance certification.
