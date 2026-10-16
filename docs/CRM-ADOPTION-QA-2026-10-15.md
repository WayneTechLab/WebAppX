# CRM merge and optional adoption artifact verification — 2026-10-15

Status: **PRE-ACCEPTANCE — provisional focused/source receipt.** The canonical catalog
remains **134 done / 866 TODO**. All twenty-two original criteria below remain TODO.
Agent 0 acceptance, complete CI, separate
Hosting preflight and final source/documentation metadata are **PENDING**. This
draft supplies no new completion count or forecast acceptance total.

The active project objective remains completing the original 1,000 criteria.
This receipt covers the bounded current wave: five fictional native CRM criteria
and seventeen optional adoption artifact criteria. It does not equate reviewed
source, authored paper examples, local browser observations, adopted operator
services or provider evidence.

## Published basis and current source boundary

The supplied actual published checkpoint is
`317f47806b7f86dce00f15ee5ced7c0e0bae6116`. Agent 0 reported clean/direct main
parity before creating the isolated CRM checkout. That is the starting source,
not a claim that the current working implementation is unchanged or already
published. The preceding [payroll/setup receipt](PAYROLL-SETUP-QA-2026-10-15.md)
retains its own implementation revision, 68-stage/211-browser-rehearsal and
preflight observations. Those historical gates do not test this CRM wave.

| Current implementation reference | Examined value |
| --- | --- |
| Supplied published base | `317f47806b7f86dce00f15ee5ced7c0e0bae6116` |
| Current runtime | 145 source files, freeze 3 |
| Current exact-byte manifest | [crm-merge-runtime-2026-10-15.json](evidence/crm-merge-runtime-2026-10-15.json) |
| Freeze-3 manifest SHA-256 | `f1588c3ed32d5c198aa74f7a673ebdd32422eacc659d754e73fac03bc68e4d7e` |
| Historical focused-browser freeze 2 | [preserved exact manifest](evidence/crm-merge-runtime-freeze-2-2026-10-15.json), SHA-256 `872a55c7fbf25bde442fbd7fa5f171f16a2bdf59c739d96785dd10a81f711999` |
| Receipt-preparation source check | All 145 listed files rehashed equal to freeze 3; no mismatches |
| Preserved earlier manifest | [crm-merge-runtime-freeze-1-2026-10-15.json](evidence/crm-merge-runtime-freeze-1-2026-10-15.json) |
| Freeze-1 SHA-256 | `42cbf700c7880316b206832555809c5d6a1eea2a775084258703b8d16aedef5a` |
| Final examined implementation commit | **PENDING — Agent 0 to record after integration** |
| Final accepted browser/runtime/harness/artifact verification | **PENDING** |

Freeze 1→2 changes only `src/crm/CrmDemo.tsx` and `src/crm/CrmMerges.tsx`.
Actual browser AX diagnostics found that unavailable-selection helper text became
part of a select's accessible name. Agent 0 separated stable explicit field
labels from helper descriptions through `aria-describedby`. The freeze receipt
records typecheck and scoped lint exit 0. No domain, controller, replay, provider
or replacement-epoch behavior changed in that repair. The earlier runtime and
failed browser evidence remain preserved. The focused composed browser run 5
passed on freeze 2. Freeze 3 removes exactly one extra trailing LF from
`src/crm/model.ts`; every preceding byte is unchanged and the other 144 source
files are exact. Full CI must execute freeze 3; the focused run is not relabeled.

Runtime manifests hash exact bytes. A source manifest is not execution or
acceptance evidence. Historical artifact drafting fingerprints at `42818dd…`
remain their original source observations, described separately below.

## Exact original criteria and dependencies

The tables below transcribe the current canonical
[catalog](backlog/webappx-1000-todo.json) directly. Every selected row is still
`todo`; original definitions, priorities, phases, sources, gates and dependencies
are preserved. No artifact-only output is relabeled a deployed service.

### Native CRM scope

All five rows have phase `portal-maturity`, area `crm-contacts`, gate `local`.
WX-0371 still depends on WX-0370, and WX-0373 on WX-0372; those prerequisite rows
are selected TODOs, not already accepted by this receipt.

| Original ID / priority and exact title | Exact original acceptance | Exact original dependencies | Focused evidence / remaining observation |
| --- | --- | --- | --- |
| WX-0369 / P2 — Add a CRM duplicate candidate report | The report identifies normalized company-name and email candidates within the actor's scope without merging automatically. | `[]` | Scoped deterministic report/projection tests and reviewed finite page/member/choice DTOs. Actual final composed browser observation remains pending. |
| WX-0370 / P2 — Preview same-owner contact merges | A merge proposal shows retained fields and linked records, and refuses incompatible ownership before confirmation. | `[]` | Complete source/retained capture and linked graph preview; same-owner authority, hidden-collision refusal and private handle tests. Final actual Preview/Cancel/focus observations pending. |
| WX-0371 / P1 — Apply contact merges atomically | A confirmed local merge redirects valid references once and leaves no dangling opportunity or lead contact IDs. | `["WX-0370"]` | Independent full contact result, exact reciprocal redirects, chronological replay and complete codecs. Final UI confirmation/reload/recovery observations pending. |
| WX-0372 / P2 — Preview company merge consequences | The proposal lists contacts, opportunities and duplicate-name conflicts before any account records change. | `[]` | Explicit company graph/context and contact/company-name conflict classifications, with no secondary merge. Final actual consequence rendering/focus pending. |
| WX-0373 / P2 — Apply company merges with receipts | A valid same-owner merge moves all supported graph edges atomically and records source and retained IDs. | `["WX-0372"]` | Same-owner complete company result, immutable source/retained captures, later work/transfer replay and recovery codec proof. Final browser and full gates pending. |

### Optional adoption artifact scope

The sixteen operator-gated rows and one provider-gated row retain their literal
gates. They are P1 original criteria whose requested outputs are designs,
contracts, plans or checklists. Artifact-design review can assess those requested
outputs without claiming that an operator adopted the service or a provider
workflow ran. Agent 0's current artifact-design review is recorded in the
[adoption index](ADOPTION-CONTRACTS.md); catalog acceptance remains pending.
WX-0534 retains WX-0501/WX-0503 and WX-0850 retains WX-0835. Those previously
completed dependencies retain their separate historical receipts; no new
candidate identity or operational evidence is inferred from them.

| Original ID and exact title | Exact original acceptance | Original gate / exact dependencies | Curated artifact |
| --- | --- | --- | --- |
| WX-0511 — Specify trusted membership provisioning boundaries | For optional operator-approved adoption: A design records which backend creates memberships, who can approve assignments and how client-controlled role fields are ignored. | operator / `[]` | [IDENTITY-ADOPTION-CONTRACTS.md](IDENTITY-ADOPTION-CONTRACTS.md) |
| WX-0517 — Design optional owner recovery procedures | For optional operator-approved adoption: A runbook identifies owner recovery prerequisites, evidence and independent approval before any real identity is restored or elevated. | operator / `[]` | [OWNER-RECOVERY-RUNBOOK.md](OWNER-RECOVERY-RUNBOOK.md) |
| WX-0527 — Define optional custom-token issuer contract | For optional operator-approved adoption: The contract requires trusted issuer identity, audience, lifetime and scope while keeping token generation outside browser code. | operator / `[]` | [IDENTITY-ADOPTION-CONTRACTS.md](IDENTITY-ADOPTION-CONTRACTS.md) |
| WX-0534 — Define optional portal-specific permission bundles | For optional operator-approved adoption: A reviewed design groups CMS publication, CRM assignment and HR administration capabilities without deriving them solely from paid account level. | operator / `["WX-0501","WX-0503"]` | [IDENTITY-ADOPTION-CONTRACTS.md](IDENTITY-ADOPTION-CONTRACTS.md) |
| WX-0612 — Define optional content security policy adoption | For optional operator-approved adoption: Produce a report-only policy proposal listing required Firebase, SDK, image and font origins; activation remains an operator-reviewed hosting change. | operator / `[]` | [CSP-REPORT-ONLY-ADOPTION-PROPOSAL.md](CSP-REPORT-ONLY-ADOPTION-PROPOSAL.md) |
| WX-0617 — Define optional webhook retention controls | For optional operator-approved adoption: An adoption design bounds stored webhook payload duration, redacts unnecessary provider fields and requires operator selection before collection. | operator / `[]` | [WEBHOOK-RETENTION-ADOPTION-PROPOSAL.md](WEBHOOK-RETENTION-ADOPTION-PROPOSAL.md) |
| WX-0627 — Design optional download authorization contracts | For optional operator-approved adoption: A future attachment design binds each download to tenant, resource and expiry rather than trusting a displayed URL or demo role. | operator / `[]` | [DOWNLOAD-AUTHORIZATION-ADOPTION-CONTRACT.md](DOWNLOAD-AUTHORIZATION-ADOPTION-CONTRACT.md) |
| WX-0628 — Prepare a private preview publication checklist | For optional operator-approved adoption: An operator adoption checklist verifies fictional data, no secrets, indexing choice and access controls before exposing a preview beyond loopback. | operator / `[]` | [PRIVATE-PREVIEW-PUBLICATION-CHECKLIST.md](PRIVATE-PREVIEW-PUBLICATION-CHECKLIST.md) |
| WX-0635 — Prepare optional incident evidence capture guidance | For optional operator-approved adoption: The runbook specifies revision, time, affected synthetic scope and redacted logs to preserve before any approved production incident changes. | operator / `[]` | [INCIDENT-EVIDENCE-CAPTURE.md](INCIDENT-EVIDENCE-CAPTURE.md) |
| WX-0637 — Design optional session step-up requirements | For optional operator-approved adoption: An adoption matrix identifies which sensitive export or owner action should require recent authentication and leaves enforcement disabled until reviewed. | operator / `[]` | [IDENTITY-ADOPTION-CONTRACTS.md](IDENTITY-ADOPTION-CONTRACTS.md) |
| WX-0760 — Design optional application error telemetry adapter | For optional operator-approved adoption: An opt-in adapter contract lists approved redacted fields, event volume limits and transport failure behavior before any external telemetry is configured. | operator / `[]` | [ERROR-TELEMETRY-ADAPTER-CONTRACT.md](ERROR-TELEMETRY-ADAPTER-CONTRACT.md) |
| WX-0802 — Create an optional GitHub Actions adoption workflow design | For optional operator-approved adoption: A reviewed plan runs the existing required gates on pull requests with explicit permissions and no production deployment credentials. | operator / `[]` | [GITHUB-ACTIONS-ADOPTION-DESIGN.md](GITHUB-ACTIONS-ADOPTION-DESIGN.md) |
| WX-0814 — Prepare optional deployment identity separation | For optional operator-approved adoption: An adoption design assigns distinct preview and production identities with minimal reviewed permissions and no secrets committed to workflow source. | operator / `[]` | [DEPLOYMENT-IDENTITY-SEPARATION.md](DEPLOYMENT-IDENTITY-SEPARATION.md) |
| WX-0820 — Prepare Windows x64 and ARM64 CI acceptance matrix | For optional operator-approved adoption: An optional runner plan identifies which host, import, test and build checks must run on each architecture and records unavailable runner coverage explicitly. | operator / `[]` | [WINDOWS-X64-ARM64-RUNNER-MATRIX.md](WINDOWS-X64-ARM64-RUNNER-MATRIX.md) |
| WX-0830 — Add Firebase rules dry-run evidence checklist | For optional operator-approved adoption: Document emulator policy evidence, target project review and deployment approval separately so local passing tests do not imply deployed rule acceptance. | operator / `[]` | [FIREBASE-RULES-DRY-RUN-CHECKLIST.md](FIREBASE-RULES-DRY-RUN-CHECKLIST.md) |
| WX-0850 — Create a release readiness decision worksheet | For optional operator-approved adoption: The worksheet records required local gates, optional provider evidence, unresolved blockers and operator deployment approval as distinct decisions. | operator / `["WX-0835"]` | [RELEASE-READINESS-DECISION-WORKSHEET.md](RELEASE-READINESS-DECISION-WORKSHEET.md) |
| WX-0953 — Add an optional OAuth state-binding design | An adoption test contract binds state, organization, initiating user, expiry and one-use callback without exposing a client secret. | provider / `[]` | [OAUTH-STATE-BINDING-ADOPTION-TEST-CONTRACT.md](OAUTH-STATE-BINDING-ADOPTION-TEST-CONTRACT.md) |

## Native CRM behavior examined by source and focused tests

The [implementation contract](CRM-MERGE-CONTRACT.md) fixes the four reviewed
policies: fully same-owner graph authority; retain-target-v1 with whole-operation
hidden converted-email collision refusal; a truthful first-merge legacy boundary
plus typed future forward replay; and one accepted memory result / one native
save attempt with separate browser-storage feedback.

- The duplicate report is read-only and scoped. Company normalization trims,
  collapses internal whitespace and lowercases; email normalization trims and
  lowercases. Punctuation/accents/suffixes/plus tags/dots are preserved. Reciprocal
  conversion pairs are explicitly expected links; a report match does not grant
  merge permission. Accessible group/member/choice/history pages are finite, with
  source-version refusal and no hidden full-array/global-count DTO.
- Contact merge retains the target's complete current fields, retires only the
  source and redirects source opportunities plus converted lead contact/company/
  email links. Company merge retains the target company, retires the source and
  moves explicit company-linked contacts/opportunities/converted leads. Closed
  opportunities and done tasks participate; unconverted company-name text is
  never an edge. Exact changed/context/source/retained sets, warning groups and
  the 200-record review closure are derived from the complete pre-state.
- Truly absent history retains the old legacy validator and seed behavior.
  Successful first merge captures a complete `legacy-at-first-merge` baseline;
  every later ordinary/ownership/merge command appends to one chronological
  receipt sequence. Imported history replays the actual concrete kernel and must
  equal the complete final graph/activity/sequence. Baseline facts are honestly
  accepted legacy provenance, not reconstructed past commands or cryptographic
  authenticity. Coherently authored fictional branches remain an import capability.
- Present history requires bounded descriptor-first plain JSON and exact shapes.
  Limits are 100 merges, 1,000 journal steps, 200 closure records, arrays of 10,000,
  depth 100, 300,000 inspected nodes and a complete native save envelope of
  2,000,000 characters. Current implementation rebuilds indexed graph views and
  clones snapshots per replay step. It does not claim once-built index reuse,
  worst-case browser latency or Windows performance.
- Private opaque handles bind whole source content, actor, selection, policy,
  public facts, epoch and generation. They are one-use, finite and expire. Actual
  latest functional acceptance rechecks authority/content rather than replacing
  render-captured state. Hidden route/tab commands refuse; stale same-sequence or
  identical-data replacement cannot reuse an old handle. Confirmation feedback
  says accepted in memory and points to the existing storage notice; no automatic
  retry, second save, provider write or stricter browser transaction is introduced.
- Current graph and historical merge scope are separate. Owner/manager/auditor
  may receive captured historical facts. Representatives receive only recorded-
  owner safe IDs/counts and fixed text, without raw mergeChange/names/emails/money
  or hidden current joins. A new owner does not acquire prior other-owner captures.
  Complete local backups remain explicitly complete; preview roles do not create
  trusted authentication or secrecy from the browser owner.
- Contact and company draft groups are independent. Edits/cancel/refusal retain
  exact selections; only actual accepted memory rebases the submitting form.
  Retired IDs remain visibly unavailable without silent alias/default replacement.
  Ordinary callbacks use synchronous latest-state updates, preserving the journal.
  The retained form owner survives capacity refusal while old private DTOs are
  removed. Existing intentional replacement/Discard/epoch behavior remains intact.
- Shared inspection adds nested typed captures and metadata, preserving active
  primary totals. Private full contents affect differences without entering safe
  detail DTOs. Legacy absence, changed-count symmetry and existing recovery codec/
  selected-write/Undo/preference boundaries remain separate from inspection.

These are source/focused observations. Actual final DOM, file upload/download,
keyboard/focus/layout, save-fault and full-gate observations must be recorded by
their owning executed runs before original acceptance.

## Focused local verification — preserve run scopes

All executed evidence below is local macOS. Earlier overlapping runs are not
summed into a distinct assertion total. Reports/receipts are read evidence;
explicit tool-only rows have no invented standalone TAP filename.

| Run / scope | Actual recorded result | Receipt and qualification |
| --- | --- | --- |
| Core initial combined run | 48/48 passed, zero failures/skips: 18 new core cases + 30 preserved old model/ownership/import cases | `webappx-crm-core-final-focused.log`, terminal 0. Historical focused source before the added lead-only test and subsequent UI-label changes. |
| Additional post-boundary lead proof | **One targeted test passed**, zero failures/skips | `webappx-crm-post-boundary-lead-focused.log`, terminal 0. Literal full-state create→qualify→owner assignment→new-owner conversion; exact receipts/commands/ownership metadata/prior captures and actual backup/native save-load replay. It is separate from the prior 48, not a fresh 49-test run. |
| Initial report/projection/controller | 17/17 passed, terminal 0 | `webappx-crm-controller-focused-verification.json`, tool chunk `d021e5`; source receipt with actual commands/hashes, not a separately saved TAP log. |
| Amended projection/controller | 18/18 passed, terminal 0 | `webappx-crm-controller-amendment-final-verification.json`, tool chunk `b4dc9c`. Runs only the two amended suites; overlaps initial tests. Four prior report tests remain prior evidence. **Do not add 17+18.** |
| Root private host lifecycle | Owner-reported 3/3 passed, terminal 0 | Tool receipt `25e16d`, recorded by the independent controller/UI repair review; no separate saved TAP log read for this draft. Old disposed ports, live route/tab and synchronous content/epoch invalidation. |
| Inspection extension + regressions | Owner-reported 68/68 passed: 12 new + 56 old | Inspection-owner handoff; independent review reads all twelve new tests/source but did not execute them. No standalone saved TAP log supplied to this draft. |
| CI source planner | Owner-reported 14/14 passed | Source-plan classification evidence; no full CI execution inferred. A durable final gate log remains pending. |
| Browser harness source contract | Freeze-4 receipt records nine focused tests, zero failures, and lint pass | `webappx-crm-browser-harness-freeze-4.json`. This historical freeze-4 source inventory preceded the final 24-status, seven-context focused browser run 5 recorded below; no older execution is relabeled. |
| Core source checks | Full isolated TypeScript and scoped ESLint exited 0 | Author-observed tool results after the initial 48-test core scope; no separate lint/typecheck log invented. |
| Controller amendments source checks | Full TypeScript / scoped ESLint exited 0 | Amended receipt tool chunks `984052` / `8b1da5`; limited to that receipt's source. |
| Runtime label repair | Full TypeScript / scoped lint exited 0 | Agent 0 freeze-2 receipt; focused browser run 5 passed at freeze 2, with integrated freeze-3 execution pending. |

Core independent oracles include complete legacy fixtures and contact result,
literal company rows/warnings, unchanged source bytes, genuine exact 200/201
closures, coherent 100/101 merge and 1,000/1,001 journal boundaries, exact
2,000,000-character acceptance versus 2,000,003 refusal, both merge orders and
later ordinary/ownership changes. Real single/combined codecs, selected restore
and Undo preserve complete branches and untouched HR/CMS/preference strings.
The precise 300,000/300,001 node boundary is enforced in source but was not
isolated as an exact runtime threshold test. No exhaustive latency claim follows.

## Independent reviews and corrected source findings

### Core and ordinary legacy compatibility

`webappx-crm-core-independent-review.md`, SHA-256
`88c13cb64d645133159acbd48ea858207fc4b304acd79a06acb2ca1614187a58`,
cleared the ten frozen core files at source/coverage scope. It preserved a
confirmed separately owned projection issue: new history capacity limits were
being applied to history-absent ordinary directory reads. The amended projector
at SHA-256 `44ce54fe7eb4ccd8cada15822fcc377477745ec67e53f7f3c61c937eaa705401`
now uses an iterative descriptor-safe unbounded-by-new-journal-caps legacy branch
and structured detached copies. Its valid 10,001-company / 9,999-activity legacy
fixture fits the old save limit and remains visible/unchanged; new merge
capabilities truthfully refuse unsupported capacity. Present history retains
strict scanning/replay. The amendment receipt and final controller/UI review
record the repair; the core review's original finding is not rewritten away.

The same core report noted missing independently exercised post-boundary lead
create/qualify/assign/convert paths in its historical eighteen new cases. The
separate one-test receipt above closes precisely that coverage gap with a
literal whole-state oracle and actual codecs; it does not become a reviewer
rerun or retroactively change the old 48-test log.

### Controller, host and retained UI owners

`webappx-crm-controller-ui-independent-review.md`, SHA-256
`565ec824b534387c6044283d0c8f1850a3941288a5745e40e4e65c2b816f3e1f`,
preserves its original 14,393-byte issue-analysis prefix and appends a final
source-clear repair review at runtime freeze 1:

1. A stopped/restarted host could previously let an old forwarding capability
   address a fresh controller. Ports now bind one concrete lifetime; old methods
   remain disposed and cannot preview, consume/cancel a fresh nonce or confirm.
2. A capacity-refused view could previously unmount the dirty merge form owner.
   The same keyed form owner now remains mounted with raw selected IDs and dirty
   registration, while old choices/full previews/private facts are withheld.

Its three host tests and added real-browser capacity scenario were read as
source; only the host tests have the owner-reported executed receipt above.
The independent narrow appendix preserves the exact 22,795-byte freeze-1
review prefix and clears the two freeze-2 accessible-label repairs. All 145
current source files matched freeze 2, with exactly those two changed files and
143 unchanged. No freeze-1 source copies were available for a literal textual
diff; the appendix qualifies its prior readings/current inspection and manifest
comparison. Actual focused browser run 5 is separately recorded below.

### Recovery inspection

`webappx-crm-inspection-independent-review.md`, SHA-256
`aa65c7fc1a0e57d38c7a91f1b23da6f974133626a641c1cc89f250c7d509c276`,
clears the frozen inspection extension. Four-part identities are allowed only
for the new CRM receipt/side/kind/ID capture collection; older three-part limits
remain intact. Captures/context are nested, history/baseline/steps metadata,
complete hidden fingerprints include ordered provenance, returned details are
allowlisted and both comparison directions preserve omission/removal semantics.
This was source/test review, not an independent rerun or browser observation.

## Optional adoption artifacts — reviewed designs, runtime unadopted

Fourteen guides cover the seventeen original artifact criteria. The exact
curated mapping and fingerprints are in the
[source-review record](evidence/adoption-contract-source-review.json). Its
historical drafting basis remains `42818dd7baf3d335f27c401c37d048bd842617fa`,
with the original implementation-era catalog hash; neither is relabeled the
current 134/866 catalog or a new runtime result.

| Curated guide | Original criteria | Recorded public artifact SHA-256 |
| --- | --- | --- |
| [IDENTITY-ADOPTION-CONTRACTS.md](IDENTITY-ADOPTION-CONTRACTS.md) | WX-0511, WX-0527, WX-0534, WX-0637 | `4649061dc6a7a28e26c93ed4282a2b0dd0c118af69b0dfc67958b286f6533d71` |
| [CSP-REPORT-ONLY-ADOPTION-PROPOSAL.md](CSP-REPORT-ONLY-ADOPTION-PROPOSAL.md) | WX-0612 | `1270bc35042b93f45c46053aef635e814c81d723482d37b8d72e9671c0529483` |
| [WEBHOOK-RETENTION-ADOPTION-PROPOSAL.md](WEBHOOK-RETENTION-ADOPTION-PROPOSAL.md) | WX-0617 | `00bc93f99e8bb9f7cbdb42ac0c06e9f27642ce52c4694ba09aee3b50dcec8e93` |
| [OWNER-RECOVERY-RUNBOOK.md](OWNER-RECOVERY-RUNBOOK.md) | WX-0517 | `f4566733faa9181d42c9619b5d4a050b1608a0dd0e01c37b78ce4a85c263b07b` |
| [INCIDENT-EVIDENCE-CAPTURE.md](INCIDENT-EVIDENCE-CAPTURE.md) | WX-0635 | `81ad04c6984c4960d97446f57a00842832045adbca4f8bb9b52d721c15aa2eb6` |
| [DOWNLOAD-AUTHORIZATION-ADOPTION-CONTRACT.md](DOWNLOAD-AUTHORIZATION-ADOPTION-CONTRACT.md) | WX-0627 | `a8b3cd5a774225696348904e189a907c9ced7e9d61f25d080f9a8b529609f4cd` |
| [OAUTH-STATE-BINDING-ADOPTION-TEST-CONTRACT.md](OAUTH-STATE-BINDING-ADOPTION-TEST-CONTRACT.md) | WX-0953 | `795e9cf2a1e50c5aa63f2f809b802cda5f4602c0561c3bf1195edace159b29ae` |
| [ERROR-TELEMETRY-ADAPTER-CONTRACT.md](ERROR-TELEMETRY-ADAPTER-CONTRACT.md) | WX-0760 | `67eec8f0593bbd634ca257f98a7126c2123d8f834545328ac9921614e005cf85` |
| [WINDOWS-X64-ARM64-RUNNER-MATRIX.md](WINDOWS-X64-ARM64-RUNNER-MATRIX.md) | WX-0820 | `40ed731fb214d95bd453c38e6fc803b346b4d68df53ea9f37521e3c8b21745c2` |
| [PRIVATE-PREVIEW-PUBLICATION-CHECKLIST.md](PRIVATE-PREVIEW-PUBLICATION-CHECKLIST.md) | WX-0628 | `6ac34c9fa20e972a79ea58258683cd40e81f5d9c08d5aa29364f4073e595f8ae` |
| [GITHUB-ACTIONS-ADOPTION-DESIGN.md](GITHUB-ACTIONS-ADOPTION-DESIGN.md) | WX-0802 | `59bed8d5fa78d336f98079d3045d950603eb5d7d49fcef033c23db4709476199` |
| [DEPLOYMENT-IDENTITY-SEPARATION.md](DEPLOYMENT-IDENTITY-SEPARATION.md) | WX-0814 | `28c56d6ca87fe05a1a486d18559625972a0db6c0dba56dd2a9883efb4be8b34a` |
| [FIREBASE-RULES-DRY-RUN-CHECKLIST.md](FIREBASE-RULES-DRY-RUN-CHECKLIST.md) | WX-0830 | `46157a7a9c566ee3936b745a21e0ff7c5e8f999ff71feda1647bb38bef92246b` |
| [RELEASE-READINESS-DECISION-WORKSHEET.md](RELEASE-READINESS-DECISION-WORKSHEET.md) | WX-0850 | `69bd3359c5ff59b885cccff9d1883c108a9a7980f43fd1174067fb659b06a0e7` |

The [identity matrix](evidence/identity-adoption-matrix.json) remains exactly
68,716 bytes, SHA-256
`0fc05bb008b5b6980fdb333f6cb3f772389d60958a2b9850ec82db4020218980`,
with **79 literal paper cases** and real operator selections null. Its original
draft/TODO metadata is preserved. No authorization evaluator or identity service
executed those examples. Curation retains the policies/fixture tables/fenced
blocks and changes public pointers, provenance and review-state wording only,
including the separately disclosed one identity review-status cell.

Independent artifact reviews and their narrow amendments record:

| Artifact scope | Review outcome and actual boundary |
| --- | --- |
| Identity: memberships, custom-token issuer, capability bundles, step-up | Four designs and 79 paper examples clear for artifact review. Actual principals/approvers/project/issuer/signer/verifier remain unselected; no membership or token service installed. |
| CSP and webhook retention | Clear at proposal scope. No header/report collector, payload collection, subscription, retention worker or TTL is activated. |
| Download and OAuth v2 | Three original findings resolved: atomic current-authority/stream fence, sensitive incoming callback versus clean controlled outputs, and a separate sanitized literal verification/grant oracle. Six amended JSON blocks / 43 named paper cases; combined four security proposals contain nine JSON blocks / 69 named cases. These are specified tests, not executed protocol assertions. |
| Owner recovery and incident evidence | Clear runbook/guidance scope: prerequisites, evidence and independent approval are explicit. No real identity restored/elevated and no production incident collection or mutation performed. |
| Telemetry v2 | Explicit terminal-result/cancellation/late-settlement quarantine contract closes the asynchronous lifecycle gap. Literal future cases do not install or execute telemetry; endpoint/transport remains unconfigured. |
| Windows x64/ARM64 v2 | Explicit native pwsh prerequisite and launcher/teardown/LAN/path coverage gaps. All 68 source-stage rows retain unavailable U/U architecture coverage; no native Windows runner, PowerShell launcher or browser execution is claimed. |
| Preview, deployment identity, rules and release worksheet | Four requested checklists/designs clear at artifact scope. No preview exposure, actual IAM subject/grant, emulator-policy receipt, selected deployment project, deployed rules, candidate approval packet or operator deployment approval is supplied. |
| GitHub Actions v2 | PR-retarget finding resolved by explicit opened/synchronize/reopened/edited events and fresh base/head/merge-tree binding, including title-only edited events. Four added literal scenarios are reviewed specifications. No workflow installed, action pins chosen, runner/account policies configured or remote Actions job executed. |

The curation proofs preserve original v1 drafts and reviewed v2 artifacts,
original review records and source inventories. The delivery extension preserves
the preceding nine guides and matrix byte-for-byte, adds five reviewed guides,
and records 58 valid relative links, 32 source rows across nineteen unique
historically observed files and no runtime/provider operation. The matrix and
fixture parsing/hash checks are documentary consistency evidence, not service
execution or full CI.

The historical package digest is kept distinct from the integration package.
The same 134 script names/ordering have two reviewed append-only alias changes:
`portals:test` adds the seven merge/inspection test files; `browser:smoke:test`
adds the harness-contract test. The maintained 68-stage source table and focused
planner result do not execute or accept changed stage contents. Final source
re-review after CRM freeze, full gates and final metadata remain pending. The
existing operator/provider gate labels are unchanged; actual downstream
adoption selections and runtime/provider acceptance remain separate decisions.

## Browser diagnostics and completed focused run

The first composed run used freeze 1 and the existing portal-lifecycle suite
followed by new CRM groups. Its original regression subset and three new groups
completed before a locator timeout. The overall report remains **failed**.
Successful subsets cannot establish the five new CRM criteria.

| Preserved observation | Actual result and resource boundary |
| --- | --- |
| `webappx-browser-portal-lifecycle-fC1qbb/report.json` | Overall failed: exact `getByLabel('Source contact')` did not identify the wrapped select as expected. Legacy suite completed and three new groups recorded before failure. Report SHA-256 `233b9d21f66e6c88490415e40d9297b2f02c0c3a6b1c0d723c9fab435b5e6c63`. All owned browser/server resources closed; preview PID 74982 / runner 74924 / port 60354 exited 0, both PIDs and port independently confirmed absent/free. |
| `webappx-browser-crm-label-diagnostic-UQR3XX` | Focused actual label/AX diagnosis, not the full CRM journey. Evidence SHA-256 `e04873ea51026535a95f1e47f89b50bb29e7a1d15407facb5545519fbc3230f7`; owned PID 91432 / runner 91365 / port 61103 cleaned and independently confirmed absent/free. |
| `webappx-browser-crm-label-unavailable-diagnostic-B0EO6Z` | Actual unavailable-selection AX diagnosis confirmed appended helper text in the field name. Evidence SHA-256 `c63c6342dec16e2a02f50a244231954cc7c9165449462dab528405c8563e913e`; owned PID 94240 / runner 94172 / port 61167 cleaned and independently confirmed absent/free. |
| Composed run 2 — `7qaDVz` | Overall failed on a guessed refusal substring; the UI uses the fixed privacy-safe text `The selected CRM records cannot be merged. No records changed.` The harness now asserts that exact text. Owned preview PID 9310 / runner 9248 absent; no listener on port 61479. A later plain bind encountered TIME_WAIT, which is not a listening process. |
| Composed run 3 — `S3MZjq` | Overall failed on a test selector counting a nested changed-pair article as a second receipt. The correction scopes the receipt article by its exact level-3 receipt heading and retains complete field assertions. Preview PID 20268 / runner 20210 absent; no listener on port 61810. |
| Composed run 4 — `GHa1gJ` | Overall failed when the harness tried to click an intentionally disabled opportunity action after its company retired. The corrected test asserts disabled UI prevention, native Enter, unchanged raw drafts and exact complete saves. Preview PID 43380 / runner 43314 absent; no listener on port 62692. |
| Composed run 5 — `97N2AD` | **PASS, terminal exit 0: 35 actual groups, existing lifecycle 20 plus CRM 15.** Seven new CRM contexts cover all 24 authored status meanings. Runtime freeze 2; combined manifest SHA-256 `159b1015d2ce49290023aa3b1c82de526f4df70b86691cd80e4d8b31ad4f35cd` binds 145 runtime files, 18 harness files and 284 artifacts. New CRM manifest SHA-256 `ca7c159ac2505544d12693d867a756abe05ae3278124f9d594d0f3226186a31b` binds 145 runtime files, 16 harness files and 104 artifacts. Independent artifact/cleanup review remains pending in this preliminary receipt. |

The harness now locates real controls by exact combobox role/name and uses actual
alert roles. Product labels/descriptions were separately repaired in freeze 2;
expected complete domain records were not changed to mask the locator issue.
Harness freeze 4 records nine focused source tests and authored inventory, not a
successful browser run. Failed reports, logs and the two diagnostic sessions are
preserved in their own evidence artifacts. The completed run compares exact complete records/raw slots and retains
scoped DOM/AX, focus/layout and status witnesses. Independent artifact and cleanup
review is a separate pending gate at this preliminary receipt.

## Evidence fingerprints at this provisional checkpoint

Local artifact basenames below identify the actual retained receipts; their
bytes are not shipped as permanent downloads. Runtime-generated local paths
remain outside this public source. Hashes bind
these versions only. In particular, an eventual appended review or final browser
report needs its own updated row, without overwriting the earlier observation.

| Retained local artifact basename | SHA-256 |
| --- | --- |
| `webappx-crm-core-final-focused.log` | `82e177c1d30a3f87e25d20993972f838727a9d707dbbfa67f579152ed79005f8` |
| `webappx-crm-post-boundary-lead-focused.log` | `2783407a414ce78e04c21e3da51fa6a9aa78d4a09b288c203ffa3efd7dfef2b2` |
| `webappx-crm-core-independent-review.md` | `88c13cb64d645133159acbd48ea858207fc4b304acd79a06acb2ca1614187a58` |
| `webappx-crm-controller-focused-verification.json` | `1a2354af6bd5a7c65be7ad8c4da143cb6aca0ab15e5704fec5f9c1b11764e2a9` |
| `webappx-crm-controller-amendment-final-verification.json` | `87092abdccf32820f4a32d404a54461128b3b69cd823c3f1ca5c9a562814c446` |
| `webappx-crm-controller-ui-independent-review.md` | `565ec824b534387c6044283d0c8f1850a3941288a5745e40e4e65c2b816f3e1f` |
| `webappx-crm-inspection-independent-review.md` | `aa65c7fc1a0e57d38c7a91f1b23da6f974133626a641c1cc89f250c7d509c276` |
| `webappx-crm-runtime-freeze-1.json` | `3f3a3bc6c78b1f1acad931a5ff139bb378d4bc9fc59122dea7a910384b29c3c5` |
| `webappx-crm-runtime-freeze-2.json` | `37e66dd4610fa9e07a52eb63e98c2b147acb2c011e57fb60b72de49cdeedc82c` |
| `webappx-crm-browser-harness-freeze-3.json` | `89df2e451831b407debac49c1e5f9f9e497ab7dea6887f9ee54b0f8cec9814e1` |
| `webappx-crm-browser-harness-freeze-4.json` | `4904cf9506961b3caf803951a787567f8b011d556e3ecf45b1481589abf2255e` |
| `webappx-crm-browser-run-history.json` — earlier draft snapshot | `0ec940fa81ef9c0679d76211b96394228f5b2962b9e74f307151605e507189a7` |
| `webappx-crm-label-diagnostics-verified.json` | `1e82843fa6fb30df4d22b83e8c542a06e4830a55027713c5ce885ecbb7950e58` |
| `webappx-crm-browser-composed-run1.log` | `82e76a0cc848588df5cdeff3e2f17b321864d45332c1a119d21d885d0674500b` |
| `webappx-p1-identity-independent-review.md` | `320dd14a3a5148e451d2ce570bb635eedd2602f3e48b877802ff802e1837e015` |
| `webappx-p1-security-independent-review.md` | `034013ac0aacda089bf765321cb8a99f9c0902c1a347f6b0f01ea753292bd01c` |
| `webappx-p1-security-v2-independent-review.md` | `16b7855e96d9bfbd0e1549dd643f2fea17bd747ccd2bd541a42dd00884117f79` |
| `webappx-p1-operations-independent-review.md` | `b1d1af51a9930dd550aee5be05c0b9e26938942bcde0130ac6539b059e3b2b13` |
| `webappx-p1-delivery-independent-review.md` | `d8939e9cdc481a9e0ed17773e95fff7d5763a9739e99c1a6bcd8f0264b77c5d9` |
| `webappx-p1-delivery-v2-independent-review.md` | `6bb050133d65735d6f0b9fd71e13bc30335ca3a5091270db5e946708b9aa8861` |
| `webappx-adoption-curation-final-proof.json` | `022bf8ad92dc255b48b500e3f6331eb42ccf25388693af312c5ef0816c3c95ed` |
| `webappx-adoption-curation-security-v2.json` | `cacb75d61dfab30d3beed4bf6af4206cd4338573815d6f515e6ffe81799d5039` |
| `webappx-adoption-delivery-curation-proof.json` | `bc0188677505f93bc0c8748c1bde4454e1e09963bd970eb5b4b73eb7d0296908` |

The current public source-review record is
`docs/evidence/adoption-contract-source-review.json`, SHA-256
`4d90a9edc8d9f57e0b0bd3855a47af6fe51318336358d401897344106c7e965f`;
the adoption index is SHA-256
`536c23e3aa279edff5ef80acb8752365a8ddc9271f0b8ff68ef44efb8353ffa5`.
The earlier nine-guide curation proof retains its then-current index/source-record
hashes; the later delivery proof explicitly extends them. Do not describe the
earlier proof as the current fourteen-guide file hash.

## Final gates — reserved for Agent 0

| Required conclusion | Current actual result / final receipt field |
| --- | --- |
| Final implementation revision and exact runtime source | **PENDING** — final commit: `________`; final runtime manifest: `________` |
| Final composed browser run and full literal exports/raw storage | **PENDING** — report: `________`; result/counts: `________` |
| Final visual, AX, keyboard, narrow/x-large and status-witness review | **PENDING** — reviewed artifacts and findings: `________` |
| Independent final runtime/harness/artifact/cleanup verification | **PENDING** — receipt and SHA-256: `________` |
| Mandatory complete local CI preserving prior stages | **PENDING** — actual source/command/terminal result/log hash: `________` |
| Separate Hosting preflight | **PENDING** — actual source/terminal result/log hash: `________`; no production deployment authorized by this receipt |
| Final artifact current-source re-review and maintained docs/source bindings | **PENDING** — separate metadata/source qualification: `________` |
| Final canonical original-criterion acceptance | **PENDING** — all 22 selected rows remain TODO; current catalog 134 done / 866 TODO |
| Publication / direct remote parity / wiki | **PENDING** — no current-wave publication or parity claim |

No real customer/person consolidation, provider lookup/write, membership grant,
owner elevation, OAuth exchange, custom-token minting, telemetry collection,
Windows x64/ARM64 execution, deployed rules, live Hosting, manual screen-reader
or business/operator runtime acceptance is inferred. Native synthetic roles,
complete local exports, optional adoption designs and provider/backend examples
retain their explicit separate boundaries. All earlier QA receipts remain
historical; this temporary draft changes none of them.
