# LAN active iteration — font revisions and draft previews

Updated 2026-10-28 from published baseline `42886165e315f8d7b6c89c754d2b81221a9c7972`.

The current bounded goal continues F001 source revisions with confirmed font
changes and source-bound draft previews. The accepted baseline remains
**75/10,000 requirements and 15/2,000 capabilities**. The ten requirements below
remain TODO until their exact definitions, tested revision and public receipts
are accepted. Prior comparison, missing-source and replacement acceptance is
preserved in the [conflict review receipt](LAN-CONFLICT-REVIEW-QA-2026-10-26.md).

## Selected work and acceptance

| Requirements | Capability | Observable acceptance | State |
| --- | --- | --- | --- |
| LAN-00051–LAN-00055 | Refresh revisions after guarded font changes | A confirmed font save requires the observed stylesheet revision, exposes the resulting revision, and lets an open stylesheet draft detect the change without losing its draft or loaded baseline. | In progress |
| LAN-00056–LAN-00060 | Bind previews to source baselines | A literal draft snapshot records its source path, loaded baseline, draft digest and freshly observed revision; explicit checks report changed or unavailable source without promoting the preview to disk. | In progress |

Both behavior requirements are dependency-ready at this baseline. Their
boundary, recovery, feedback and evidence lanes remain pending as part of the
same selected batch. Acceptance would add ten requirements and two capabilities;
it does not imply completion of F001 or of the wider LAN program.

## Execution sequence

1. Verify clean checkout, direct GitHub main revision and owned local services;
   inspect the LAN Work sources board and open the local project and this plan.
2. Add raw stylesheet revisions to project-font reads and guarded writes. Check
   the observed revision before source, backup, operation or temporary effects;
   preserve existing confirmation, path, origin, token and encoding controls.
3. Add literal draft preview snapshots and read-only freshness checks in the
   existing Code inspector. Preserve the source draft, loaded baseline and
   independent raw/leaf editing authority through changes, failures and races.
4. Extend the real HTTP and disposable browser tests. Exercise matching, stale,
   missing and no-op fonts; exact source/backup bytes; literal preview content;
   edits and file-selection races; and zero promotion from preview actions.
5. Review the frozen functional candidate. Run `npm run ci:all`, separate
   Hosting preflight, host drift and template checks. Before any owned runtime
   restart, export its emulator data; leave unrelated listeners untouched.
6. Bind only verified requirements to the tested commit and public receipt;
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
