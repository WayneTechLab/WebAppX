# Native CRM duplicate reporting and merge contract

Reviewed by Agent 0 on **2026-10-15**. **Implementation contract; original checklist criteria remain unaccepted until their actual verification.** The account-free design below is approved for implementation. Real provider operations and production deployment are outside this contract.

## 1. Scope, source and unchanged originals

Implementation starts from published WebAppX `317f47806b7f86dce00f15ee5ced7c0e0bae6116`. The preceding payroll/setup checkpoint passed its separate gates and published before this assignment. This contract grants no new execution evidence.

The reviewed v2 design fingerprint is `93a171cce5b691ae7e38f3dbb63254adbc572ae6760589c361a9f1d6bfb2e9d7`. It resolves the earlier review's exact closure, historical proof, private confirmation and representative privacy gaps. It supersedes the first draft's merge-only inverse algorithm and public full-source confirmation string.

Canonical `docs/backlog/webappx-1000-todo.json` was read directly. All five originals remain `todo`, phase `portal-maturity`, gate `local`; acceptance and dependencies are unchanged:

| ID | Priority / title | Exact acceptance | Dependencies |
| --- | --- | --- | --- |
| WX-0369 | P2 — Add a CRM duplicate candidate report | The report identifies normalized company-name and email candidates within the actor's scope without merging automatically. | `[]` |
| WX-0370 | P2 — Preview same-owner contact merges | A merge proposal shows retained fields and linked records, and refuses incompatible ownership before confirmation. | `[]` |
| WX-0371 | P1 — Apply contact merges atomically | A confirmed local merge redirects valid references once and leaves no dangling opportunity or lead contact IDs. | `["WX-0370"]` |
| WX-0372 | P2 — Preview company merge consequences | The proposal lists contacts, opportunities and duplicate-name conflicts before any account records change. | `[]` |
| WX-0373 | P2 — Apply company merges with receipts | A valid same-owner merge moves all supported graph edges atomically and records source and retained IDs. | `["WX-0372"]` |

This is consolidation of **fictional local CRM companies and contacts**. There is no new person table, contact/lead unification, arbitrary personal-data ingest, ownership change, opportunity deduplication, notification, external lookup or provider write. Complete contact captures preserve combined history; they grant no authority over real people. Reusable seeds remain blank; managed SYSTEMX releases and fingerprints remain immutable.

## 2. Approved implementation policy choices

Agent 0 approved these concrete policies and the finite limits below for this fictional local implementation. This design review does not accept the five original criteria or activate a provider:

1. Owner and sales manager may merge a fully same-owner graph belonging to any supported non-auditor owner. A canonical sales representative may merge only their own fully same-owner graph. Auditor is read-only. Canonical ID/role pairing is authority; display labels are not. Ownership transfers remain owner/manager-only.
2. Contact policy is `retain-target-v1`: retain the target's complete current contact record. Redirect source-linked opportunities and converted leads; disclose the converted lead email change to the retained email. Refuse the entire merge if the existing global lead-email uniqueness rule would be broken, including a hidden collision. No email alias or lead deletion is added.
3. Adopt the optional first-merge legacy capture plus typed future-receipt provenance in section 6. This is a necessary integration prerequisite for chronological import proof, not an unrelated CRM redesign.
4. Keep existing one-memory-result/one-envelope-save semantics. Successful feedback says **accepted in memory** and points to the browser storage notice. Quota denial does not trigger retry or a second merge. A storage transaction stricter than existing CRM is outside this proposal.

If a reviewed implementation changes a choice, amend the contract and proof matrix before shared types freeze. An owner-only alternative or refusal of all converted-source contacts must be recorded as an explicit policy and tested consistently; implementations must not silently choose one.

## 3. Candidate report: deterministic, scoped, read-only

Normalize a company name as `name.trim().replace(/\s+/gu, ' ').toLowerCase()`; normalize email as `email.trim().toLowerCase()`. Preserve punctuation, accents, suffixes, plus tags and dots. Do not use locale collation, fuzzy scoring, Unicode compatibility folding or normalization writes. Stored validation and uniqueness rules remain unchanged.

Only active records admitted by the canonical actor's current read scope participate. Company groups use normalized company names. Email groups contain typed contact/lead members with the same normalized email. A converted lead/contact pair already joined by the existing reciprocal graph is `expected-conversion-link`; an independent cross-table collision is `candidate`. Neither creates a lead/contact merge command. A globally visible cross-owner group is `cross-owner-ineligible`; a normalized match is never permission.

Valid CRM data cannot have duplicate contact emails, duplicate lead emails or exact same-owner lowercased company names. Demonstrate valid internal-whitespace company variants, cross-owner company matches, ordinary expected conversion pairs, and valid imported cross-table collisions. Do not relax validation or inject invalid state to manufacture success.

The public report has schema 1, explicit empty/page status, page/pageSize, **accessible** group count, returned count and hasMore. Sort groups by reason then normalized key using code-point order; members by record kind then ID. Default page size 20, maximum 50. Groups with more than 50 members have an explicitly separate member page/count/hasMore; no hidden full member array or global total reaches children. Page and group-member requests are finite, validated and reauthorized; source/identity/epoch changes reset pagination. A selected-pair preview independently derives its full graph and is never authorized by a report page. Manual explicit merge selection is permitted without an advisory match.

Choice pages may include at most two explicitly requested selected IDs, each reauthorized against the current scope. An accessible off-page selection returns its current permitted choice; a missing or inaccessible selection returns the same unavailable marker without a label. This lets forms retain literal IDs across retirement without treating every off-page choice as unavailable.

Report reads, paging, preview, cancel, failed validation and export write no state, save, receipt or optional extension. Invalid/forged actors receive a fixed refusal before record lookup. Inaccessible/missing selections and hidden conflicts share generic refusal text without labels, IDs or counts from the hidden graph.

## 4. Exact selection and survivor fields

Strict selection has exactly `kind: 'contact'|'company'`, `sourceId`, `retainedId`, `fieldPolicy: 'retain-target-v1'`. Reject extra keys, invalid types, same IDs, unknown policy, missing/inaccessible records and retired IDs. Do not silently resolve an old selection through an alias. Both direction and target are explicit user choices; no arbitrary patch object or automatic first-record winner.

**Contact:** keep the retained contact's ID/name/email/company/owner and every otherwise supported field exact. Retire only the source contact. For every source-contact opportunity, change `contactId` to retained ID and `companyId` to retained company ID; preserve ID/title/amount/stage/owner/leadId. For every converted source-contact lead, change `contactId`, `companyId` and email consistently; preserve ID/name/companyName/owner/status/opportunityId. Cross-company contacts are eligible only when both companies and every changed/contextual row share one supported owner. Closed opportunities and done tasks are included. Unconverted lead text is never a graph edge. Refuse any converted-email collision as one whole operation, even when the conflicting lead is hidden.

**Company:** keep the retained company's complete fields exact. Retire only the source company. Change `companyId` on every source contact, source opportunity and explicitly source-linked converted lead. All other fields, contact IDs, reciprocal lead/opportunity IDs, amounts, stages and emails remain exact. Tasks keep their complete records and opportunity IDs. Unconverted `companyName` text remains exact. Contacts/opportunities/leads are not secondarily merged.

For both kinds, preserve the complete retired source, retained-before capture, changed full before/after pairs and unchanged context in the immutable merge receipt. This retains discarded active fields as historical facts; it does not introduce them into today's retained record. There is no normal unmerge command. Existing explicit import/selective restore/Undo may restore an older whole-workspace branch under its existing confirmations; that is disclosed replacement, not an inverse merge or global idempotency guarantee.

## 5. Exact changed and context sets

All sets below are evaluated against the complete validated **pre-merge** graph. Include all statuses. A typed identity is `(record kind, ID)`; sort each table by ID in code-point order. Captures preserve each record's full accepted key/value content; array order in the live workspace remains unchanged except source removal. Changed pairs keep the same ID and allow only section 4's fields to differ. The source and retained captures are distinguished from changes and context, never treated as a free-form `affected` permission list.

Notation: `C(g)` contacts whose companyId is g; `O(g)` opportunities whose companyId is g; `L(g)` converted leads whose companyId is g; `Oc(c)` opportunities whose contactId is c; `Lc(c)` converted leads whose contactId is c; `T(O)` tasks whose opportunityId belongs to O.

| Set | Contact merge s → r | Company merge s → r |
| --- | --- | --- |
| Retired source | `{contact s}` | `{company s}` |
| Retained record | `{contact r}` | `{company r}` |
| Changed contacts | empty | `C(s)` |
| Changed opportunities | `Oc(s)` | `O(s)` |
| Changed converted leads | `Lc(s)` | `L(s)` |
| Unchanged company context | companies of s/r, deduplicated | `Q`, defined below |
| Unchanged contact context | empty beyond explicit retained capture | `C(r)` |
| Unchanged opportunity context | `Oc(r)` | `O(r)` |
| Unchanged converted-lead context | `Lc(r)` | `L(r)` |
| Unchanged task context | `T(Oc(s) ∪ Oc(r))` | `T(O(s) ∪ O(r))` |

`Q` is every third same-owner company, excluding s/r, whose normalized name equals the retained company's normalized name. Only those company rows are context; their unrelated downstream graphs are not claimed as reviewed. The contact preview is explicitly a linked source/retained **contact** graph, not a claim to list every other row in the two companies.

Company preview also lists normalized contact-name groups of size >=2 within `C(s) ∪ C(r)`. Each row identifies all exact contact IDs and original company IDs. Classification is `pre-existing` if all members started in one company, `new-cross-company` if each original company contributes exactly one member, otherwise `mixed` (newly combined plus pre-existing conflicts). Names use the same whitespace/case normalization; no contact is merged by this warning. Q produces separate `company-name` warnings. Valid whitespace-only normalized matches are warnings; an exact same-owner collision already makes source validation fail.

If the selected source and retained company names themselves normalize equally, show a separate `selected-name-match` advisory; distinguish that retiring-source match from conflicts remaining in the prospective retained directory. Q warnings name the retained company plus every third matching company, with all corresponding IDs already inside the review closure.

The review closure is the distinct typed union of **every table cell above plus source/retained**. Maximum 200 records, including unchanged tasks and warning company context. Preview returns exact changed/retired/retained/context counts and all rows; 201 refuses with no confirmation. No truncation enables Apply. Conflict warning IDs must be subsets of these declared captures. Every changed row occurs exactly once; unchanged context is complete at that receipt and appears in no changed pair. Reducer-derived set equality rejects omitted, extra, unrelated, duplicated and mixed-owner rows.

## 6. Chronological proof with a first-use boundary

### Why a merge-only inverse journal is insufficient

Current legacy activity contains descriptions, not typed targets/commands for create/convert/stage/task actions. Later transfers also alter captured owners. Comparing old complete captures to today's rows rejects legal later work; trusting arbitrary old captures admits forged membership. Descriptions must never be parsed to reconstruct events. A compact merge-only proof therefore cannot establish the required post-merge record lifetimes and complete closure after later actions. This v2 selects a forward proof from a truthful first-use boundary instead.

### Optional schema proposal

Keep workspace/envelope schema 1. Add optional `mergeHistory` to the private complete workspace, and `mergeChange` only to `merge-contact`/`merge-company` activities. No load-time migration, empty/null arm or separate adoption action:

```ts
type CrmMergeHistoryV1 = {
  schemaVersion: 1
  baseline: {
    kind: 'legacy-at-first-merge'
    // Complete accepted pre-first-merge state, without mergeHistory.
    companies: CrmCompany[]; contacts: CrmContact[]; leads: CrmLead[]
    opportunities: CrmOpportunity[]; tasks: CrmTask[]
    activity: CrmActivity[]; sequence: number
  }
  steps: {
    receipt: string
    actor: { id: CanonicalCrmActorId; role: CrmRole }
    command: StrictOrdinaryCrmEvent | StrictAccountTransferCommand | CrmMergeSelection
  }[] // oldest first; first step must be a merge
}
type MergeChange = {
  schemaVersion: 1; kind: 'contact'|'company'; actorId: string
  sourceId: string; retainedId: string; commonOwnerId: string
  fieldPolicy: 'retain-target-v1'
  source: CompleteTypedSource; retained: CompleteTypedRetained
  changes: { contacts: FullContactPair[]; leads: FullLeadPair[];
             opportunities: FullOpportunityPair[] }
  context: { companies: CrmCompany[]; contacts: CrmContact[];
             leads: CrmLead[]; opportunities: CrmOpportunity[]; tasks: CrmTask[] }
}
```

The kind discriminates exact source/retained record types; pair shape is exactly `{before,after}`. Do not add a mutable alias table, separate authoritative retirement list, generic record patch, nested workspace in a mergeChange, or a second sequence. The one chronological `steps` stream drives replay; current activity and its deterministic mergeChange are checked replay output. Baseline activity is contained provenance equal to the unchanged legacy receipt suffix, not additional primary activity. No invented timestamps, missing historical actors, birth events, prior merges or ownership decisions are added.

### Required finite validation algorithm

1. Inspect optional property descriptors before structural reads. No mergeHistory means today's exact legacy validation path and seed requirements. New merge actions without history refuse. Present history opts the complete saved envelope into bounded plain JSON: no accessors, hidden/symbol/inherited data, functions, cycles, holes, undefined, nonfinite or negative-zero values. Exact allowlists apply to new history/step/command/merge/pair/context structures; never silently strip or normalize accepted native metadata.
2. Validate baseline with the **unchanged pre-merge schema-1 validator**, including all original seed IDs, active graph links, uniqueness, contiguous old receipts and existing ownership membership rules. It has no mergeHistory or merge actions. Preserve every baseline record/receipt key and value. Its sequence B is the first merge receipt number. Generated baseline IDs must satisfy existing numeric suffix `< B`; no record numbered 0200 can be captured at receipt 0050 merely because final sequence is 0500.
3. This boundary honestly means “legacy graph accepted when the first merge was made.” Earlier legacy receipts retain their existing validation strength. Do not claim reconstructed past command/creation/actor facts that were never recorded. Valid legacy imports can enter this boundary by previewing a real first merge; they are not rewritten merely by reading. Unsupported or invalid legacy sources refuse the first merge without repair.
4. Build typed ID indexes for each current step. Starting from a detached baseline, execute each strict step through a shared **neutral deterministic CRM transition kernel** that imports neither persistence, UI, storage nor controller. Native model wrappers and validator call this same concrete kernel, not copies or free-text inference. Extracting current pure reducers without changing old semantics is a prerequisite; persistence supplies no runtime service that imports itself.
5. Ordinary steps are exactly today's finite CrmEvent union; account transfer has exactly `{type:'transfer-account',companyId,newOwnerId,expectedOwnerId}` and existing complete-graph/owner/200-row rules. Preserve existing native string/email/amount normalization in actual commands, but store their validated canonical values once. Replaying cannot coerce/repair malformed stored commands. Actor is a canonical ID/role pair, label omitted. Enforce ordinary write and ownership-transfer authority at that replay position. This journal integration covers every accepted create, qualify, convert, assign, transfer, stage and task action **after** first merge, because any can affect later chronological proof.
6. For a merge step, recompute section 5's entire closure from the then-active graph, establish historical same-owner authority there, apply only section 4's mutation, and generate exactly one merge activity with exact complete captures. The source must exist then and be distinct from retained. Unique typed retirement and active-only references prevent source reuse, resurrection, cycles and aliases granting authority. A later source may be an earlier retained record; full captures then reflect all genuinely intervening ordinary/ownership changes.
7. Every step receipt is exactly the next native `MOCK-CRM-<sequence padded4>`; advance the existing sequence once. Current newest-first activity must equal the replay's exact output, with the unchanged baseline suffix. Compare every final active table, order, field and sequence to the replayed result. Generated records exist only from the baseline boundary or their actual later create/convert step. Future-created or unrelated closure members fail before they can be used. No historical lookup substitutes an archived ID for a live edge.
8. At every merge validate the live graph; no dangling company/contact/lead/opportunity/task relations. At final import, missing seed company/contact IDs are allowed **only** when that exact typed source was demonstrably retired during replay; all other seeds remain mandatory. Later transfer, stage, task completion and new linked records are validated forward, so they do not require old snapshots to equal today's mutable rows. Earlier ownership receipts keep exact bytes: pre-boundary ones validate against baseline; later ones against the actual replay position.
9. Approved finite caps: 100 merge steps, 1,000 total post-boundary steps, 200 records per merge closure, arrays <=10,000, depth <=100 and inspected nodes <=300,000; complete serialized CRM save envelope <=2,000,000 characters. Each command refuses before its limit is exceeded; no prune/retry. Capacity is an explicit sample-workspace state with export guidance. Existing legacy absence is not retroactively forced into these new journal limits. Replaying uses linear bounded steps/indexed graph scans, not recursive alias search or exponential inverse reconstruction.

Implementation review qualification: the concrete kernel derives bounded graph indexes and detached copies per step. The earlier v2 plan proposed building shared indexes once; Agent 0 accepted the simpler per-step implementation after independent semantic review, with all caps and exact replay checks preserved. No worst-case timing, allocation or Windows performance claim is made.

The post-first-merge ordinary receipt wrapper is the smallest required additional journal integration in this strategy. New CRUD fields, generic editing, timestamps, segmentation, communication and a retrospective rewrite of older CRM history are **optional future expansion and excluded**. An alternative compact per-merge capture cannot be substituted without independently proving the same creation/owner/membership cases; its limitation is now explicit.

Every post-boundary ordinary wrapper must evaluate once against the actual synchronous latest full-state updater and latest canonical actor, so a still-rendered ordinary callback cannot overwrite a newer merge/journal. This is the necessary journal-preservation integration; do not turn it into a second store or duplicate command retry. Reads and no-op/refused ordinary actions do not append steps.

## 7. Private preview/controller and latest-state acceptance

The scoped child receives a capability port, current permitted choices/report page, safe status and these public DTOs only. It receives no full workspace, baseline, journal, setter, source serialization/digest, private binding, candidate state or function that returns them. Existing privileged ownership confirmation's serialized full workspace must not be copied into this public merge boundary.

Suggested port: `report(pageRequest)`, `groupMembers(request)`, `preview(selection)`, `confirm({kind,handle})`, `cancel(handle)`. Preview returns `{ok:true,handle,preview}` or generic `{ok:false,code,message}`. Public preview contains schema/policy/selection, common owner, source/retained full field table, exact allowed before/after values, all declared linked/context rows and conflict warnings, exact proposed receipt and final envelope character count. Every returned row/count is accessible to that actor. Hidden global email conflicts return no partial DTO/handle. Preview keeps all accepted domain/save bytes unchanged.

One trusted document controller privately binds complete canonical source, actor ID/role, normalized strict selection, policy version, exact public preview facts, replacement epoch and mounted scope generation. Approved existing-pattern limits: secure random 256-bit handles, no fallback, 8 live, 4,000,000 captured characters aggregate, 10-minute monotonic expiry and 4,096 ever-issued handles per lifetime. Evict oldest live to fit; never reuse consumed nonces. Public handle contains no source data. Wrong-family/malformed confirmation consumes a safely supplied own data-property handle without invoking getters.

Role/shape authorization precedes target lookup and happens again inside the actual latest-root synchronous `replaceCurrent(latest => ...)` callback. Recheck whole source content (same sequence is insufficient), actor, policy, selection, epoch and generation there. Build and full-validate one candidate exactly once, then accept that single complete memory result/save attempt. Do not use a render-captured replacement or reconstruct full authority from `scopedCrmState` (`sequence:0`). Preview/rejection/cancel create no receipt, journal or baseline.

The trusted provider supplies synchronous current-source and replacement-epoch accessors to the host only. An accepted identical-data import/restore still invalidates an earlier handle before another React commit. Each public port is permanently bound to its concrete controller lifetime; disposal cannot revive an old callback against a new controller. A fresh lifetime uses a new port and keyed child scope.

One accepted merge creates one native receipt and one step. Same-branch replay refuses with no save or second activity. Edit, cancel, identity/mode change, unmount and any import/Reset/selective restore/Undo invalidate the handle; identical-data replacement still advances epoch and stales it. React StrictMode must not dispose a newly reused controller or preserve a disposed callback. Old-backup replacement starts a new branch; callbacks from the old branch cannot survive it.

## 8. Historical privacy after transfer

Active directory, candidate report, dashboard and action choices use current ownership only. Historical captures never grant current scope. Do not forward raw new merge activities through the current activity projector to representatives; its existing admitted-object pass-through is an integration point to change deliberately.

| Identity | Historical merge surface |
| --- | --- |
| Owner / sales manager | Full historical merge capture and ordered lineage, clearly labeled as captured-at-receipt; current labels are separate and only from accessible current records. |
| Auditor | Same established global read scope, immutable historical captures; no mutation or confirm capability. |
| Representative who owned the merge at its receipt | Safe historical DTO only: receipt/action, historical owner ID, source/retained typed IDs, policy and captured changed/context counts. Replace new merge description with fixed historical text; no captured names/emails/amounts/full snapshots or current hidden joins/counts. Ordinary pre-existing activity descriptions retain their established recorded-owner behavior. |
| New current representative owner after transfer | Current active graph and current advisory report. No earlier other-owner merge receipt/capture/lineage is synthesized into their scope. A fixed notice for all representatives explains that this page lists receipts recorded in their ownership scope; no per-record hidden-history count or existence hint. |

A former owner does not acquire today's graph by clicking historical IDs. A new owner does not receive the former owner's private capture through lineage resolution. No alias fallback looks up hidden labels. Owner-level backup remains a separately disclosed complete local snapshot capability; UI role selection is not provider authentication, and this design does not claim browser storage secrecy.

## 9. Dirty work, focus and UI states

Register separate meaningful draft groups `crm:merge:contact` and `crm:merge:company` using current synchronous refs and normalized baselines. Filters/report pages are not dirty. Edits invalidate the old preview/handle but preserve exact raw selection/text. Successful actual memory acceptance rebases only its merge form; cancel, stale/permission/capacity/graph refusal rebase nothing. Keep/Discard and route/identity changes use existing unsaved-work capabilities. Retain may be offered only where the mounted/volatile owner actually keeps the draft; no false promise after a scoped unmount.

Visited inner CRM tabs remain mounted in hidden containers, so their explicit Leave and keep draft choice retains actual owners. Returning to a registered dirty form first reveals its tab, then focuses its control. Hidden merge projections remain fresh and reauthorized; Preview and Apply still require the live CRM route and merge tab. A feature-capacity refusal keeps the same keyed draft owners with raw IDs only, clears stale preview facts and disables Preview with a nearby reason. It does not discard or rebase ordinary or merge drafts.

Retiring a record must not erase unrelated live form text. If a selected contact/company/opportunity option becomes unavailable, render an explicit selected unavailable-ID option and require a deliberate new valid choice. Do not silently alias it to retained, select the first option, lose name/email/title/amount text, or mark unrelated groups clean. Fresh defaults may be accepted only for a truly empty/default form under its existing normalized rules.

Preview names scope and consequence explicitly; Apply is separate from Preview, and Cancel returns exact focus to the opener while keeping literal selections. Control labels remain the exact visible field name across available and unavailable states; unavailable-selection help is a separate linked description through `aria-describedby`. Keep editing returns focus to the actual owning form. Stale/invalid/refused/no-candidates/cross-owner/expected-link/over-limit/pagination/accepted-in-memory/storage-warning states have visible text and non-color meaning. No action requires drag, pointer-only controls or a truncated graph. Test keyboard order, exact opener, x-large narrow layout and readable monochrome captures of new dialogs/comparisons.

## 10. Size, imports and combined recovery

Preflight exact final string: `JSON.stringify({schemaVersion:1,module:'crm',data:next}).length`; include baseline, journal, full captures, duplicate-contained provenance, escaping and the native envelope overhead. Refuse known >2,000,000 characters before acceptance; canonical validation must also reject non-JSON/lossy substitutions without repair. Equality is field-content equality with deterministic object-key ordering; array order is meaningful. Quota failure remains accepted memory with its existing storage warning/export path. No automatic checkpoint requirement or browser-wide transaction is added by a merge.

Single import, combined export/import, selected restore, restore-point Undo and Reset must all use the same complete validator. A missing history arm remains missing; a malformed/own-undefined/empty arm is not legacy absence. Unknown version/keys, missing step, altered old receipt, forged actor/owner/member, duplicate retirement, forward-created ID, wrong chain, changed captured field, dangling edge or final replay mismatch refuses the whole incoming workspace. Existing preference/checkpoint bindings, rollback failure behavior, selected-only writes, dirty decisions and replacement epochs remain unchanged.

Recovery inspection retains current primary active-table/activity totals. Add stable **nested** identities: merge capture `(receipt,source|retained,kind,id)`, changed pair `(receipt,kind,id)`, context `(receipt,kind,id)`; add metadata identities for history presence/baseline boundary and journal receipts. Captured baseline tables/old activity are contained provenance, not additional primary entities. Safe metadata may expose kind, IDs, policy, owner/actor ID, receipt, counts and explicit presence/omission; never names/emails/reason/description/money or before/after content. Complete private values still participate in hidden-content differences. Extend comparison ordering in both directions so history removal back to legacy absence is visible; no duplicate primary-count inflation.

## 11. Verification required before original acceptance

Use independent hand-authored complete expected records/receipts/raw save slots, not results computed by the model under test. Browser tests use real forms or actual valid user-file imports, explicit Preview/Apply/Cancel, normal role switches and existing recovery controls. No state-setter injection or weakened console/network/a11y checks. Preserve failed diagnostics.

| Original | Required actual observation plus focused proof |
| --- | --- |
| WX-0369 | Valid whitespace company and cross-table email groups; expected converted pair; both representatives/owner/manager/auditor scopes; exact accessible paging and no hidden arrays/counts; full state/export/raw-save nonmutation. |
| WX-0370 | Exact retained/source fields and all declared linked rows; mixed-owner/hidden selection refusal before confirm; cancel and exact opener/selection retention; visible converted email/company policy and hidden-collision generic refusal. |
| WX-0371 | Complete literal contact result with reciprocal lead/opportunity/contact coherence, all statuses, tasks exact, one receipt/step, duplicate callback/replay refusal, ordinary actions after merge, fresh reload/export/import and retired-chain negatives. |
| WX-0372 | Exact company source/target contacts/opportunities/context/tasks and company-name/contact-name warning groups, classifications and IDs before any write; no inferred secondary merge. |
| WX-0373 | Complete same-owner company result, all graph edges once, unchanged unconverted name-only leads/other owners/old activities, full IDs in receipt, chronological import and selected restore/Undo survival. |

Required chronology pairs: transfer → merge → later transfer; contact then company and company then contact chains; merge → advance opportunity → complete task → create linked contact/opportunity/task → export/import; later retirement of an earlier changed/retained record. Successful histories must preserve every prior activity byte. Pair each with forged unrelated affected member/owner, omitted or extra closure member, generated ID from a later receipt, changed immutable baseline/pair, active source resurrection and cyclic alias/refused retired selection. Validate old no-merge fixtures unchanged and use truthful legacy-boundary classification, not a claim of authenticating imported history.

“Immutable” here means accepted native actions keep prior captures exact and imports must replay coherently; it is not a cryptographic authenticity claim about user-authored local JSON. A deliberately supplied, internally valid fictional branch remains an import capability under existing confirmation/recovery rules. A negative baseline/capture test changes a claimed fact without the required consistent replay/output; it does not promise to detect every coherently authored alternative history.

Cross-cutting proof: 200/201 distinct typed rows; approved finite journal caps; exact-envelope size/escaping; memory-only quota outcome; full same-sequence changed-content stale; identity/epoch/identical-data replacement/unmount/expiry/cancel/wrong-family handle invalidation; source/fixture policy binding; current and former representative nested-DTO privacy after transfer; only submitting form rebased; unavailable selections visible; actual Keep/Discard/focus/retained navigation; unchanged HR/CMS/unrelated slots and restore preferences; separate readable status/shape witnesses. Model proofs complement actual browser journeys; final required CI and publication checks remain Agent 0 gates.

## 12. Implementation lanes and acceptance boundary

The payroll checkpoint is published and the contract policies are approved. Freeze shared types, then allocate separate neutral reducer/replay/codec, private controller/projection, UI/dirty integration, recovery inspection, independent review and literal real-browser lanes. Native wrapper changes after first merge are required for this selected proof strategy; legacy absence continues through the existing path. Do not simultaneously assign shared CRM files to multiple owners. No new duplicate seeds, active sample records or generated acceptance statuses belong in reusable blank templates.

This design does not accept WX-0369–0373. Agent 0 owns the plan, task state, source integration, README/wiki/SYSTEMX updates, CI and Git publication. Canonical completion requires the original criteria and the actual observations in section 11.

## 13. Read-file fingerprints

```text
fbef9b656e5e286d3a6a22a93487a905e7909482b64972a33c5c90d86e91bed8  src/crm/model.ts
513a052d85d9f3107869b71ed4fd8c71b35da484111fd44f7a123da045ed6ab0  src/crm/ownership.ts
1b4e2dcc0e4c44c5ac65b2256e49e5159f4580cc4d381dcb352717078b4c2170  src/crm/persistence.ts
5d2703a94ce2bcb75c1d72d68ae8d64c14df77e2d48b57ac95c7699c8b85501c  src/crm/CrmDemo.tsx
186c9b29a0ce2d74b81bacba0713675ea85713bc452d1ee6a5dc26927b96a726  src/portals/combined-backup.ts
1e84b45222b119e9d02e75efa1ba251584353ef0ff2142db5350f009e2797cce  src/portals/restore-workspaces.ts
f5f7db3ae4ff9c70edb4c3dfd7052075c0b5f3fe3e7c36333ebf311ff0623e14  src/portals/unsaved-work-core.ts
7ea3895df10dc73752ee5fb622f3fed08957f0a4d031485d09b1a2747fda05ed  src/portals/useDemoPersistence.ts
0163551a49238c81a9a16aa5de80eeedd723ce257885f4fae6d585958b7a2e46  src/portals/workspace-inspection.ts
5dd06613faf50dc6e525f4aeb8f65c8378582ed9f48aa6388527a3457e7a1970  src/hr/payroll-control-controller.ts
e6a38ce600cfdeb95cf0bb397ab587409ee725eeef2b345d4ff1a64589294bc0  docs/backlog/webappx-1000-todo.json
```

The shared inspector/payroll controller fingerprints describe the initial read boundary. Their separate payroll/setup acceptance is recorded in [the payroll/setup QA receipt](PAYROLL-SETUP-QA-2026-10-15.md). The catalog fingerprint above belongs to the pre-acceptance planning source; current canonical statuses are read from the catalog. No CRM merge test is inferred from those earlier results.
