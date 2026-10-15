# Portal workflow status inventory and visual quality audit

This inventory supports **WX-0655, WX-0720 and WX-0722**. Its executable source
is [the quality suite](../tests/browser/portal-quality.mjs), invoked by
`node scripts/browser-quality.mjs`. The runner opens fresh owned browser profiles
on an owned loopback Vite process and retains its report, screenshots, traces,
real downloads and accessible-name measurements. No provider account is used.

Status: **local automated browser and visual verification passed**. The focused
auditor gate passed 12/12 tests; the native quality run passed 6/6 check groups
with 151/151 expected meanings represented. The separately verified SDK ledger
adds 44/44 development-session meanings. Safety and recovery-drill scenes below
cover their additional decisions and failure branches. Agent 0 records release
acceptance, the reports and tested
revision in the wave QA receipt. A list of source strings alone is not visual
acceptance. The suite refuses a missing state observation or missing monochrome
capture, and negative tests prove that one representative badge cannot accept
this inventory.

## What is inspected

1. The ordinary interaction profile uses the real **Extra large** preference,
   checks the `x-large` setting and actual 20px computed root font at a 390 × 844
   viewport, then edits and saves HR, CMS and CRM forms with Tab/Enter. It checks
   labels, entered values, clipping ancestors, action text and keyboard reach.
   Individual import previews are canceled; a real selected restore and Undo are
   confirmed. Complete independent expected exports and raw saved envelopes are
   checked before and after, including exact restoration of prior saved bytes.
2. An isolated **render fixture** profile loads only known fictional snapshots
   that pass the actual strict HR/CMS/CRM import validators. Rare state rendering
   is tested through the normal product application. The data builders preserve
   seed IDs, relationship graphs and receipt histories. These observations prove
   visible state meaning, not that a user performed the corresponding transition.
3. Storage summary/notice and storage-budget variants mount the **actual exported
   product components** with fictional public props in that fixture profile. The
   ordinary app root is hidden only in this fixture document. No replacement
   badge markup is accepted as product rendering.
4. `grayscale(1)` is applied to the actual rendered UI for monochrome captures.
   Every inventoried state needs readable text in a retained capture. Color may
   reinforce meaning, but does not carry the state by itself. These checks do
   not constitute manual screen-reader acceptance, browser zoom certification,
   provider acceptance or an accessibility conformance claim.
5. A labeled local-file platform fixture holds `File.text()` only for selected
   fictional `quality-held-*` files in the disposable status profile. The actual
   product file input, Reading notice and Cancel controls render normally. The
   original platform method is restored afterward. Reading, invalid-file and
   cancellation scenes preserve every browser-save/history/preference byte;
   actual accepted import compares the full resulting records and selected save.

The owned verification worker freezes source watching and HMR update delivery,
while retaining Vite's owned connection channel and the strict network gate.
Ordinary development-server behavior is unchanged. These are frozen-source
browser results, not HMR acceptance. Long context captures are accompanied by
bounded screenshots of actual status text and action/field DOM elements so
their meaning remains readable without shrinking an entire inspection table.

## Complete implemented workflow inventory

The state names below are the finite application state machines, known states
accepted by app-owned record actions, and existing static fixture statuses.
Generic imported `HrRecord.status` is text, not a closed enum: its actual
renderer prints the supplied string after separating hyphens/underscores. This
inventory covers every implemented transition outcome and existing seeded value,
without claiming a finite list of all possible arbitrary imported prose.

| Domain / rendered family | Every implemented state or modifier | Actual rendering and authoritative definitions |
| --- | --- | --- |
| Employee onboarding | draft, reviewed, complete; profile/job reviewed or pending; checklist Complete/Mark complete; completion receipt | [OnboardingJourney and checklist](../src/hr/components/HrWorkspace.tsx), [workflow definitions/transitions](../src/hr/mock-workflows.ts) |
| Time entry | draft, submitted, approved; returned draft with manager and reason; included in a frozen payroll receipt | [TimeEntries/TimeEntryActions](../src/hr/components/HrWorkspace.tsx), [workflow](../src/hr/mock-workflows.ts) |
| Benefits | draft, reviewed, confirmed; enroll, waive; confirmation receipt | [BenefitsJourney and election table](../src/hr/components/HrWorkspace.tsx), [workflow](../src/hr/mock-workflows.ts) |
| Payroll preparation | idle, prepared, calculated, reviewed, submitted; stale preparation warning; per-row inclusion/exclusion explanation | [PayrollJourney](../src/hr/components/HrWorkspace.tsx), [eligibility/freshness](../src/hr/mock-workflows.ts) |
| Payroll receipts/pay statements | submitted snapshot, fictional receipt, selected period, frozen dated rates; historical fixture draft/mock complete; provider submission unavailable | [PayrollJourney/PayrollPreview](../src/hr/components/HrWorkspace.tsx), [pay history](../src/hr/components/HrInsights.tsx), [statement model](../src/hr/insights.ts) |
| Leave requests | pending, approved, rejected, cancelled; dated requested hours and balance labels | [PeopleOperations PTO](../src/hr/components/PeopleOperations.tsx), [PTO actions](../src/hr/people-operations.ts) |
| Assigned people tasks | pending, draft, assigned, in progress, open, completed | [PeopleOperations record renderer](../src/hr/components/PeopleOperations.tsx), [task eligibility and completion](../src/hr/people-operations.ts) |
| Policies | published, pending, assigned, acknowledged | [PeopleOperations](../src/hr/components/PeopleOperations.tsx), [acknowledgment](../src/hr/people-operations.ts) |
| Training | pending, draft, assigned, in progress, completed | [PeopleOperations](../src/hr/components/PeopleOperations.tsx), [completion](../src/hr/people-operations.ts) |
| Equipment/assets | pending, assigned, acknowledged, return requested, returned | [PeopleOperations](../src/hr/components/PeopleOperations.tsx), [custody simulation actions](../src/hr/people-operations.ts) |
| Documents | pending, published, assigned, acknowledged, placeholder; restricted provider documents have a textual unavailable explanation | [PeopleOperations](../src/hr/components/PeopleOperations.tsx), [document rules](../src/hr/people-operations.ts) |
| HR service desk | open, in progress, resolved; assignment, resolution and reopen action text | [HrServiceDesk](../src/hr/components/HrServiceDesk.tsx), [request model](../src/hr/service-desk.ts) |
| Recruiting jobs | draft, published, closed; disabled close/progress controls have textual active-candidate/publication reasons | [HrRecruiting](../src/hr/components/HrRecruiting.tsx), [job model](../src/hr/recruiting.ts) |
| Recruiting candidates | applied, screening, interview, offer, hired, rejected; hired employee ID/onboarding explanation and terminal state | [CandidateDetail/list](../src/hr/components/HrRecruiting.tsx), [candidate model](../src/hr/recruiting.ts), [linked hire](../src/hr/recruiting-link.ts) |
| Performance goals | draft, active, completed; numeric percentage and labeled progress element | [GoalCard](../src/hr/components/HrPerformance.tsx), [goal model](../src/hr/performance.ts) |
| Performance reviews | draft, self submitted, manager review, published, acknowledged; submitted/published comments, locked acknowledgment explanation | [ReviewCard](../src/hr/components/HrPerformance.tsx), [review cycle](../src/hr/performance.ts) |
| Surveys | draft, published, closed; audience and publication/close actions | [HrSurveys](../src/hr/components/HrSurveys.tsx), [survey model](../src/hr/surveys.ts) |
| Survey responses | privately saved draft; submitted once/locked; closed with unsubmitted saved answers excluded | [SurveyAnswers/results](../src/hr/components/HrSurveys.tsx), [response rules](../src/hr/surveys.ts) |
| CMS editorial | draft, in review, approved, published, retired; reviewer feedback; approved exact revision; older frozen publication separate from current draft | [selected content/list/public preview](../src/cms/CmsDemo.tsx), [editorial state machine](../src/cms/model.ts), [strict receipt validator](../src/cms/persistence.ts) |
| CMS dirty/recovery decisions | unsaved draft; validation summary; kept/discarded draft; restored revision comparison; explicit reload/reapply; pending recovery blocks save | [CMS editor UI](../src/cms/CmsDemo.tsx), [comparison model](../src/cms/editor-recovery.ts), [unsaved navigation](../src/portals/unsaved-work.tsx) |
| CRM leads | new, qualified, converted; linked company/contact/opportunity explanation | [LeadCard](../src/crm/CrmDemo.tsx), [lead model](../src/crm/model.ts) |
| CRM opportunities | discovery, proposal, negotiation, won, lost; staged action and terminal explanations | [OpportunityCard](../src/crm/CrmDemo.tsx), [pipeline model](../src/crm/model.ts) |
| CRM follow-up tasks | open, done; explicit completion action | [Tasks](../src/crm/CrmDemo.tsx), [task model](../src/crm/model.ts) |
| Employment/directory | active, onboarding; onboarding draft/reviewed/complete and static in progress/pending/complete | [directory/dashboard/profile](../src/hr/components/HrWorkspace.tsx), [dashboard](../src/hr/components/HrInsights.tsx), [fictional fixture](../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json) |
| Static HR metadata | company mock; worksite synthetic; pay schedule mock; historical payroll draft/mock complete; contractor payment synthetic/pending; benefit illustrative; contractor onboarding in progress/complete; access mock; automation disabled; derived organization sample | [RecordTable/NativeRecords](../src/hr/components/HrWorkspace.tsx), [fictional fixture](../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json) |
| Provider boundaries | Mock preview/disconnected; Not provisioned; Specification only; None embedded; Disabled; unavailable/live adapter required | [integration/Specification panels](../src/hr/components/HrWorkspace.tsx), [mock banner](../src/portals/PortalChrome.tsx) |
| Browser save state | ready, saved, restored, reset, unavailable, recovered; Ready/Saved/Unavailable/Recovered directory summaries and original explanatory message | [status model](../src/portals/persistence.ts), [notice](../src/portals/DemoStorageNotice.tsx), [summary mapping](../src/portals/save-summary.ts), [directory summary](../src/portals/PortalChrome.tsx) |
| Import | reading; ready to replace named portal; canceled/current unchanged; accepted save; refused/alert with current unchanged | [individual import](../src/portals/DemoWorkspaceBackup.tsx), [combined import](../src/portals/CombinedWorkspaceBackup.tsx) |
| Recovery capture kinds | named manual capture, before selective restore, before Undo, before individual import, before portal Reset; explicit selected portal scope and capture time | [history](../src/portals/RestorePointHistory.tsx), [strict history model](../src/portals/restore-points.ts) |
| Restore/Undo decisions | nothing selected; selected portals will be replaced; current→target differences; confirm/cancel; Undo affected portals; success; refused; uncertain rollback with keep-open/export instruction | [combined restore](../src/portals/CombinedWorkspaceBackup.tsx), [Undo/history](../src/portals/RestorePointHistory.tsx), [checkpoint replacement](../src/portals/replacement-recovery.ts), [restore coordinator](../src/portals/restore-workspaces.ts) |
| Storage budget | select at least one; unavailable/refused preview; permitted size/count projection; restore unavailable over limit; no reservation/quota claim | [RestoreBudgetPreview](../src/portals/RestoreBudgetPreview.tsx), [budget model](../src/portals/restore-budget.ts) |
| Inspection/differences | selected/no selection; added/removed/changed/unchanged; none; omitted identifier count; unsupported snapshot refusal | [WorkspaceInspection](../src/portals/WorkspaceInspection.tsx), [one comparison engine](../src/portals/workspace-inspection.ts) |

Static source properties that are not rendered workflow states are not promoted
to UI claims. For example, `company.onboardingStatus` is fixture metadata; the
company page exposes a mock setup specification. A successful mock transition
never changes Gusto/provider authorization.

## Accessible-name ambiguity audit

The suite measures each **visible control's actual Playwright accessible name**,
role and deliberate semantic scope. Native `<summary>` controls use Chromium's actual `DisclosureTriangle` accessibility-tree name because Playwright's ARIA YAML exposes them as text. Hidden mounted portal controls are counted
and excluded from visible interaction selectors. It records repeated global
role/name pairs even when a unique named backup region, navigation landmark,
fieldset, form or identified record article resolves them. A repeated name in
the same semantic entity, a duplicate unnamed scope, or an unnamed visible
control fails. DOM position is not accepted as entity identity.

The negative fixture gate is
[portal-quality-auditor.test.mjs](../tests/browser/portal-quality-auditor.test.mjs).
Its AST check compares 19 selected finite workflow/save/recovery enum properties
and the CRM stage array with the inventory, so adding a state to those definitions
requires extending the audit. It proves that duplicate visible Import workspace actions, two identical record
actions in one entity, unnamed controls and incomplete monochrome inventories
fail. Separate named regions/records resolve repeated actions without hiding
the global selector ambiguity measurement. This is automated selector/name
quality evidence; manual status-announcement acceptance remains WX-0656.

## Evidence and limits

The JSON report contains per-screen control inventory summaries and a complete
status-coverage ledger with capture names. `controls-*.json` retains each measured
role, name and semantic scope. `status-coverage.json` qualifies rare-state fixture
evidence. `status-contact-sheet-*.html` and matching PNGs assemble the actual retained grayscale captures for review; each row links a family/state to its full context capture. Native JSON downloads retain complete records for independent expected
state comparison. Traces and failure screenshots survive a rejected run.

The visual record must be reviewed together with literal state assertions:
a screenshot of one success state cannot establish the other states. Keep the
existing [failure drill](PORTAL-RECOVERY-FAILURE-DRILL.md) separate from ordinary
browser behavior: fault injection proves handling of an injected failure, not a
claim that the user's browser privacy settings caused it.

## Visual evidence ledger boundaries for this wave

The `statusFamilies` ledger in the quality suite covers **151 state/meaning
entries across 35 families**, including actual inspection empty/refused/unchanged
states. The full source inventory above also names current-wave dirty editor,
checkpoint and failure branches. **The quality ledger count alone does not
accept those additional rows.** Their actual grayscale scenes are supplied by
the independent safety and recovery-drill suites below. Agent 0 must verify all
three passing reports and inspect their captures before accepting WX-0720.

| Source state / meaning | Actual visual evidence owner and capture basename |
| --- | --- |
| Clean CMS editor after an accepted save | Quality suite: `xlarge-cms-draft-monochrome.png`; saved receipt/action and clean editor, with complete exported state checked |
| Current unsaved CMS text / Keep editing and Discard choices | Safety suite: `navigation-unsaved-dialog-grayscale.png` |
| Keep/Discard notice for unindexed browser history | Safety suite: `legacy-history-keep-grayscale.png`, `legacy-history-discard-grayscale.png`; explicitly labeled no-Navigation-API/pre-guard raw-history fixture |
| Stale restored CMS editor; baseline/restored/unsaved comparison and explicit reload/reapply | Safety suite: `cms-editor-comparison-grayscale.png` |
| Missing restored CMS entry with retained text and disabled reapply | Safety suite: `cms-missing-entry-comparison-grayscale.png` |
| Retained review feedback | Safety suite: `cms-retained-review-feedback-grayscale.png` |
| Required checkpoint before individual import / Reset | Safety suite: `checkpoint-import-preview-grayscale.png`, `checkpoint-reset-preview-grayscale.png` |
| Required checkpoint refusal; failed capture preserves destination | Safety suite: `checkpoint-import-refused-grayscale.png`, `checkpoint-reset-refused-grayscale.png` |
| Changed settings invalidate preview | Safety suite: `checkpoint-import-stale-preview-refused-grayscale.png`, `checkpoint-reset-stale-preview-refused-grayscale.png` |
| Uncertain rollback: keep page open and export before refresh | Recovery drill: `06-uncertain-guidance-status-monochrome.png`; full-page context also retained |
| Storage unavailable / memory-only guidance | Recovery drill: `10-unavailable-save-guidance-status-monochrome.png`; full-page context also retained |
| Damaged history / explicit clear-history guidance | Recovery drill: `12-damaged-history-guidance-status-monochrome.png`; full-page context also retained |
| Added/removed/changed/unchanged records; directional selected restore and Undo | Quality suite: `xlarge-restore-preview-monochrome.png`, `xlarge-undo-preview-monochrome.png`; real changes and complete recovery checked |
| Narrow Extra large entered fields and restore/Undo decisions | Quality suite: `xlarge-*-entered-monochrome.png`, `xlarge-restore-explanation-monochrome.png`, `xlarge-restore-actions-monochrome.png`, `xlarge-undo-explanation-monochrome.png`, `xlarge-undo-actions-monochrome.png`; bounded actual DOM screenshots accompany full contexts |
| Empty, unsupported and unchanged inspection / difference states | Quality suite: `statuses-fictional-*-fixture-monochrome.png`, from actual exported product components |
| Individual/combined transient read, invalid file, accepted individual import, combined empty selection and cancel | Quality suite: `statuses-import-*-monochrome.png`; actual controls/messages with an explicitly held local-file platform fixture for the two transient reading states |

The exact report/artifact directories are run output, not permanent hosted
screenshots. Their passing run identities and visual review are recorded in the
accepted wave QA receipt. A report must pass together with its complete capture
manifest; a source inventory or earlier failed report does not establish acceptance.

Local verification on 2026-10-15 used these retained run identities:

| Suite | Passing run identity | Verified scope |
| --- | --- | --- |
| Native quality | `webappx-browser-quality-aQTfwQ` | 6 check groups; 151 expected meanings in 35 families; 157 observations; 244 actual grayscale captures and 7 contact sheets; narrow Extra large controls, independent complete state/byte comparisons and ambiguity audits |
| SDK quality | `webappx-browser-sdk-quality-UbyehP` | 5 check groups; 44 meanings in 11 families; 88 grayscale captures; actual SDK/local-API flows and explicitly labeled pending/refusal fixtures |
| Safety | `webappx-browser-safety-bCJkZi` | 30 check groups; 12 SHA-bound grayscale scenes with stable visible DOM and capture bounds |
| Recovery drill | `webappx-browser-recovery-drill-vnuB92` | 8 check groups; three bounded readable grayscale guidance scenes plus full contexts |

The native contact sheets and bounded witnesses, all 44 SDK witnesses, all
safety scenes and the three recovery guidance scenes were visually inspected.
The two legacy-history decision-dialog images are byte-identical, with matching
stable visible text and full capture dimensions; the same visible notice is
valid for both decisions. A read-only pixel check found no non-gray pixels in
all 244 native quality images, all 88 SDK images and all 12 safety images.
Every owned verification browser and preview process closed after the runs.

The AST inventory guard also checks **RestorePoint.kind** and
**CmsEditorComparison.kind**. Restore kinds map to actual human capture labels;
CMS machine kinds `clean/current/stale/missing` map to the clean-save/current
unsaved/comparison/missing-entry scenes above. Internal machine values need not
be copied literally into product UI when the visible text communicates the
same meaning.

## Separate development-only SDK session boundary

The persisted native workspaces above are distinct from the implemented
[SDK preview](../src/hr/gusto/GustoSdkPreview.tsx) at `/hr/demo/sdk`. That preview
uses genuine Embedded React SDK components against the same-origin
[local fictional API](../integrations/gusto/mock-api.mjs). Its session resets on
refresh and does not share the native HR/CMS/CRM saved state.

The native quality suite's network policy **blocks** `/__gusto_mock__/` and
provider/backend endpoints. Its 151-entry ledger therefore **does not prove SDK
status rendering**. WX-0720 requires the separate SDK companion's passing,
inspected monochrome record for its implemented session and flow states. The
companion may allow only this owned origin's explicitly bounded
local SDK API; it must keep external Gusto/provider/credential requests blocked.

| SDK host branch | Required human-readable meaning / state witness |
| --- | --- |
| Session startup / ready / refusal | Starting isolated synthetic session; fictional records ready; error alert and Retry mock session |
| Flow selection | Selected Employee directory / Employee onboarding / Payroll workflow button and textual session explanation |
| Directory state and unsupported actions | Fictional employee status text; supported onboarding instruction when an unsupported directory management event is emitted |
| SDK onboarding data steps | Required data steps remain incomplete versus data steps verified and explicit final review available |
| Final form / new-hire review | Individually labeled unreviewed/reviewed confirmations; blocked completion until both are selected; no legal signature/filing claim |
| Onboarding completion / refusal | Visible completion receipt, fictional employee active/readback instruction and locked confirmations; error when completion cannot be verified |
| Payroll execution | Actual SDK local calculation/review/processed state text and host simulated-payroll-processed explanation; no real funds/tax filing claim |
| Reset success / refusal | All SDK sample changes reset, or explicit reset failure and refresh instruction |
| Readiness verification refusal | Mock onboarding readiness could not be verified |
| Recent events | Identified textual SDK event names, with no success inferred from color or an event alone |
| Production build boundary, outside the development-session status ledger | Run SDK mock locally instructions; development-only API unavailable in the production build. This remains a separate production build/preflight gate; development-session captures do not claim production-browser verification. |

The separate [SDK quality companion](../tests/browser/sdk-quality.mjs), invoked
by [its owned runner](../scripts/browser-sdk-quality.mjs), has its own literal
state ledger, monochrome captures and report. That ledger covers **44 meanings
across 11 families**, with a full/section capture and a bounded actual DOM text
witness for each. Its final passing report and visual
review are recorded separately in the accepted wave QA receipt. These rows are
required coverage, not a claim of completion based on source inspection alone.

| SDK ledger family | Every scoped state identifier |
| --- | --- |
| Session (6) | session-starting, session-ready-directory, session-unavailable, session-invalid-response, session-retry-starting, session-retry-ready |
| Directory (4) | directory-onboarding, directory-dismissed, directory-unsupported-action, directory-completed-active |
| Onboarding data (8) | onboarding-initial, onboarding-profile-validation, onboarding-after-profile, onboarding-compensation-saved, onboarding-federal-tax, onboarding-state-tax, onboarding-payment, onboarding-deductions |
| Onboarding review (9) | onboarding-sdk-summary, onboarding-readiness-incomplete, onboarding-readiness-unverified, onboarding-review-ready, onboarding-form-reviewed, onboarding-report-reviewed, onboarding-review-refused, onboarding-completion-refused, onboarding-completion-unverified |
| Onboarding completion (1) | onboarding-completed |
| Events (1) | sdk-event-log |
| Payroll pending (3) | payroll-preparing, payroll-calculating, payroll-submitting |
| Payroll (3) | payroll-initial, payroll-review, payroll-submitted |
| Payroll review tabs (3) | payroll-hours, payroll-take-home, payroll-tax-debit |
| Payroll receipt (3) | payroll-receipt, payroll-receipt-tax, payroll-receipt-employees |
| Reset (3) | reset-refused, reset-pending, reset-success |

Held local SDK responses establish the visible pending screens. Explicit local
API refusal/malformed-response fixtures establish the error/readiness branches;
their observation records label that boundary. The receipt uses the actual
selected SDK component and local fictional receipt endpoint. Native workspace
and unrelated browser storage stay byte-identical throughout the SDK journeys.
