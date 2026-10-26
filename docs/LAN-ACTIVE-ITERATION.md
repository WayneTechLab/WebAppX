# LAN active iteration — source conflict review

Updated 2026-10-26 from published baseline `ca6acec6e6780ac738b4ad3e87006a5052f7358a`.

This iteration completed three F001 capabilities: compare a retained
source draft with the current file, preserve drafts when source becomes
unavailable, and explicitly review and confirm an intentional replacement.
Accepted result: **75/10,000 requirements and 15/2,000 capabilities**, a delta of
15 requirements and three capabilities from the 60/12 baseline. The
[acceptance receipt](LAN-CONFLICT-REVIEW-QA-2026-10-26.md) binds exact definitions
and the tested candidate. Source/wiki publication is verified in the final handoff.

## Selected work and acceptance

| Requirements | Capability | Observable acceptance | State |
| --- | --- | --- | --- |
| LAN-00026–LAN-00030 | Compare retained drafts with current source | Read current source without changing the draft or its loaded revision; show both revisions and changed lines; choose neither version automatically. | Accepted |
| LAN-00031–LAN-00035 | Detect externally removed source | Report unavailable source, retain the draft and loaded revision, and refuse source recreation or backup/log effects. | Accepted |
| LAN-00041–LAN-00045 | Confirm intentional conflict replacement | Review the exact current source and proposed replacement, then separately confirm a save against that reviewed revision; a later external change still conflicts. | Accepted |

The last capability depends on the comparison evidence and already accepted
revision preconditions. The other accepted F001 requirements remain unchanged.
Verified result: **75 requirements / 15 capabilities**, with 9,925 requirements
remaining. The generated plan owns the next dependency-ready queue. Remaining
F001 history, preview, font and recovered draft work stays in the [family checklist](backlog/lan-10000/F001.md).

## Execution sequence

1. Reconcile the published source, exact checklist definitions, saved handoff,
   managed instructions and active local process ownership.
2. Implement bounded read-only comparison and explicit replacement review in the
   existing Source inspector. Backend reads and writes report unavailable files
   without weakening containment, confirmation or revision checks.
3. Run isolated tests for comparison safety, draft retention, source removal,
   changed review inputs, stale replacement and exact backup bytes. Retain the
   existing source-editing and Navigator browser checks.
4. Commit the functional candidate, run all required CI stages, separate Hosting
   preflight and host drift checks. Preserve the owned emulator data before any
   runtime restart; leave unrelated listeners untouched.
5. Bind only verified requirements to the tested commit and public QA receipt;
   regenerate checklists, update README/wiki and host status, check metadata,
   publish normal fast-forward main and wiki updates, and read them back.
6. Record the next dependency-ready queue and a precise resume handoff. Complete
   this bounded goal only after its accepted publication and verification.

## Findings repaired before aggregate acceptance

- The real workspace-refresh browser case reproduced a dropped selector entry for
  an open file removed externally. Preserve its bound draft and target, then
  verify availability through a source read; a partial inventory is not proof
  of deletion. The final 21-group source browser run covers the repaired case.
- Independent review found that request chunks were decoded separately, allowing
  split multibyte UTF-8 content to change before saving. A streaming decoder now
  preserves state across chunks; the actual chunked HTTP regression verifies exact saved text,
  returned revision and backup.
- Browser actions after a completed save must wait for refresh and explicitly
  return to the Source inspector when retained preview selection opens Settings.
  Earlier incomplete or failed runs remain evidence of those attempts, not passes.

## Ownership and controls

Agent 0 owns integration, goal state, documentation, acceptance and Git. One UI
owner, one backend owner, one browser-test owner and one plan-renderer owner work
on separate paths. Their work is reviewed before integration; worker completion
alone does not accept requirements.

The Source inspector retains the familiar structure/canvas/inspector layout.
Comparison reads use text rendering, explicit size/work bounds and no source
promotion. A review binds its file, draft and current revision; changed inputs
invalidate it. A separate explicit save uses the existing source endpoint and
`SAVE LOCAL CHANGE` confirmation. There is no force-save bypass or implied merge.
Existing independent raw/leaf baselines, valid UTF-8/BOM and uniform CRLF behavior
remain required. This iteration does not claim edited mixed-line-ending or
invalid-UTF-8 preservation, operating-system locking or a multi-file transaction.

The original WebAppX catalog remains **179 done / 821 remaining** with its saved
foundation bundle unapplied. Reusable context, task, plan and memory seeds stay
blank; managed snapshots and both checksummed research packages stay immutable.
No production deployment is authorized by this plan.

See the [generated program plan](LAN-10000-EXECUTION-PLAN.md),
[checklist index](backlog/LAN-10000-TODO.md) and
[first batch receipt](LAN-SOURCE-REVISION-QA-2026-10-26.md).
