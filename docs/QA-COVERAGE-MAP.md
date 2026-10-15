# Portal QA coverage map

This map addresses **WX-0700**: “Map onboarding, payroll, CMS publishing, CRM
conversion and recovery invariants to existing unit evidence and new browser
acceptance scenarios.” Its named-seed prerequisite is **WX-0651**. Proposal
status belongs in the [canonical catalog](backlog/webappx-1000-todo.json), not in
this document.

## Current safety coverage

The safety wave starts above published source
`532cc4ad63d18a4fe911b0a9b18e258b85ef3416`. Its
[QA receipt](PORTAL-SAFETY-QA-2026-10-15.md) owns actual execution and acceptance.
The model gate is `safety:test`; real browser companions are `browser:safety`,
`browser:quality` and `browser:recovery-drill`.

| Original scope | Independent assertions and browser boundary |
| --- | --- |
| Dirty navigation / restored CMS editor | Native controls exercise protected HR/CMS/CRM groups, Keep/Discard/retained drafts, history and hidden owner focus. Full exports/raw slots distinguish temporary buffers from saved records. Equal-revision restored CMS comparisons require explicit Reload/Reapply; ordinary Save alone writes editorial records. |
| Optional import/Reset recovery | Literal storage fixtures check order, exact rollback and refusal before writes for stale settings/history/source/target confirmations. Actual second-page setting changes exercise stale previews, with independent opt-in persistence and checkpoint-failure browser evidence. |
| CMS/CRM replacement metadata | Literal current/target metadata and reverse Undo differences remain bounded without displaying free text; whole-module complete export comparisons verify the actual replacement. |
| Accessible names / monochrome / x-large | Actual Chromium accessible names include hidden mounted portals. Finite source enums constrain the separately labeled valid rendering fixtures. Product status labels are scoped independently from fixture names/titles. Native 390px x-large controls and import/selective restore/Undo confirmations retain visible labels/values and keyboard reachability. |
| Failure and rescue | Explicit malformed imports and controlled storage faults compare complete memory/slot/history outcomes. An uncertain restore is exported before any reload and recovered selectively; all three portals are checked independently. Clearing damaged history discards it without a repair claim. |
| Owned preview process / import preservation | Real fork tests verify PID-bound loopback readiness and exact-process cleanup through success, failure and cleanup interruption while preserving another listener. Real importer applies use populated fictional temporary records and immutable retained releases, with qualified fingerprints and no live adopted target. |

The [status inventory](PORTAL-STATUS-INVENTORY.md) and
[recovery runbook](PORTAL-RECOVERY-FAILURE-DRILL.md) provide the detailed
source/fixture boundaries. Historical rows below retain their original receipt
scope; current execution requires the safety receipt's explicit rerun entry.

The previous portal-maturity wave starts from WebAppX `main`
`950f9ba0c4e48faaa65056f504f105201838e3ec`. That revision is the starting source
base, not the final changed browser build. Its focused results and the
sixteen original criteria are recorded in the
[portal-maturity receipt](PORTAL-MATURITY-QA-2026-10-15.md). Integrated publishing
gates passed: all 56 stages, 111 browser checks/check groups and Hosting preflight, as recorded in that receipt.

The earlier operational-foundations wave started at
`f197affabfe125321c439d8a50854abe684c2355`; its
[receipt](OPERATIONAL-FOUNDATIONS-QA-2026-10-15.md) is historical evidence with its
own source basis and accepted scope. Earlier receipts below retain their
original dates and source bases. Reading this map or reusing a receipt does not
rerun a scenario or accept its proposal.

## Seed, assertions and evidence method

The browser journeys use the reviewed
[`webappx-portal-smoke-v1` fixture](../tests/browser/fixtures/portal-smoke-v1.json)
and its [recorded digest](../tests/browser/fixtures/portal-smoke-v1.sha256):

```text
ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02
```

[`seed-contract.mjs`](../tests/browser/seed-contract.mjs) checks the exact bytes,
schema, fixed timestamp, all three domain graphs, canonical defaults and recorded
dashboard totals before the browser journey. A run does not regenerate the seed
or digest. Expected mutations are handwritten changes to a detached copy of that
seed; application reducers do not calculate the expected result.

Model tests call domain transitions and persistence helpers directly. Browser
scenarios use rendered controls, reloads and real downloads; DOM, exported JSON
and browser saves are read as evidence. A hidden or disabled control establishes
its UI behavior; direct-call role and workflow refusal remains a separate model
assertion. Neither fixture identities nor UI restrictions authenticate a user.

The earlier CRM lifecycle scenario also has an explicit **browser-module negative probe**:
it loads the actual Vite-served CRM module and attempts conversion on a detached
copy of the already-converted UI export. This checks the module's replay guard
inside Chromium, without inventing a second rendered form submission. It must
leave that input and actual browser save bytes unchanged; later UI exports must
still match the independent expected records. The module is not used to construct
expected records or to mutate app state.

The owned browser runner selects a free loopback port, uses strict binding,
isolated browser contexts and a separate temporary Vite cache. Its traffic rules
reject unexpected provider/backend/external requests and WebSockets. Reports,
downloads, screenshots and traces stay in local artifact directories. Browser
installation is explicit; a missing browser is a setup failure, not a skipped
acceptance result. See [the browser-runner contract](DEVELOPER-BROWSER-QA-2026-10-14.md#repeatable-account-free-browser-smoke).

## Current portal-maturity coverage

The [maturity browser source](../tests/browser/portal-maturity.mjs) covers all
sixteen criteria below in **13 actual browser check groups**, using four fresh
owned contexts and real controls/downloads. Its handwritten payroll arithmetic,
record mutations, collection counts and directional differences do not call
application models to construct expected outcomes. The only navigation probe
uses History/popstate to exercise an unsupported route; it changes no model or
saved data. CRM corruption fixtures derive from real downloads and pass through
the rendered file inputs.

| Catalog criteria | Model or source coverage | Current browser acceptance and independent expected observation |
| --- | --- | --- |
| **WX-0056**: retain the last supported portal subsection in this session | [Return-location tests](../tests/portals/return-location.test.mjs) | Real directory, card and navigation links return to `/hr/demo/employee/time`. A labeled unsupported-route probe cannot replace that remembered supported path. No durable navigation key is added. |
| **WX-0151–WX-0155**: chosen periods, configured rates, immutable history, stale inputs and eligibility reasons | [Periods/rates](../tests/hr/payroll-periods-rates.test.mjs), [selected-period statements](../tests/hr/selected-payroll-insights.test.mjs) | Explicit October 1–15 selection includes approved unpaid in-period time and explains excluded draft/out-of-period time and missing rates. Avery's 7.5 hours at $25 plus Morgan's 2 hours at $40 yield $267.50 gross. Newly approved Avery time of 1.25 hours makes preparation stale; intentional reprepare yields **10.75 hours / $298.75 gross / $59.75 illustrative withholding / $239 net**, with no benefit deduction. A future November 1 $35 rate preserves the complete submitted receipt and its displayed frozen rates. |
| **WX-0156–WX-0158**: return time with reasons; edit and delete unpaid drafts safely | [Time editing tests](../tests/hr/time-editing.test.mjs) | A scoped manager returns Avery's submitted seed time with a reason; the owner corrects it to 7.5 hours, resubmits and obtains approval. Paid rows expose no edit/delete controls. Canceling deletion preserves exact saves; confirming deletion removes only the draft and preserves the complete paid history after reload. |
| **WX-0280 / WX-0282**: field-error summaries and dirty-editor decisions | [CMS tests](../tests/portals/cms.test.mjs) | Both create/edit forms list all three literal title/slug/body errors and focus the first invalid control without saving. Keep editing retains the temporary buffer; discard switches entries. A successful save becomes a clean baseline. Complete CMS/HR/CRM exports remain the independent preservation check. |
| **WX-0397**: strict CRM import enums, unsupported notes and relationship edges | [CRM import validation](../tests/portals/crm-import-validation.test.mjs) | **Nine individual CRM file uploads** refuse malformed enum types/values, unsupported and oversized notes, or broken edges. Every refusal preserves all saved bytes; intervening and final real exports retain the complete UI-created sentinel graph. Combined-file refusal is separate model coverage, not an additional browser claim. |
| **WX-0453 / WX-0454**: labels and named manual captures | [Manual restore-point tests](../tests/portals/manual-restore-points.test.mjs), [Undo binding tests](../tests/portals/undo-preview-binding.test.mjs) | Rename changes only an automatic point's label, preserving ID/time/kind/scope/payload/history order. Manual HR+CMS and all-module captures change history alone; existing workspace-save bytes and complete exported records stay unchanged. Labels allow 1–100 single-line characters; retention remains up to five points within 2,000,000 serialized characters. |
| **WX-0457 / WX-0458**: complete bounded inspection and directional differences | [Inspection/difference tests](../tests/portals/workspace-inspection.test.mjs) | Literal captured primary totals are **HR 35 / CMS 2 / CRM 27**; eleven CRM lead records display eight IDs and exactly three omissions. Every collection row, including nested/metadata zeros, is checked without exposing free text. Restoring the captured target adds one HR record, removes one/changes one CMS record, and removes two CRM records. Undo reversal checks the inverse counts and full recovered payloads; opening details/previews writes nothing. |

Focused results in the current receipt:

- **79 new maturity model cases passed** through `npm run maturity:test`.
- **13 maturity browser check groups passed** through `npm run browser:maturity`;
  owned browser/server cleanup flags were true.
- The updated `browser:state-contract` passed **13 checks**. The updated
  `browser:foundation` passed **10 checks with 71 focus observations**. Their
  complete payload/raw-save assertions remain in place; session return now
  retains the supported HR subsection intentionally.
- The existing `browser:payroll` journey passed **eight checks** after explicit
  period/rate setup. Its independent two-employee totals remain **$401 net**,
  as specified below. The model and browser results overlap in scope; they are
  not summed into a unique scenario or production-acceptance count.

These are focused local results. The current integrated `ci:all` and publishing
gate outcome belongs in the portal-maturity receipt; the earlier operational
receipt does not establish a pass for this changed wave.

## Invariant-to-scenario map

The scenario IDs below are navigation labels within this map. They do not create
another task ledger. The lifecycle scenarios below were introduced by earlier
waves. Their dated receipts are historical unless the current maturity receipt
explicitly records a rerun; source presence alone does not establish execution.

| Domain invariant | Existing unit assertions | Authored browser acceptance scenario and expected observation | Execution evidence |
| --- | --- | --- | --- |
| **Onboarding: required review and explicit confirmation** | [HR workflow tests](../tests/hr/mock-workflows.test.mjs): `onboarding requires profile, job and checklist review then confirmation, and updates shared directory status` refuses premature review/completion and foreign-subject changes; successful confirmation changes only the permitted employee and rejects replay. | **QA-ONB-01**, [keyboard onboarding](../tests/browser/keyboard-onboarding.mjs): reject an empty required email without a domain save; save Avery's fictional email; review profile, job, required policy task and summary; confirm with Enter/Space. Summary and confirmation stay disabled until their prerequisites. Completion focuses the named receipt status. | Existing authored scenario: `browser:keyboard`; [2026-10-15 keyboard receipt](KEYBOARD-PORTALS-QA-2026-10-15.md#accepted-browser-results). |
| **Onboarding: persisted complete records and invalidated pending review** | Same HR suite: `a changed pending profile invalidates onboarding review, while unchanged and post-hire contact saves preserve acceptance` checks exact review flags, employment status, retained tasks and denied identities. [HR persistence tests](../tests/hr/persistence.test.mjs) check the complete nested workspace. | **QA-ONB-02**, keyboard onboarding: reload after completion; compare the entire HR envelope and real combined download with `expectedKeyboardOnboarding`, preserving CMS/CRM and the accessibility preference. The separate pending-profile-edit invalidation journey has historical browser evidence; the keyboard journey does not claim to repeat that edit-after-review case. | Existing authored persistence scenario: `browser:keyboard`. Pending-review invalidation: [2026-10-14 core-flow receipt](GUSTO-BROWSER-QA-2026-10-14.md#browser-results-after-repair), historical source base below. |
| **Payroll: eligible time, frozen preparation and separate fictional deductions** | [HR workflow tests](../tests/hr/mock-workflows.test.mjs): `payroll freezes approved time and elections, calculates separate fictional deductions and blocks receipt replay`; `payroll caps each employee benefit to their own pay and freezes reconciled statement totals`. The historically titled `payroll excludes inactive/onboarding employees and approved dates outside the fixed sample period` now supplies the chosen period explicitly; its title does not describe a current global fixed-period requirement. Direct calls cover denied roles, wrong stages and input exclusion. | **QA-PAY-01**, [payroll lifecycle](../tests/browser/payroll-lifecycle.mjs): complete Jordan's onboarding, confirm Avery's health enrollment and Jordan's retirement waiver, add and submit time, approve as manager, then deliberately choose **2026-10-01–2026-10-15** and configure **Avery/Jordan at $30 per fictional hour, effective October 1**, before prepare/calculate/review/simulate submission as owner. Compare both employees' frozen period/rate inputs, statements and aggregate amounts with handwritten expected records. Later input changes make unfinished preparation stale and require intentional reprepare; benefit caps and outside-period/onboarding refusals remain direct-call coverage unless separately exercised. | Current explicit-input rerun: eight checks in the portal-maturity receipt. The original WX-0673 execution belongs to the historical operational-foundations receipt; older equivalent observations remain in the core-flow and persistence receipts. |
| **Payroll: consumed time and receipt replay** | The same freeze/replay test requires one historical receipt, links each paid entry to it, refuses submission replay and refuses a new preparation without eligible approved time. Ownership/time tests separately cover self/foreign-team approval denials. | **QA-PAY-02**, the current explicit-period/rate payroll lifecycle: verify UI gating before the required workflow stages and after simulated submission, then attempt the supported post-submission preparation action. No duplicate history, consumed hours or record changes may result from a refusal. Reload and actual combined export must preserve the complete expected HR records and unchanged CMS/CRM. Model-only direct-call denials are not relabeled as browser observations. | Current eight-check explicit-input rerun: portal-maturity receipt. The original authored run is retained in the historical operational-foundations receipt. |
| **CMS: separate review and exact-revision publication** | [CMS tests](../tests/portals/cms.test.mjs): `review and publishing roles enforce direct-call permissions and separate reviewer identity`; `draft review and publication require the correct stage and reject replay`; `editing approved content invalidates approval and stale revision actions are refused`. | **QA-CMS-01**, [CMS/CRM lifecycles](../tests/browser/cms-crm-lifecycles.mjs): save an article revision as author, request review, approve as the separate reviewer and publish as publisher. Named role/stage controls and the published projection must agree with the exact saved revision; a later saved edit clears approval and requires fresh review. | Historical WX-0677 execution: results in the operational-foundations receipt. Historical review/publication/refresh observations are recorded in the persistence receipt. |
| **CMS: publication frozen beside a later draft** | Same CMS suite: `published snapshot stays frozen while a later draft changes until separately approved and republished`; [backup tests](../tests/portals/backup.test.mjs): `CMS backup preserves its newer draft, frozen publication, revision and activity receipts`. | **QA-CMS-02**, CMS lifecycle: edit after publication, reload and download the full workspace. The newer draft and cleared approval must coexist with the prior published title/body/revision/receipt until a separately approved publication replaces that snapshot. Compare complete records and unchanged HR/CRM, not only dashboard counts. | Historical lifecycle observation is recorded in the operational-foundations receipt. Existing `browser:state-contract` checks retention/export of a frozen seed publication; it does not publish a new article. |
| **CRM: qualification and atomic linked conversion exactly once** | [CRM tests](../tests/portals/crm.test.mjs): `lead conversion is atomic, linked, exactly once and immediately reflected in the dashboard`; `conversion reuses an existing same-owner company without creating duplicate account records`; `invalid monetary amounts cannot create or convert opportunities and leave no partial records`. | **QA-CRM-01**, CMS/CRM lifecycles: create and qualify a fictional lead, convert it through the owner UI, and inspect its company/contact/opportunity links in an actual download. The new graph, ownership, receipt sequence and dashboard totals must equal handwritten expected records. After conversion the card removes its conversion form; reload must retain one conversion and exact links. The explicit browser-module negative probe separately attempts replay on a detached copy of that converted export, expects refusal, and checks input/app-save/export preservation. It is not a second UI form submission. | Historical WX-0678 execution: the ordinary UI journey and separately labeled browser-module probe were accepted in the operational-foundations receipt; that recorded result does not rerun them at this checkout. Historical conversion/pipeline/refresh observations remain separate. |
| **CRM: linked follow-up workflow and dashboard totals** | Same CRM suite: `follow-ups inherit opportunity ownership, update the inbox and complete once`; `representatives cannot mutate foreign records or create records with mismatched links`; `pipeline follows valid stages, won value leaves open pipeline, and terminal transitions cannot replay`. | **QA-CRM-02**, CRM lifecycle: create and complete a follow-up linked to the new opportunity, check its inherited owner and exact activity, then compare active leads, open pipeline and follow-up totals. The authored journey uses owner controls; foreign-link/forged-identity refusals and later pipeline-stage transitions remain model coverage. Full exports remain role-agnostic fictional backups, not a scoped production export policy. | Historical lifecycle observation is recorded in the operational-foundations receipt. The earlier persistence receipt includes a worked conversion through proposal/negotiation to won; retain its historical scope. |
| **Recovery: validate the entire file and replace only selected complete workspaces** | [Combined backup tests](../tests/portals/combined-backup.test.mjs): `a corrupt module rejects the entire file even when a caller intends to restore a different portal`, plus round-trip/format/size/codec isolation. [Restore tests](../tests/portals/restore-workspaces.test.mjs): `selective restore writes exactly one selected portal and preserves unselected raw saves and unrelated keys`; `all three graphs are validated even when only one valid portal is selected`, plus invalid selection/read/serialization refusal. | **QA-REC-01**, [keyboard restore](../tests/browser/keyboard-restore.mjs): import a deliberately different three-portal file, cancel without changing any bytes, then select only HR/CMS. The real combined download must equal selected replacements plus original CRM. **QA-REC-02**, [state contract](../tests/browser/portal-state-contract.mjs): select CMS, CRM and HR separately; selected roots clear temporary UI except the current CMS dirty-editor comparison; unchecked portal saves and retained UI stay exact. | Existing `browser:keyboard` and `browser:state-contract`; keyboard and session/contracts receipts below. Earlier combined-backup receipt supplies historical invalid-file browser cases. |
| **Recovery: recoverable checkpoints, Undo, retention and failure scope** | [Restore-point tests](../tests/portals/restore-points.test.mjs): `a checkpoint is a detached selected-only snapshot and persists before portal writes`; `undo of undo restores the pre-undo state and retains a new recovery point`; `rollback uncertainty names history and the affected portal without claiming preservation`, plus retention/history-only clear. [Budget tests](../tests/portals/restore-budget.test.mjs): `preview is repeatable and neither touches browser storage nor mutates states, history or selections`; `real storage write failures remain authoritative after a successful preview and restore old raw saves`. | **QA-REC-03**, keyboard restore: cancel Undo, confirm Undo, capture a reversible point, prune the oldest opener at five points and focus the history heading, then reload and compare complete exports/raw saves. **QA-REC-04**, state contract: Reset preserves history/downloads; explicit clear changes only history; denied storage retains accepted records in memory for export and loses them on refresh. | Existing authored scenarios, scoped by their receipts. Partial-write/quota/rollback failure injections remain model-fixture evidence; denied-storage browser fixture replaces the storage getter deliberately and does not certify an OS privacy-setting workflow. |

## Handwritten expected observables

Expected-state helpers are part of the browser test source and are reviewed with
the scenario. A pass must compare records as well as rendered status/totals.

| Scenario | Independently stated expected result |
| --- | --- |
| QA-ONB-01/02 | `expectedKeyboardOnboarding` changes Avery (`employee-002`) to work email `avery.keyboard@fixture.invalid`, completed profile/job/tasks and onboarding stage, receipt `MOCK-ONBOARDING-0001`, active employment and workflow sequence 2. Other records remain the reviewed seed. The HR slot is the only new domain save. |
| QA-PAY-01/02 | `payrollExpectation` and `expectedPayrollWorkspaces` state the full records independently. Avery's `time-001` (8 hours) plus `MOCK-TIME-0003` (1.25) total 9.25; Jordan's `time-002` (6) plus `MOCK-TIME-0005` (2.5) total 8.5. With an explicitly chosen **2026-10-01–2026-10-15** period and separately configured **3,000 fictional cents/hour for Avery and Jordan, effective 2026-10-01**, Avery's gross/illustrative withholding/benefit/net are **27,750 / 5,550 / 2,500 / 19,700 cents**; Jordan's are **25,500 / 5,100 / 0 / 20,400 cents**. Aggregate **17.75 hours**, **53,250 gross**, **10,650 withholding**, **2,500 benefits**, **40,100 net cents** must reconcile. One `MOCK-PAYROLL-0006` receipt consumes the four approved rows, leaving workflow sequence **7**; each employee's statement retains only their own exact frozen inputs. Repeated preparation must refuse all-consumed inputs while preserving the complete receipt/history. The current eight-check rerun is recorded in the portal-maturity receipt; the original result remains in the historical operational-foundations receipt. |
| QA-CMS-01/02 | Article revision 1 becomes revision **2** on edit (`MOCK-CMS-0001`), then review request **0002**, separate reviewer approval **0003** and publisher publication **0004**. A later author edit creates revision **3** (`MOCK-CMS-0005`), clears approval and leaves the complete published revision-2 snapshot unchanged. Metrics in order **drafts / in review / approved / published** are **1/0/0/1 → 0/1/0/1 → 0/0/1/1 → 0/0/0/2 → 1/0/0/2**. Full exports/envelopes retain the default CMS page and exact HR/CRM seed records. Original execution results are retained in the historical operational-foundations receipt. |
| QA-CRM-01/02 | New `lead-0001` is created, qualified and converted for **175,025 cents** with `MOCK-CRM-0001` through **0003**. Conversion creates linked `company-0003`, `contact-0003` and `opportunity-0003`; task `task-0004` is created/completed with receipts **0004/0005**, leaving sequence **6**. Owner active leads start **2**, rise to **3**, then return to **2**; open pipeline rises from **650,000** to **825,025 cents**, won remains **0**, and open follow-ups move **1 → 2 → 1**. The converted UI has no conversion form. A separate browser-module call on a detached converted export must throw `Qualify the sample lead before conversion; a converted lead cannot be converted again.` and preserve both its input and actual app save bytes. Original execution results are retained in the historical operational-foundations receipt. |
| QA-REC-01/03 | Keyboard fixtures define full imported HR/CMS/CRM states; selected HR/CMS replacement preserves exact CRM raw bytes. A recovery point contains only prior selected workspaces; Undo adds a reversible selected-only point. Retention holds at five points and refresh preserves every retained point and raw save byte. |
| QA-REC-02/04 | State-contract exports distinguish saved HR draft time, CMS draft/publication and CRM contact records from unsaved UI/timers/history. Selected-only restores remount only their roots; the current CMS dirty editor survives for explicit comparison. Reset removes its workspace save while preserving history; clearing history removes only `webappx.demo.restore-points`. Denied-storage exports contain accepted in-memory records; a subsequent refresh opens the fictional seed. |

## Commands and acceptance receipts

Run from the repository root. Browser commands require the relevant
dependency/runtime setup and explicit `npm run browser:install`. Model and
browser gates create local test artifacts or owned processes; their side effects
are described by the [CI plan](COMMANDS.md#repository-gates). Native fictional
workflows require no provider account. The plan command itself only inspects
source and prints its report.

| Command | Coverage |
| --- | --- |
| `npm run hr:test` | Direct HR workflow, ownership/projection, persistence and optional adapter-source tests; no live payroll execution. |
| `npm run portals:test` | CMS/CRM transitions plus storage, codecs, replacement, checkpoint, manual history, inspection and budget fixtures. |
| `npm run maturity:test` | Current 79-case model gate for the sixteen maturity criteria: payroll/time/statements, strict CRM import, labels/manual capture, return navigation, inspection/differences and Undo binding. CMS field/dirty-buffer cases also run in `portals:test`. |
| `npm run browser:maturity` | Current 13 real browser check groups across four fresh contexts; all sixteen criteria are mapped above. |
| `npm run browser:smoke` | Existing fresh-seed export, HR goal, CMS draft and CRM lead, reload/full-export isolation. It does not run payroll, publish a new CMS revision or convert a lead. |
| `npm run browser:keyboard` | QA-ONB-01/02 and QA-REC-01/03, including real Tab/Enter/Space and focus assertions. |
| `npm run browser:state-contract` | QA-REC-02/04 plus saved/transient record, navigation and export boundaries; current updated run: 13 checks in the maturity receipt. |
| `npm run browser:foundation` | Current 10-check navigation/focus regression with 71 observations, recorded in the maturity receipt. |
| `npm run browser:payroll` | QA-PAY-01/02 through [the payroll runner](../scripts/browser-payroll.mjs), with explicit October 1–15 period and configured $30/hour Avery/Jordan rates. Current rerun: eight checks in the maturity receipt. |
| `npm run browser:lifecycles` | QA-CMS-01/02 and QA-CRM-01/02 through [the CMS/CRM runner](../scripts/browser-lifecycles.mjs). |
| `npm run ci:plan` | Inspect the actual integrated CI stages and reviewed effects. It runs no stage and proves no result. |
| `npm run ci:all` | Required integrated release gate; its final outcome belongs in the current wave receipt. |

## Historical receipt contexts

The following earlier receipts retain their original evidence contexts. They
are historical records, not current-wave rerun reports. A recorded “starting
base” does not identify an exact final browser bundle; use the receipt's own
qualification rather than silently promoting it to an examined-source result.

| Receipt | Original date and recorded source basis | Scope retained here |
| --- | --- | --- |
| [Core HR flow](GUSTO-BROWSER-QA-2026-10-14.md) | 2026-10-14; published baseline `bc86ae97f4f32667cf1e5be7d311b2f9133b4641` with described host fixes | Local native onboarding invalidation, time identity, payroll preparation freeze/submission/duplicate exclusion and auditor UI. No provider financial action. |
| [Portal persistence](PORTAL-PERSISTENCE-QA-2026-10-14.md) | 2026-10-14; source baseline `e6418cd1d22fa9ed5bca0ed44b8d984d8c29a56a` | Real UI actions/refresh for onboarding, payroll, separate CMS review/publication and frozen drafts, CRM conversion/pipeline, portal Reset isolation. Storage faults were model doubles. |
| [Combined backup](COMBINED-BACKUP-QA-2026-10-14.md) | 2026-10-14; starting base `955e4eda748a06810504dd4052889713ce4f2a24` | Real downloads, selected replacement/cancellation, cross-origin restore and invalid-file refusals. Quota/rollback fault injection remained model-only. |
| [Restore points](RESTORE-POINTS-QA-2026-10-14.md) | Browser work 2026-10-14 America/Los_Angeles / 2026-10-15 UTC; starting base `38d31a3e312f11050f5b6175aec3145afeb3c5a8` | Local selective checkpoints, Undo, reload, five-point retention and exact complete payloads; controlled rollback faults remain separate. |
| [Developer browser smoke](DEVELOPER-BROWSER-QA-2026-10-14.md) | 2026-10-14; starting base `4731702ec7bfdcaec60ac4d42e23b03f330f5d74` | Named seed/hash, independently expected goal/draft/lead records, complete exports and owned runner/context isolation. |
| [Keyboard portals](KEYBOARD-PORTALS-QA-2026-10-15.md) | 2026-10-15; starting base `cae18da251b0a9c4418a4fbebf2bd514ccd2dcdd` | Authored onboarding and selective recovery keyboard journeys, exact saves/exports and visible-focus observations. OS chooser keyboard operation and whole-site accessibility remain outside scope. |
| [Session and state contracts](SESSION-CONTRACTS-QA-2026-10-15.md) | 2026-10-15; starting base `4ca558015a66c4f7b9f50eb085f98ab62c1c8335` | Eleven authored native state-contract checks, selected-root remounts, Reset/history distinction and deliberately denied-storage export. Session fixtures are synthetic, not real emulator workflows. |
| [Operational foundations](OPERATIONAL-FOUNDATIONS-QA-2026-10-15.md) | Historical 2026-10-15 wave; starting base `f197affabfe125321c439d8a50854abe684c2355`; original focused and integrated outcomes remain in that receipt | Introduction of payroll/CMS/CRM lifecycle commands, actual original results, source context, artifacts, independent review and release gates. Its fixed-rate/period setup and original browser counts are not current maturity behavior or results. |

## Remaining evidence boundaries

This map covers native account-free fictional workspaces. Preview identities and
complete readable backup exports follow the
[capability contract](PORTAL-CAPABILITIES.md); retained records, failed-save memory
and excluded temporary UI follow the [state contract](PORTAL-STATE-CONTRACT.md).
The separate SDK session is outside these native exports and recovery points.

Model passes do not establish browser behavior. Local Chromium observations do
not establish Windows x64/ARM64, another browser engine, screen-reader or
whole-site accessibility acceptance. Neither local layer establishes deployed
Firebase rules, confidential tenant isolation, trusted exports, live provider
access, real publication/messages, payroll execution or production deployment.
Unrun cases stay unrun; unavailable prerequisites and failed results must remain
visible in the receipt.

Use [the evidence index](BACKLOG-EVIDENCE.md) when attaching reviewed receipts.
Retain each observation's date, revision basis and limitations; an attachment
does not change proposal status or satisfy an unresolved prerequisite.
