# Portal maturity implementation and QA — 2026-10-15

This implementation starts at published WebAppX main
`950f9ba0c4e48faaa65056f504f105201838e3ec`. It is the starting source base,
not a claim that the changed application already existed in that commit.
Local execution: macOS Apple Silicon, Node 25.8.1, npm 11.11.0, Python 3.14.5.
Original catalog criteria and dependencies remain unchanged.

## Sixteen original criteria and accepted evidence

| ID | Criterion implemented | Source and proof |
| --- | --- | --- |
| WX-0056 | Return from the directory to the last supported subsection in this session. | [Route memory](../src/portals/routes.ts), mounted portal shell, nine literal route tests and real link navigation. Unsupported-path contamination is tested by an explicitly labeled navigation-only History/popstate probe in the owned browser. No model/storage injection or durable navigation key is used. |
| WX-0151 | Preparing requires a valid chosen sample period and only approved unpaid time inside it. | [HR workflow](../src/hr/mock-workflows.ts), period controls, invalid/missing/reversed/overlong/date fixtures and real selected-period preparation. |
| WX-0152 | Freeze configured fictional employee rates beside consumed hours. | Explicit employee/effective-date rate controls, per-work-date selection, frozen preparation/receipt/statement rows and independent literal totals. Fixture compensation has no inferred hourly cadence. |
| WX-0153 | A future rate change preserves submitted payroll. | Effective-dated timeline model, full historical receipt comparisons and rendered frozen rates after a later change. |
| WX-0154 | Changed approved input marks preparation stale and requires deliberate reprepare. | Shared eligibility/freshness projection, disabled next stages and visible stale reason; browser adds and approves new time, observes the block and intentionally reprepares. |
| WX-0155 | Every time entry states inclusion/exclusion reasons. | Complete eligibility table and independently tested date, active status, approval, payment and configured-rate reasons. Preparation and explanations share one projection. |
| WX-0156 | Manager returns submitted time with reason and no eligibility. | Scoped non-self manager return, visible retained reason, corrected draft, resubmission and approval through the UI. |
| WX-0157 | Owner edits unpaid drafts without mutating approved/consumed records. | Date/hours/day-aggregate/ownership checks, real correction and literal preservation cases. |
| WX-0158 | Confirmed draft deletion preserves submitted/paid history. | Explicit confirmation/cancel controls, model confirmation requirement and byte/data preservation tests for immutable paid history. |
| WX-0280 | Invalid CMS fields all appear in a summary and first invalid control receives focus. | Shared [CMS validation](../src/cms/model.ts), noValidate forms, inline aria errors and actual create/edit browser focus assertions. |
| WX-0282 | Dirty CMS switching offers keep/discard before changing the editor. | Controlled temporary buffers, normalization-aware dirty comparison, both decisions and clean-after-save browser cases. Separate review/publication and frozen public projection remain enforced. |
| WX-0397 | Malformed CRM enums/notes/edges refuse before replacement. | Strict string choices in [CRM persistence](../src/crm/persistence.ts), ten independent import tests and nine actual negative individual file uploads with complete export/raw-save preservation; combined rejection is covered separately by model tests. Unsupported notes remain unsupported; no invented profile schema. |
| WX-0453 | Label an existing point without changing capture/scope/time. | Optional schema-1 label, history-only rename model/provider, exact ID/time/kind/scope/payload comparisons and actual rename of an unlabeled automatic point. |
| WX-0454 | Create a named selected-scope point without import or workspace-save changes. | Manual capture with strict history validation, retention projection, readback/rollback and actual HR+CMS/all-module captures. Browser verifies only history changes. |
| WX-0457 | Inspect complete collection counts and bounded record IDs without applying or exposing text. | [Pure inspection](../src/portals/workspace-inspection.ts), primary/nested/metadata rules, default eight IDs plus exact omissions, full HR/CMS/CRM breakdown and actual read-only detail panel. |
| WX-0458 | Preview added/removed/changed entities per selected module. | Current-to-target pure comparison, selected combined restore and Undo panels, stable IDs and literal before/after browser counts. Hidden text affects change detection without appearing in the output. |

Agent 0 accepted these original criteria after focused execution and independent
review. The catalog records **77 done / 923 remaining**: **96 P1, 670 P2 and
157 P3**, with **756 local, 127 operator and 40 provider** gates remaining.
The complete 1,000-item goal remains active.

## Focused execution

- **79 new maturity model tests passed**, covering payroll/time, selected-period
  statement projections, strict CRM imports, named/manual history, return
  navigation, pure record inspection/differences and Undo preview binding.
- **139 HR behavior tests passed** across 15 files, including 20 new payroll/time
  cases and three selected-period statement cases. These overlap the maturity
  gate; they are not additional unique cases. Role/capability binding tests are
  counted separately.
- **46 manual/history/budget tests passed** in independent review. All old
  unlabeled schema-1 points remain readable with no migration writes.
- **17 CMS tests passed**, including literal field constraints, dirty-buffer
  behavior, stale revisions and frozen publication preservation.
- **34 role-example and 22 capability-map tests passed** after deliberate
  reviewed source-binding updates. SDK 0.56.6, its exact vendor inventory and
  the three selected components remain unchanged.
- **13 new actual browser check groups passed**, covering all 16 criteria in
  four isolated contexts. Runtime was 15.238 seconds; browser/server cleanup
  flags were true. Human completion time is not inferred from automation.
- The updated state-contract browser passed **13 checks**, and foundation navigation passed
  **10 checks** with 71 focus observations. Saved bytes and complete payload assertions
  remain in place; session return now intentionally retains the supported HR subsection.
- The existing two-employee payroll browser journey passed **eight checks**
  after explicit period/rate setup. Complete handwritten expected exports,
  saved envelopes, frozen periods/rates and $401 aggregate net still match.

## Actual browser observations

| Journey | Observed result |
| --- | --- |
| Payroll and correction | Avery's returned eight hours were corrected to 7.5, resubmitted and approved. Avery's fictional $25/hour and Morgan's $40/hour produced 9.5 hours/$267.50 gross in the chosen period. A further approved 1.25 hours made preparation stale. Reprepare produced **10.75 hours, $298.75 gross, $59.75 illustrative withholding and $239 net**, with no confirmed benefit deduction. |
| Future rate and statements | A later Avery rate of $35/hour effective November 1 preserved the complete submitted receipt and frozen rendered rates. A separate selected-period statement test verifies October 16–31 at a frozen $35/hour and legacy default-period compatibility without migration. |
| CMS | Both invalid forms list all errors and focus their first invalid field. Keep preserves the unsaved editor; discard switches without a saved action. Successful save makes the editor clean; frozen public content remains separate. |
| CRM | Nine negative individual CRM uploads reject malformed enum types, unsupported/oversized notes and broken relationships. Every rejected import preserves current complete records and exact saved bytes. |
| History and inspection | Rename preserves an automatic point's capture/time/scope. Manual captures change only history. Captured primary totals are **HR 35 / CMS 2 / CRM 27** after nine real CRM lead creations. Eleven lead IDs display eight with three omitted; all primary/nested/metadata collection rows remain visible. |
| Differences and Undo | Against a captured all-module point, deletion of Jordan's draft means HR adds one record; a CMS edit adds activity and changes content, so recovery removes one/changes one; a new CRM lead/activity means recovery removes two. The inverse differences are checked on Undo reversal. Details and preview leave all saves unchanged. |
| Session return | Actual directory/HR links return to the supported subsection. A navigation-only unsupported-route probe renders the unavailable page, then real links return to the earlier supported route. No persisted navigation setting is introduced. |

## Review and integration fixes

1. Pure manual preview originally accepted null option IDs and invoked UUID
   generation. Strict own-data option validation now refuses malformed IDs,
   timestamps, accessors, symbols and prototypes before clock, UUID, randomness
   or storage access. Throwing spies and independent probes confirm purity.
2. Undo originally retained an old clicked point while its budget used refreshed
   history. It now derives every preview field from the current point ID, shows
   an unavailable state if missing, and binds confirmation to the exact rendered
   capture. Fresh saved-history comparison refuses changed capture/scope/label
   or removal before any workspace read/write; five regression cases passed.
3. Payroll's local period/rate inputs needed reinitialization on Reset and single
   HR import. A role/reset-generation key now restores the correct imported or
   empty input state. Independent follow-up review is clear.
4. Older browser helpers assumed the shared HR link always opened its dashboard,
   a fixed global rate and the old receipt text. They now navigate explicitly,
   configure rates/period and compare the new frozen period/rate fields. This
   retains complete-payload assertions rather than weakening them.
5. The first integrated CI run passed through adoption rehearsal, then stopped
   at browser smoke: its dashboard helper assumed returning from Performance
   always opened HR home. The helper now explicitly selects Management before
   asserting dashboard totals. Exact exports/saved envelopes remain unchanged.
   Its fresh-entry dashboard assertion remains unchanged. Focused smoke,
   keyboard, CMS/CRM lifecycle and evaluator reruns all passed.
   Failed smoke report `webappx-browser-smoke-WI4EoK/report.json` retains the
   failure; both owned cleanup flags are true and no provider/error guard fired.
6. Development browser runs preserved selector/download failures. A nested
   select needed a role/name selector; export clicks were paced by 150 ms during
   repeated negative-import checks. One run also recorded source HMR. No app
   download defect was established; the frozen-source rerun passed.

## Compatibility and evidence boundaries

The named seed bytes and initial native state remain unchanged. Optional HR
rates, periods, frozen input metadata and return provenance decode strictly
when present. Old submitted receipts remain unchanged; old unfinished payroll
must be intentionally prepared with explicit inputs before proceeding.
Individual/combined backup and history envelopes remain schema version 1.
Manual labels/kind are backward-compatible optional history extensions.

The worksheet was refreshed with explicit fictional rates and period setup,
then checked as one A4 page and rendered for visual inspection. Original dated
QA receipts retain their original bytes, dates and starting-source-base
qualifications. A separate source review records the revised state guide through
the freshness workflow; it does not claim a new browser run at a later commit.

No provider, live payroll, insurance, authenticated production access or
production deployment is accepted by this local evidence. Native Windows
runtime acceptance remains separate. Selected manual alpha.6 releases,
research inventories and blank reusable SYSTEMX records remain preserved.

## Integrated publishing gates

The first full CI attempt stopped at the outdated smoke dashboard helper described
above. After the narrow helper correction, the complete rerun **passed all 56
required stages in their exact source-defined order**. The CI planning report
has no unknown classifications; it does not itself execute a gate.

| Browser gate | Passed checks/check groups |
| --- | ---: |
| Temporary committed-source HR-disabled adoption | 8 |
| Smoke | 7 |
| Keyboard onboarding/recovery | 9 |
| Foundation/navigation | 10 |
| State contract | 13 |
| CMS/CRM lifecycles | 12 |
| Payroll | 8 |
| Evaluator journeys | 25 |
| Maturity | 13 |
| Isolated LAN work status | 6 |
| **Total executed browser checks/check groups** | **111** |

Some journeys deliberately repeat workflows; this is an executed check-group
count, not a claim of 111 unique product invariants. All owned portal runner
browser/server cleanup flags passed. The committed-source adoption gate in this
full run examined starting base `950f9ba0c4e48faaa65056f504f105201838e3ec`;
it is separate from working-tree native browser execution.

`npm run deploy -- hosting --preflight` passed typecheck, lint, tests, build and
LAN production isolation. It skipped version/changelog/Git mutations, push and
deployment. App version remains **3.4.0**, deployment count **0**. Root and
Functions dependency audits reported **zero vulnerabilities**. Vite's chunk-size
advisory was non-fatal.

The required template, selected-release integrity, research-checksum, blank-seed
and host-drift checks passed within CI. The source catalog retains all original
1,000 definitions and dependencies; only the sixteen reviewed status/completion
records changed. Earlier QA receipts and immutable release files retain their
original bytes. Final guide links, repository identity, source-freshness decision
and native-wiki synchronization are checked separately before publication.

Final documentation checks passed: 733 README/SYSTEMX/wiki Markdown files,
plus 2,116 local file links across 72 host guides. Final template, host-drift and
generated execution-plan checks passed. The native wiki preview rendered all
58 pages and retained the five intended changed pages.
