# LAN F003/F004 identity and ownership iteration plan — locally accepted 2026-10-31

This bounded plan selects the authored [F003](backlog/lan-10000/F003.md)
**LAN-00201–LAN-00300** and [F004](backlog/lan-10000/F004.md)
**LAN-00301–LAN-00400** requirements. Read the
[operator guide](LAN-IDENTITY-OWNERSHIP.md),
[active iteration](LAN-ACTIVE-ITERATION.md),
[F002 source policy](LAN-SOURCE-POLICY.md) and
[generated execution plan](LAN-10000-EXECUTION-PLAN.md). The source of exact
capability outcomes, dependencies and five requirement lanes is the
[authored foundation specification](../.SYSTEMX/LAN/Backlog/specs/01-foundation.json);
this table is a review map,
not a replacement definition.

Agent 0 accepted exactly **LAN-00201–LAN-00400** at final functional candidate
`aea59e748f9e9b6f1c953e1cf05b08db51a4d1f0`, serially accepting F003 before
F004 after terminal integrated qualification. Read the
[current QA receipt](LAN-IDENTITY-OWNERSHIP-QA-2026-10-31.md).
**Current accepted state is 400/10,000 requirements and 80/2,000 capabilities**;
**F001–F004 are complete, with 9,600 requirements remaining TODO**. The starting
200/40 baseline belonged to completed F001/F002; previous completion objects and
the original authored definitions remain unchanged. The original WebAppX
179/821 checklist is a separate historical scope.

Each five-ID group below retains the authored lane order: observable behavior,
boundaries/refusal, recovery/reversibility, operator feedback, verification
evidence. Completion requires all five lanes and their exact prerequisite
closure. Worker commits, source reviews and a passing subset of tests are inputs
to Agent 0, not acceptance.

## Dashboard UX addition — locally verified

The active candidate also addresses the user's clipped menu/component forms,
long submenu descriptions, misplaced header dropdown and preview viewport shifts.
Read the [dated dashboard UX review](LAN-DASHBOARD-UX-2026-10-31.md) for the
observed geometry, official research sources and implementation decisions.

Shrinkable sidebar grids, bounded native fields, wrapped metadata and correct
responsive cascade priority keep controls inside the selected panel width.
Compact focus keeps pin preferences and removes hidden panes from keyboard
focus. The workspace menu aligns with its right-edge header trigger and scrolls
within available height. Short action labels retain visible constraints/status;
long explanations move behind Help/More info and workspace metadata disclosures.
Selection details no longer enlarge the primary canvas header.

Ordinary Inspect selection and metadata refresh preserve the chosen preview
preset/width. Interact delivers normal app clicks and SPA navigation without
changing the selected device. Explicit reveal/route actions retain their own
intended navigation behavior. The responsive browser stage checks panel/form,
header/menu, keyboard and footer geometry plus viewport/device continuity;
its final C4 run supports 25 locally verified layout groups. The actual
fixed 393 px preset renders exactly 393 px of iframe content. At a 1164 px
operator width, panel resizing produced actual/readout 777/777 then 765/765;
returning from the fixed preset to Fit reported 765/765. Native Help disclosures and right-aligned header/menu geometry retain
keyboard access and bounded content.

This UX support adds no authored requirement or extra catalog acceptance. The
[Code-OSS fork plan](LAN-VSCODE-FORK-PLAN.md) and
[32 unchecked additive TODOs](backlog/LAN-VSCODE-FORK-TODO.md) remain a separately
planned custom editor program; no fork/build/native install is implied.

## F003 — durable document and node identity

| IDs | Authored capability | Bounded evidence target |
| --- | --- | --- |
| 00201–00205 | Assign stable document identities | Repeat one source import; isolate another document and workspace. |
| 00206–00210 | Assign stable page identities | Change label and inventory order without changing reviewed source identity. |
| 00211–00215 | Assign stable node identities | Repeat anchored import without relying on a live DOM handle. |
| 00216–00220 | Reject duplicate node identifiers | Refuse duplicate authored anchors and preserve old accepted map/source. |
| 00221–00225 | Preserve identity across sibling reorder | Reorder compatible unique siblings; retain the same qualified IDs. |
| 00226–00230 | Reconcile renamed source files | Review exact `renameFrom` path and evidence; refuse ambiguous transfer. |
| 00231–00235 | Distinguish replacement from modification | Change tag/anchor evidence; retire old ID rather than retarget references. |
| 00236–00240 | Resolve explicit authored identifiers | Validate static `data-systemx-id` syntax, uniqueness and document scope. |
| 00241–00245 | Bound fallback identity matching | Match only unique parent-qualified signatures; leave repeated siblings unresolved. |
| 00246–00250 | Inspect identity provenance | Display anchor/allocation, confidence and current preview representation status. |
| 00251–00255 | Maintain identity aliases during migration | Retired-to-current alias with provenance; refuse loop and cross-document target. |
| 00256–00260 | Reject cross-document identity confusion | Identical text/route/node labels cannot resolve another document's reference. |
| 00261–00265 | Invalidate identities after workspace switches | Clear transient references and reject old workspace-qualified authority. |
| 00266–00270 | Locate objects by durable reference | Resolve exact `{workspaceId,documentId,nodeId}` or report contained missing/ambiguous status. |
| 00271–00275 | Report orphaned durable references | Retain retired target provenance without attaching it to a nearby node. |
| 00276–00280 | Compare identity maps before import | Display stable preserved/added/retired/ambiguous counts and bounded proposal digest. |
| 00281–00285 | Version identity mapping rules | Record `identity-v1`; rule mismatch needs explicit reviewed migration. |
| 00286–00290 | Preserve identities in document export | Metadata-only export and same-workspace compatible reopen preserve IDs, clear transients. |
| 00291–00295 | Test identity collision isolation | Matching relative paths in two temporary repos cannot cross-authorize. |
| 00296–00300 | Explain identity confidence | Distinguish explicit, heuristic, reviewed-migration and unresolved in inspector. |

## F004 — source ownership and mapping

| IDs | Authored capability | Bounded evidence target |
| --- | --- | --- |
| 00301–00305 | Label source-owned objects | Show authored source authority and exact supported literal fields. |
| 00306–00310 | Label document-owned artifacts | Require generated boundary and provenance; no generator operation inferred. |
| 00311–00315 | Label hybrid ownership boundaries | Declare disjoint field owners; overlapping authority blocks writes. |
| 00316–00320 | Expose unmapped preview elements | Show unavailable source write without guessing path from rendered text. |
| 00321–00325 | Inspect exact source spans | Check bounded UTF-16 span, fingerprint and raw-byte revision. |
| 00326–00330 | Show adapter write capabilities | Report literal support; style/structure/generated remain unsupported. |
| 00331–00335 | Refuse ambiguous literal mappings | Repeated compatible source occurrences refuse while retaining the draft. |
| 00336–00340 | Detect mapping revision drift | Changed raw source revision marks map stale before another operation. |
| 00341–00345 | Map shared shell elements | Header/footer/navigation identify shared owner and broader impact. |
| 00346–00350 | Map route-specific content | Reviewed route and source inventory isolate same text on other pages. |
| 00351–00355 | Inspect generated output provenance | Show declared source document/generator/output revision without regeneration authority. |
| 00356–00360 | Preview ownership changes | Digest-bound metadata proposal lists changed fields, paths and affected objects. |
| 00361–00365 | Detect conflicting owner claims | Overlapping spans/fields keep both claims visible and block writes. |
| 00366–00370 | Separate instance and definition ownership | Instance fields cannot silently alter shared definition structure. |
| 00371–00375 | Track read-only source regions | Opaque/JSX expression region keeps metadata and stays read-only. |
| 00376–00380 | Respect external component ownership | External internals remain read-only; explicit property contract only. |
| 00381–00385 | Compare mapping coverage | Count mapped/partial/stale/unmapped/conflict within selected scope. |
| 00386–00390 | Explain operation impact ownership | Show every declared owner/shared artifact; missing evidence refuses proposal. |
| 00391–00395 | Validate source maps after promotion | Revalidate affected spans at new revision; no unrelated repair. |
| 00396–00400 | Export ownership diagnostics | Qualified IDs, modes, reasons and spans only; no bodies/private runtime data. |

## Implementation boundary and review waves

1. **F003 core and adapter.** Validate an opaque workspace ID, deterministic
   document/page IDs, static authored anchors, bounded signatures, exact source
   spans and strict graph/reference limits. Use the installed TypeScript parser
   to inspect direct F002-eligible TSX without executing it. Maintain accepted
   maps in service memory only. A proposal does not mutate accepted state.
2. **F003 reconciliation and UI.** Preview preserved/added/retired/ambiguous
   nodes, explicit rename and retired-ID aliases; reject duplicate anchors,
   cycles, invalid references and ambiguous fallback matches. Accept only a
   matching digest and `ACCEPT IDENTITY MAP` after re-reading current eligible
   source/workspace. Expose qualified references and confidence in the inspector;
   export and reopen only compatible same-workspace metadata.
3. **F003 integration review and acceptance.** Agent 0 wires protected API and
   the real Code inspector, obtains terminal independent tests and rendered
   browser evidence, and reviews all 100 original F003 lanes. Only then may
   Agent 0 add exact completion receipts and progress bindings for 00201–00300.
4. **F004 ownership and literal proposal.** Build mode/status/coverage reports
   from accepted maps. Require explicit nonoverlapping owner claims, source
   revision, span fingerprint, unique literal occurrence, qualified reference
   and adapter support. Read-only opaque/external/shared-definition cases retain
   provenance. Ownership preview/accept has a separate digest and
   `ACCEPT OWNERSHIP CHANGE`. A literal operation is a proposal only; a source
   save remains in the existing guarded editor/backup/diff/confirmation path.
5. **F004 integration review and acceptance.** Exercise real API/GUI behavior
   and negative/refusal/recovery cases after F003 acceptance. Agent 0 reviews
   all 100 F004 lanes and adds exact completion bindings only after terminal
   evidence for this F004 candidate. Publication is a later separate gate.

The service limits are 50 accepted documents, 1,000 nodes per document, 256
aliases, 120-character labels, 1 MB source, 400 KB proposal/export and 1,000
diagnostics. No added dependency, arbitrary TSX execution, automatic source
write or saved runtime body is in scope. The API must keep existing LAN session,
Origin/Host and body-limit guards and return contained error codes. Protected
paths and blank reusable seeds remain intact. Managed release snapshots,
original upstream fingerprints, both research packages/checksums,
React/Vite/Firebase, production/brand kits and setup/session controls stay in
their existing ownership domains; see [SYSTEMX integration](SYSTEMX-INTEGRATION.md).

## Qualification matrix

Use temporary synthetic repositories with exact source/backup/temp fingerprints
before and after each metadata-only path. Fixtures should cover stable repeat
import, reorder, changed label, changed anchor/tag, duplicate explicit ID,
indistinguishable siblings, rename, alias loop/cross-document target, orphan,
rule mismatch, two workspaces with matching relative paths, oversized/malformed
input and partial/opaque/external/shared component cases. Confirm prior accepted
maps survive refused preview, accept, ownership claim and reopen.

Test revision-bound literal proposals for exact UTF-16 span/fingerprint, repeated
occurrences, changed bytes, stale expected revision, conflicting owners,
unsupported operations and post-promotion revalidation. Compare all unaffected
source and backup fingerprints. The served API must refuse malformed references,
missing/foreign documents and stale proposals with contained codes, without
source bodies or absolute paths in responses. Read-only status must not import.

Rendered browser proof must use the actual served inspector and selected route,
including keyboard labels, readable 320 px layout, status announcements, draft
retention, stale response ordering, explicit confirmation, exports/reopen and
visible shared-impact/coverage/refusal states. Inspect downloaded JSON contents
and size. A browser harness or unit suite should cover the **40 capability
groups** with distinct observable, refusal, recovery and feedback evidence;
there is no requirement for 200 identical tests. Record exact revision, commands,
terminal outcomes, artifact hashes, protected-path fingerprints, failing attempts
and their terminal reruns. Mac-local synthetic results do not prove native
Windows x64/ARM64, authenticated provider execution or production delivery.

## Completed Agent 0 integration and acceptance workflow

1. Observed the selected repository, clean source base and required preservation
   boundaries; worker source base was `6d6c7d21132a37d31b328fc7ab3ec1000f837072`.
2. Prepared bounded packets and pinned the installed provider. The first dispatch
   refused launcher drift before running a provider; the fresh run retained that
   guard rather than weakening it.
3. Ran ten authenticated Codex CLI workers in independent generation worktrees.
   Agent 0 retained their source/evidence and committed scoped outputs where the
   child sandbox refused Git metadata.
4. Reviewed and merged the ten owned branches locally. Preparing or integrating
   F004 implementation did not grant its acceptance before F003.
5. Integrated the protected identity/ownership APIs, explicit metadata proposals,
   controlled editor bridge and responsive GUI under Agent 0 ownership.
6. Repaired independently demonstrated ambiguity, span/ownership, export/reopen,
   generated-source, route, UI staleness and layout issues; preserved each failed
   attempt and its scope.
7. Froze C4, awaited terminal unit/API/browser, aggregate 73-stage CI and separate
   Hosting preflight, and retained exact source/asset/preservation evidence.
8. Kept C2's interrupted CI and C3's failing legacy F002 selector separate from
   C4's terminal pass; C4's single test-only direct-child selector repair changed
   no C3 runtime/UI source.
9. Accepted all original F003 lanes first, then dependent F004 lanes with exact
   definition/source/evidence tuples. Regenerated/validated 400 accepted
   requirements and 80 capabilities, preserving the previous two hundred.
10. Reconciled plan/README/wiki and kept publication/readback as a separate final
    delivery handoff. Source publication does not establish native device state,
    live swarm PR operation or production deployment.

Worker output, local integration, terminal qualification, catalog acceptance and
provider publication remain separate facts. No phase bypassed stale source,
conflicting claims, failed tests, catalog dependencies or deployment authority.

## Integration delta after local acceptance

Ten authenticated Codex CLI workers completed in isolated generation worktrees;
Agent 0 retained scoped branches, committed outputs where the child sandbox
refused Git metadata and merged the ten branches locally. Provider execution,
local integration, GitHub delivery and catalog acceptance are distinct gates.
The first dispatch was correctly refused after the launcher changed after
pinning; no provider started in that attempt, and the guard was retained.

The actual source-identity inspector is integrated with protected API routes,
qualified live-preview observations and the existing controlled editor. New
unit/API, independent review and owned-browser development runs exposed and
repaired namespace, rename/allocation, descriptor validation, export integrity,
source-span authority, ownership proposal, route, generated-readonly and UI
staleness issues. Earlier failed attempts remain evidence rather than passes.

Final C4 passed **73 ordered CI stages**, retaining the previous 70 and adding
identity unit/API, identity browser and responsive-layout browser stages. Its
terminal coverage includes **140 identity unit/API tests**, **40 identity and
ownership browser capability groups**, **25 layout groups**, **114 core tests**,
**32 local synthetic swarm tests**, **55 source groups plus seven geometry
checks**, **16 Navigator groups** and separate Hosting preflight. The
[candidate-bound QA receipt](LAN-IDENTITY-OWNERSHIP-QA-2026-10-31.md) owns exact
commands, artifacts, preservation counts, reviews and retained failures.

C2 CI exited 130 after stage 51 for the Fit-readout repair. C3 CI exited 1 at
stage 65 because the old F002 selector matched four summary elements; C4 uses its
direct child and changes no runtime/UI code from C3. Only the final C4 terminal
results support this acceptance. Current progress is **400/80**, with **9,600
requirements TODO**. The original WebAppX catalog remains 179/821.

The narrow read model does not complete the full Designer kernel, structural/
style editing, actual swarm PR approval, native IDE/Windows qualification or
deployment. The fork's 32 additive TODOs remain planned/unaccepted and no custom
editor has been built. Final source/wiki revisions and provider readback are
recorded in the separate delivery handoff, not asserted by this local plan.

Exports initialize an ignored private runtime integrity key when needed; they
exclude source bodies/readable labels/credentials and preserve same-backend
round trips. Metadata operations do not write source, predecessor backups or
operation logs. Owned-fixture browser promotion separately tests an explicit
stage, confirmed save, exact backup and post-save mapping revalidation.
