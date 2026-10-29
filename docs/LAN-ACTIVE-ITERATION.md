# LAN active iteration — font revisions and draft previews

Updated 2026-10-28 from published baseline `42886165e315f8d7b6c89c754d2b81221a9c7972`.

This bounded goal is complete. Agent 0 accepted **LAN-00051–LAN-00060** at
candidate `781b624bc322c4d851fa3dfc91a165a087dea5d7` after both browser suites,
all 68 CI stages and separate Hosting preflight passed. The program is now
**85/10,000 requirements and 17/2,000 capabilities**, a delta of ten requirements
and two capabilities from 75 requirements / 15 capabilities. There are 9,915
requirements remaining. Read the
[font/preview receipt](LAN-FONT-PREVIEW-QA-2026-10-28.md) for exact bindings,
retained failures and verification limits. Prior conflict acceptance remains
preserved in its [original receipt](LAN-CONFLICT-REVIEW-QA-2026-10-26.md).

## Selected work and acceptance

| Requirements | Capability | Observable acceptance | State |
| --- | --- | --- | --- |
| LAN-00051–LAN-00055 | Refresh revisions after guarded font changes | A confirmed font save requires the observed stylesheet revision, exposes the resulting revision, and lets an open stylesheet draft detect the change without losing its draft or loaded baseline. | Accepted |
| LAN-00056–LAN-00060 | Bind previews to source baselines | A literal draft snapshot records its source path, loaded baseline, draft digest and freshly observed revision; explicit checks report changed or unavailable source without promoting the preview to disk. | Accepted |

All five lanes of each capability are receipt-bound and accepted. This does
not complete F001 or the wider program. The generated queue now identifies:

- LAN-00076: recover revision-bound local drafts.
- LAN-00081: export a conflict comparison.
- LAN-00086: inspect source revision history.

Those capabilities and their remaining lanes stay TODO. The generated plan owns
exact readiness and prerequisites; querying it does not start work.

## Completed execution sequence

1. Verified the clean checkout, direct GitHub main revision and owned local services;
   inspected the LAN Work sources board and opened the local project and this plan.
2. Added raw stylesheet revisions to project-font reads and guarded writes. Check
   the observed revision before source, backup, operation or temporary effects;
   preserve existing confirmation, path, origin, token and encoding controls.
3. Added literal draft preview snapshots and read-only freshness checks in the
   existing Code inspector. Preserve the source draft, loaded baseline and
   independent raw/leaf editing authority through changes, failures and races.
4. Extended the real HTTP and disposable browser tests. Exercise matching, stale,
   missing and no-op fonts; exact source/backup bytes; literal preview content;
   edits and file-selection races; and zero promotion from preview actions.
5. Reviewed the frozen functional candidate and ran `npm run ci:all`, separate
   Hosting preflight, host drift and template checks. Before any owned runtime
   restart, export its emulator data; leave unrelated listeners untouched.
6. Bound only verified requirements to the tested commit and public receipt;
   regenerate the checklist, update README/wiki and host documentation, verify
   metadata, publish authorized normal fast-forward main/wiki updates and read
   them back. Record exact local entry points and a resume handoff.

## Board and local project check

The live LAN **Ops → Agent 0 → Work sources** view correctly reports blank
reusable task/focus seeds, no adopted project scope, and the separate original
WebAppX catalog at **179 recorded completions / 821 proposed TODO**. Its empty
root task ledger does not mean that the LAN program is finished. The generated
[LAN plan](LAN-10000-EXECUTION-PLAN.md) and [family checklist](backlog/lan-10000/F001.md)
own this program's accepted counts and next queue.

Runtime URLs, process identities and emulator data remain private session state.
Recheck `.SYSTEMX/state/local-session.json` and `npm run systemx:session:status`
before process control; a recorded ready flag needs a fresh endpoint probe.

## Ownership and controls

Agent 0 owns integration, goal state, plan, documentation, acceptance and Git.
One UI owner, one backend/API owner and one isolated-browser owner edit separate
paths, with an independent reviewer. Worker completion alone accepts nothing.

The draft preview is bounded literal source inspection. It does not execute
untrusted HTML/JSX or claim compiled canvas equivalence. Freshness is an observed
comparison with a single allowlisted file, not a filesystem lock or automatic
merge. Confirmation and current revision preconditions remain mandatory for
source or font saves. The familiar structure/canvas/inspector layout remains.

The original WebAppX catalog stays **179 done / 821 remaining**; its historical
foundation bundle remains unapplied and unaccepted. Reusable context, task, plan
and memory seeds stay blank. Managed snapshots and both checksummed research
packages remain immutable. Production deployment requires separate explicit
operator authorization.

See the [generated program plan](LAN-10000-EXECUTION-PLAN.md),
[checklist index](backlog/LAN-10000-TODO.md) and
[source revision receipt](LAN-SOURCE-REVISION-QA-2026-10-26.md).

## Verified result and savepoint

The final source suite passed 37 groups plus four normal 336 px inspector geometry
checkpoints; actual-stack Navigator passed 16 groups; npm tests passed 49 with no
skips; all 68 CI stages and Hosting preflight passed. Browser runs exposed and
verified repairs for CSS inventory, clipped revision feedback, full-reload
selection cleanup and explicit page-picker context. Earlier failed/qualified
proofs and interrupted CI attempts remain separate.

README, wiki and host documentation are updated alongside exact checklist
acceptance. The final private handoff records source/wiki publication readback,
owned runtime URLs/processes, emulator export/import provenance and the next
ready queue. Runtime facts must be rechecked when resuming. Production deployment
remains unperformed; the managed release and reusable seeds remain unchanged.
