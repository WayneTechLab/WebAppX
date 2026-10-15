# HR lifecycle, CMS releases and CRM ownership verification — 2026-10-15

Status: **local integration verified; Agent 0 acceptance recorded for eighteen criteria**.
This receipt follows the published
[safety checkpoint](PORTAL-SAFETY-QA-2026-10-15.md). Agent 0 recorded
acceptance after the current browser evidence, independent review and
integration requirements completed. The active goal covers all 1,000
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

| Criterion | Accepted implemented contract |
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
The configured 62-stage integration gate subsequently passed on committed
source `fdf60124e49659e9c33d30db59e45ff8369a38e1`. The acceptance below concerns
the sixteen implementation criteria and two independently reviewed recovery
criteria; it does not accept the remaining backlog.

## Additional recovery criteria accepted from current regression evidence

Two original local criteria have complete existing implementation and focused
regressions. Their mandatory browser journeys passed in the current full CI.
Agent 0 reviewed their original acceptance statements and the distinct evidence
boundaries below before accepting them alongside the sixteen new criteria.

| ID | Original acceptance | Evidence boundary |
| --- | --- | --- |
| WX-0467 | History distinguishes combined import, Undo, optional individual import, optional Reset and manual capture without inferring provider events. | Strict five-kind model cases, actual native history labels and explicit valid synthetic rendering of all five reasons; separate ordinary control journeys verify manual, combined, Undo, import and Reset captures. The rendering fixture is not relabeled as five performed user actions. |
| WX-0487 | A controlled browser harness simulates unavailable storage and verifies visible refusal of destructive restore without changing the active workspace. | Isolated native denied-history import/Reset journeys retain exact exports and saved bytes; the actual combined-restore fault drill verifies visible refusal and complete same-document live-memory rescue before reload. Partial rollback deliberately leaves uncertain saved slots, so this establishes preserved active memory without claiming every disk slot is unchanged. |

WX-0717 remains TODO because its canonical dependency WX-0708 remains TODO.
Its exact-opener keyboard evidence does not supply the missing complete
scope/effect/cancel observations for every destructive preview, particularly
history-clear cancellation. No dependency or original definition is bypassed.

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
final freeze. Independent review rehashed all 288 declared entries and inspected
all 46 individual status PNGs at original size with no remaining finding. Tall
context captures include sticky chrome and partially visible horizontal tables;
the bounded uncovered witnesses establish readable status meanings, rather than
a claim that every pixel of each tall context capture is unobscured.

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
Full configured CI passed on the committed source identified below. Final
documentation/preservation checks and GitHub/wiki publication are recorded
separately; this receipt does not claim production deployment.

The first 62-stage attempt stopped at stage 44, the keyboard suite. The retained
`webappx-browser-keyboard-KLZYym` report identifies the new date input's native
calendar-control Tab stop. The active outer input did not match
`:focus-visible`; read-only AX/closed-user-agent-shadow inspection in `DhUaw2`
identified the actual focused calendar button, which did match and drew a
2 px solid blue outline. The corrected strict driver observes that actual
native part only after matching the active host, the sole focused AX node,
known native part and user-agent-shadow ancestry. It retains the original
enabled/visible/focus-visible/ring/geometry requirements; unknown or mismatched
native parts fail. Twenty-seven driver cases include fifteen native negative
cases. The targeted `keyboard-izrTmz` run passed nine checks/groups, with 133
onboarding and 330 restore focus observations and successful owned cleanup.

Older keyboard and quality complete-record fixtures now contain handwritten
expected legacy instances, nullable dates and the newly saved profile history.
Their assertions still compare complete independent records. The targeted
`quality-7D7fEJ` run passed six checks/groups, observing all 151 expected legacy
status meanings (157 observations), at the actual 390 px/20 px setting. Forty-one
focused quality/lifecycle cases also passed. These harness-only changes are
committed at `fdf60124e49659e9c33d30db59e45ff8369a38e1`; all 100 application
sources remain equal to the final runtime freeze. The failed first run remains
retained and is not counted as a passing execution.

## Current committed-source lifecycle receipt

The lifecycle stage in the successful full integration run is
`webappx-browser-portal-lifecycle-fqj91B`: **20 passed checks/groups**, all
**46/46** new status meanings, successful browser/server cleanup, owned preview
PID 59559 exited with code 0. Its manifest SHA-256 is
`51facdb8e4b0e64f40285ea9cb9c5532021785a62326e20a81b403592992a3fb`;
report SHA-256 is
`585c9f1a3d10c9013f84f616d9d8dc75658de301f7228d5464c3a30ddfa3ea63`.
Independent review rehashed all **100 current runtime sources, ten current
harness sources and 178 declared evidence artifacts**, with zero mismatches
and complete filename sets outside derived Vite caches.

Relative to the standalone `izeHOX` receipt, the runtime is byte-identical.
The only harness difference is the handwritten expected-record update inside
the legacy quality suite's `nativeJourney`; the audit/render helpers imported
by this lifecycle suite are unchanged. All 46 matching status PNGs are
byte-identical, so the completed individual visual review transfers without
relabeling the earlier execution. Current measurements confirm every witness
is inside the 390 px viewport with three uncovered samples and maximum height
205.5 px. The new receipt binds these observations to the committed harness.

## Full configured integration and checklist result

`npm run ci:all` completed with terminal **exit 0** on
`fdf60124e49659e9c33d30db59e45ff8369a38e1`. Independent review matched all
**62 configured stages**, once each and in order, through the final successful
build and LAN production-isolation check. The retained log SHA-256 is
`fb222f46498681db59924ba0bcf0a87035a71714d44381d63b195101da3edbb6`.
All 23 recorded Node failure summaries are zero; root and backend dependency
audits found zero vulnerabilities. The build retains its visible large-chunk
advisory; it is not an execution failure or a claim of optimized bundle size.

| Current full-CI browser suite | Passed checks/groups | Retained report suffix |
| --- | ---: | --- |
| Smoke | 7 | `smoke-yMSLtZ` |
| Keyboard | 9 | `keyboard-yNct6c` |
| Foundation | 10 | `foundation-JOvPoB` |
| State contract | 13 | `state-contract-j7C2Ll` |
| CMS/CRM lifecycles | 12 | `lifecycles-ru866K` |
| HR/CMS/CRM portal lifecycle | 20 | `portal-lifecycle-fqj91B` |
| Payroll | 8 | `payroll-RMJoqr` |
| Evaluators | 25 | `evaluators-JAmETm` |
| Maturity | 13 | `maturity-6yvmxI` |
| Safety | 30 | `safety-EUiTST` |
| Quality | 6 | `quality-yUUJFH` |
| SDK quality | 5 | `sdk-quality-8xDWHq` |
| Recovery drill | 8 | `recovery-drill-kZ1tmy` |
| Common-runner subtotal | **166** | All thirteen reports passed. |
| HR-disabled adoption | **8** | Separate committed-allowlist receipt. |
| Owned LAN work status | **6** | Separate result with preserved source records. |
| Aggregate | **180** | Checks/groups, not unique assertions or status meanings. |

All thirteen common reports record browser/server cleanup true and owned child
exit 0 without a signal. The successful schemas usually omit their raw problems
ledger; no nonempty reported error/problem/cleanup-error field was found. The
SDK report explicitly records an empty problems list. The HR-disabled receipt
binds the committed source above, 105 copied public files and its manifest
`3399783fc63d6baf0e1a564516a89277f6e0f579174c24f7671ebdd8471a4e63`.
The LAN result records six descriptions, no page errors, four captures and
preserved source-record bytes. Those two embedded schemas do not expose the
common runner's child/cleanup fields; the thirteen-child audit is not extended
to them by inference.

Agent 0 accepted **WX-0101–WX-0110, WX-0314–WX-0316, WX-0379–WX-0381,
WX-0467 and WX-0487** after reviewing the unchanged original definitions and
dependencies. Only those eighteen status/completion objects changed; the prior
91 completion objects and all catalog definitions/root metadata remain exact.
Regenerated checklist, CSV and execution plan record **109 done / 891 TODO**.
Remaining priorities are **70 P1 / 665 P2 / 156 P3**; remaining gates are
**724 local / 127 operator / 40 provider**. The all-1,000 goal remains active.

Final local `sync:system:check`, `template:check`, `backlog:check`,
`backlog:plan:check` and `backlog:evidence:check` passed. Current guide freshness
is reviewed separately using a supported owned clone at the explicit committed
source plus byte-bound local documents: the primary app-managed checkout's
`worktreeconfig` layout is intentionally unsupported by the comparison tool.
No Git configuration or checker limit is changed to bypass that refusal. Old
receipt bytes and dates remain historical; the finite lifecycle mapping binds
this current receipt without relabeling earlier runs. GitHub source/wiki
publication is verified by direct remote parity separately from this local QA.

## Evidence limits

All records, identities, reasons, dates, receipts and amounts are fictional.
Local browser storage and complete backups are readable by their user and do
not provide authenticated field or tenant isolation. The selected SDK mock is
a separate session; this wave extends the native account-free portal state.

No provider account, credentials, real recruiting communication, payroll,
funding, tax/legal acceptance, asset/access change or production deployment is
established. Local automated checks do not establish native Windows runtime,
manual screen-reader acceptance or accessibility conformance certification.
