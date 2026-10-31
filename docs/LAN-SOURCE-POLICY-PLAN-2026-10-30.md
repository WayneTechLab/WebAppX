# LAN F002 source-policy execution plan — locally accepted 2026-10-30

The selected next-hundred execution plan for **LAN-00101–LAN-00200** is locally
complete. Agent 0 accepted its exact one hundred requirement bindings at
functional candidate `e1588c4ebe94b1ef5f1557641334d95aee9b8290` after terminal
verification. Read the [current QA receipt](LAN-SOURCE-POLICY-QA-2026-10-30.md)
and [source-browser guide](LAN-SOURCE-POLICY.md).
It supplements the generated [LAN execution plan](LAN-10000-EXECUTION-PLAN.md)
and [F002 checklist](backlog/lan-10000/F002.md), whose authored acceptance
criteria and dependency graph remain authoritative. The current work pointer is
[LAN active iteration](LAN-ACTIVE-ITERATION.md).

Starting source publication: `d0cfb5c9f378e08f557fd6089af70385f0acd475`.
The previous tested functional candidate was
`04813b380cda7656650db752049a8e0661c55bc5`; its final wiki publication was
`85bc60ee48e2f65c2f9f1380cd7ed4f3b3bcd748`. Prior evidence is retained in the
[recovery/history QA receipt](LAN-RECOVERY-HISTORY-QA-2026-10-29.md) and
[GUI walkthrough](LAN-TEMPLATE-GUI-WORKFLOW.md). Those results qualify their
stated revision and scope, not the new code automatically.

## Outcome and immutable selection

Deliver repository-relative source selection, read eligibility and guarded
write-path decisions through usable LAN controls. Refuse linked paths,
traversal, unsupported extensions and private/runtime targets with contained
errors. Keep the previous valid editor draft when a requested path is refused
or disappears. Explain eligibility and supported write kinds without exposing
private directory inventories.

F001's one hundred accepted requirements satisfy F002's family prerequisite.
For each capability below, its behavior requirement depends on every F001
terminal evidence requirement. Its boundaries, recovery and feedback lanes
depend on behavior; its evidence lane depends on all four preceding lanes.
Selecting the complete family does not bypass those acceptance dependencies.

Current acceptance is **200/10,000 requirements and 40/2,000 capabilities**.
**F001 and F002 are complete; 9,800 requirements remain TODO.** This batch added
exactly one hundred F002 requirement objects while preserving the previous one
hundred and their order. The starting 100/20 count belongs to the historical
F001 baseline above. The separate original WebAppX checklist stays 179 done /
821 remaining; its historical foundation bundle is outside this selection.

Each five-ID range has the same ordered lanes: observable behavior, boundaries
and refusal, recovery and reversibility, operator feedback, verification evidence.
The compact table is a navigation aid and does not replace the exact authored
requirements in [F002](backlog/lan-10000/F002.md).

| Requirements | Original capability | Required observable result |
| --- | --- | --- |
| LAN-00101–LAN-00105 | Browse eligible source files | Only regular policy-eligible repository files appear, with bounded results and explicit omissions. |
| LAN-00106–LAN-00110 | Filter source by allowed extension | Extension filtering narrows eligible metadata without expanding read policy. |
| LAN-00111–LAN-00115 | Explain source path refusals | Stable contained reason categories avoid neighboring private filenames and content. |
| LAN-00116–LAN-00120 | Resolve repository-relative source paths | Canonical paths are accepted; absolute, traversal and ambiguous encodings are refused before a picker file request. |
| LAN-00121–LAN-00125 | Detect linked source ancestors | Linked parents and linked final files remain refused. |
| LAN-00126–LAN-00130 | Identify supported source write kinds | Each eligible file states supported reviewed write kinds; structural editing remains unavailable. |
| LAN-00131–LAN-00135 | Display source size before opening | Bounded size metadata precedes opening; oversized reads report their limit without partial content. |
| LAN-00136–LAN-00140 | Separate generated and authored files | Generated origin is visible and generated files remain read-only absent an explicit reviewed ownership rule. |
| LAN-00141–LAN-00145 | Protect runtime and backup paths | Runtime state, ingest, logs and source backups are excluded from browse and manipulated queries. |
| LAN-00146–LAN-00150 | Handle source case differences | Exact path casing is retained and ambiguous case aliases cannot select another file. |
| LAN-00151–LAN-00155 | Retain safe selections across refresh | Valid selections survive; invalid picker selections clear without positional replacement or lost drafts. |
| LAN-00156–LAN-00160 | Search source metadata | Search covers eligible filenames and declared tags without body or secret indexing. |
| LAN-00161–LAN-00165 | Inspect source rule provenance | Active rule identifiers are distinguished from proposed access changes. |
| LAN-00166–LAN-00170 | Preview a path policy proposal | Exact affected eligible paths can be reviewed temporarily without applying policy or opening bodies. |
| LAN-00171–LAN-00175 | Compare source access policies | Reviewed rule additions/removals and selections losing eligibility are reported read-only. |
| LAN-00176–LAN-00180 | Handle unavailable source encodings | Unsupported encodings are reported and existing drafts survive without lossy replacement. |
| LAN-00181–LAN-00185 | Bound source directory traversal | Depth/count budgets and truncation are explicit; links and excluded trees are not expanded. |
| LAN-00186–LAN-00190 | Show source access by workspace | The selected repository boundary is visible and cross-workspace inventory cannot grant write selection. |
| LAN-00191–LAN-00195 | Remember nonsecret source navigation | Opt-in preferences retain only eligible path/filter metadata, revalidated before content or operations. |
| LAN-00196–LAN-00200 | Export an eligible source inventory | Explicit export contains public eligible metadata and policy decisions, without bodies or private/runtime values. |

## Completed local execution waves

| Wave | Implementation and review scope | Exit evidence |
| --- | --- | --- |
| 1 — Policy core | Centralize canonical paths, active rule provenance, exact case checks, linked-ancestor refusal, strict encoding, size limits, generated ownership and bounded inventory. Root integrates the module with server reads and guarded writes. | Temporary-repository unit/API tests cover both eligible behavior and contained refusals, including no source/backup/log effects. |
| 2 — Picker and editor continuity | Add extension/search filters, metadata and workspace feedback, explicit inventory refresh, canonical manual selection and opt-in navigation. Preserve loaded path, draft, original base and outstanding authority across omissions and superseded reads. | UI helper tests and browser readbacks cover valid selection retention, invalid picker clearing, filter omissions, missing/refused targets and cross-workspace responses. |
| 3 — Read-only review and export | Expose active rules and a bounded reviewed proposal/comparison. Add explicit metadata-only inventory download with clear scope. No apply or policy-authority endpoint is introduced. | Exact rule/affected-path assertions, bounded/truncated results and downloaded artifact checks; unchanged protected fingerprints across review/search/export. |
| 4 — Integrated qualification | Independently review the frozen functional candidate and exercise affected source flows and actual LAN controls. Retain earlier F001 regression coverage and every failed/development attempt with its terminal rerun. | Revision-bound test receipts, browser trace/screenshots, asset/input hashes, preservation manifests and owned-process cleanup evidence. |
| 5 — Acceptance and delivery handoff | Required aggregate gates reached terminal success; Agent 0 accepted exact F002 tuples and regenerated/validated deterministic views. README/wiki and host metadata reconcile the accepted scope. | Candidate-bound CI/preflight and exact one-hundred new acceptances preserve the prior one hundred. Source/wiki publication revisions and remote readback belong to the separate final delivery handoff rather than an unchecked implementation task. |

Implementation used disjoint file scopes under Agent 0 while tests and
documentation were prepared. Worker results were review inputs; Agent 0 owned
integration, real GUI qualification and exact acceptance. Publication remains
its separate delivery gate. Readiness reports and this plan create no new
provider authority.

## Qualification matrix

The fixture suite must include regular eligible files, nonfiles, absent files,
linked files and linked ancestors, recursive links, canonical and case-alias
paths, unsupported extensions, malformed/oversized content, generated files,
excluded private/runtime paths and inventories exceeding declared budgets.
Evidence must explain whether each case exercises pure policy logic, server API,
synthetic browser fixtures or the actual local app.

Browser proof must inspect the visible picker, feedback and normal inspector
geometry. It must show no surprise file selection, no destructive replacement
from a refused load, no body requests from metadata-only actions, no implicit
content load from remembered navigation and no reused write authority across
workspace changes. Explicit exports must be inspected for contents, bounds and
omissions. Filtering, comparison and export must not write source, backups or
operation logs.

The final candidate passed `npm run ci:all` with all **70 ordered stages** and
separate `npm run deploy -- hosting --preflight`; both preserved **2,078 tracked
input fingerprints**. It also passed **114 core unit/API tests**, **32 local
synthetic swarm tests**, **20 F002 browser capability groups**, **55 source
regression groups plus seven geometry checks**, and **16 Navigator groups**.
The [QA receipt](LAN-SOURCE-POLICY-QA-2026-10-30.md) records exact scope,
independent reviews, negative/refusal evidence, retained failures and artifacts.
Metadata checks are separate from this functional qualification.

Host drift and template consistency remain publication/mirror checks through
`npm run sync:system:check` and `npm run template:check`. Retain first failures
and terminal reruns separately; a different functional revision is not silently
qualified by these historical results.

## Additional operating scope

The owner also selected the [host swarm operating extension](SYSTEMX-SWARM.md)
with Agent 0/X/Y/Z/Alpha, bounded independent CLI generations, guarded PR
integration and revision-bound IDE/Codex handoffs. Its
[operational map](SYSTEMX-SWARM-MAP.md) and
[access matrix](SYSTEMX-SWARM-ACCESS-MATRIX.md) are host-owned documents beside
the blank reusable seeds. This operating work is tracked and qualified
separately: it neither changes F002's authored definitions nor supplies extra
catalog acceptances. Its twenty stepwise commands and ten-slot ceiling passed
32 local synthetic tests; no authenticated-provider session, live swarm PR
merge, permissions change, IDE acceptance or production deployment is inferred.
The [manifest schema](../.SYSTEMX/swarm/manifest.schema.json) records configured
inputs. Blank map/access seeds and immutable installed releases remain intact.

## Completion and delivery delta

| Boundary | Accepted local result and separate delivery scope |
| --- | --- |
| Planned | Exactly F002's original one hundred requirements were selected; definitions and dependencies remain unchanged. |
| Coded | Frozen candidate `e1588c4` passed independent review while retaining source-revision/confirmation, Host/Origin, token and path guards. |
| Functional | Terminal core/API, F002 browser, source/Navigator and synthetic swarm results support their stated positive/refusal/recovery/feedback scope. |
| Working locally | Actual Home source-browser filtering, traversal refusal, read-only policy review/export and preserved fingerprints were read back without new Home source writes. |
| Accepted | Public receipt tuples bind exact IDs, definition digests and full candidate revision. Counts are 200/10,000 and 40/2,000 with previous acceptance objects exact. |
| GitHub delivery | README/wiki and host metadata describe local acceptance; exact publication SHAs and fresh remote readback are recorded in the separate final handoff. No push is asserted by the local plan. |
| Production | Hosting preflight passed with app 3.4.0/deployment count 0 unchanged. No production deployment or authenticated live swarm lifecycle was performed. |

Keep the reusable context, plan, task and memory seeds blank. The active work
belongs in host-owned execution records, not in immutable release snapshots.
Preserve the selected managed SYSTEMX 1.9.0-alpha.6 release, original import
fingerprints, both research packages/checksums, React/Vite/Firebase application,
brand/production kits and existing setup/session workflows. Installation/import
behavior is governed by [SYSTEMX integration](SYSTEMX-INTEGRATION.md) and is
outside this batch.

Runtime values, browser artifacts and local paths belong in private execution
receipts. Before restarting an owned session, recheck the live record, export
owned emulator data and retain its import provenance. Never stop an unrelated
listener. At handoff, record exact revisions, terminal evidence, accepted counts,
publication readback and a concrete next action without treating service startup
as dataset or production acceptance.
