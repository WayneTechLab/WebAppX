# LAN active iteration — draft recovery, comparison export and revision history

Updated 2026-10-29 from published baseline `ba8b0bbda8b7ef0c044dfe243448e646b793a66f`.

This goal is **in progress**. It completes the remaining three capabilities in
an explicitly selected five-capability source-editor group and records a real
Home-page GUI edit proof. Font revisions and literal draft previews are already
accepted; they are retained as prerequisites and regression coverage, with no
new completion counted for them.

The accepted baseline remains **85/10,000 requirements and 17/2,000 capabilities**,
with **9,915 requirements TODO**. The prior
[font/preview receipt](LAN-FONT-PREVIEW-QA-2026-10-28.md) binds LAN-00051–LAN-00060
to tested candidate `781b624bc322c4d851fa3dfc91a165a087dea5d7`. Its 37 source-browser
groups, four inspector geometry checkpoints, 16 Navigator groups, 49 npm tests,
68 CI stages and Hosting preflight are historical observations of that candidate;
they do not accept the new work. Earlier conflict acceptance remains in its
[original receipt](LAN-CONFLICT-REVIEW-QA-2026-10-26.md).

## Selected work and acceptance

| Requirements | Capability | Observable acceptance | State |
| --- | --- | --- | --- |
| LAN-00051–LAN-00055 | Refresh revisions after guarded font changes | Confirmed font saves check the observed stylesheet revision and expose the result while keeping an open raw draft and its independent baseline. | Previously accepted |
| LAN-00056–LAN-00060 | Bind previews to source baselines | Literal snapshots retain their path, loaded revision and draft digest; source checks report freshness without source promotion. | Previously accepted |
| LAN-00076–LAN-00080 | Recover revision-bound local drafts | Explicitly opted-in recovery retains the source path and baseline; reopening compares current source before offering a deliberate draft restoration. | In progress; all five requirements TODO |
| LAN-00081–LAN-00085 | Export a conflict comparison | Show the bounded download scope, then require explicit confirmation before including the draft, path and revisions in the exported comparison. | In progress; all five requirements TODO |
| LAN-00086–LAN-00090 | Inspect source revision history | Show bounded local revision evidence and distinguish confirmed builder saves from observed external changes without promoting source. | In progress; all five requirements TODO |

Each new capability includes behavior, boundaries/refusal, recovery, feedback
and verification requirements. Source implementation, worker completion or a
passing focused test does not accept those lanes. The real Home GUI proof is
additional integration evidence, not an extra catalog completion.

## Dependency closure and acceptance target

The validated ready queue contains exactly three behavior requirements:

- LAN-00076 depends on accepted LAN-00010 and LAN-00025.
- LAN-00081 depends on accepted LAN-00030.
- LAN-00086 depends on accepted LAN-00015 and LAN-00050.

All 35 external requirements in their transitive prerequisite closure are already
accepted. The selected fifteen requirements have no missing dependency outside
the accepted baseline and this batch. Each capability's boundary, recovery and
feedback lanes depend on its behavior; its terminal evidence lane depends on all
four earlier lanes. These remain unaccepted until Agent 0 reviews their proof.

Accepting all fifteen would produce **100/10,000 requirements and 20/2,000
capabilities**, complete the 100 requirements of **F001 only**, and leave 9,900
requirements in the wider program. This is an acceptance target, not current
status. The original WebAppX catalog remains **179 done / 821 remaining** and its
saved foundation bundle remains unapplied and unaccepted.

## Execution and evidence sequence

1. Reconcile the checkout, published baseline, exact definitions, saved handoff,
   Work sources board and owned local service identities. Recheck live endpoints
   separately from recorded readiness. Keep reusable outer project seeds blank.
2. Implement bounded, explicitly opted-in draft recovery. A recovery record is
   local source text, with clear scope and a deliberate restore decision. Read
   the current allowlisted source and compare its revision before offering
   restoration; retain drafts and records through refusal or unavailable storage.
   Restoring a draft must not authorize or perform a repository save.
3. Implement a bounded comparison export with visible inclusion scope and fresh
   confirmation. Inspect the actual browser download and its exact path, revision
   and text fields. Cancellation, stale input and export failure retain the draft
   and create no repository, backup or operation effects.
4. Implement bounded read-only revision history. Label confirmed source/font
   operations separately from observed external revisions; preserve their actual
   provenance and unknown cases. Reading history must not write source, recreate
   missing files, create backups or invent confirmed operations.
5. Run focused model/API tests and owned disposable browser journeys covering
   matching, stale, malformed, missing and bounded inputs; storage faults; explicit
   recovery/export decisions; literal text handling; pending-response races; and
   exact source, backup, operation and temporary-file effects. Preserve the
   existing source/font/preview, inspector geometry and Navigator contracts.
6. Perform the authorized real Home-page edit through the LAN GUI. Record the
   intended visible change, exact source path, prior and resulting byte revisions,
   explicit confirmation and exact predecessor backup. Read back the file and
   rendered Home page at the owned Vite origin, then record the change's final
   disposition. This real integration proof remains separate from disposable
   fault fixtures and from any production acceptance.
7. Freeze the functional candidate and bind all proof to its exact files and
   revision. Review source/documentation freshness without relabeling historical
   receipts. Await terminal browser results, `npm run ci:all`, separate
   `npm run deploy -- hosting --preflight`, `npm run sync:system:check` and
   `npm run template:check`. Preserve failed or interrupted attempts honestly.
8. Agent 0 accepts only verified LAN-00076–LAN-00090 against their original
   definition digests, tested commit and a public dated receipt containing exact
   completion tuples. Only then update the progress ledger and regenerate the
   checklist, counts and next queue. Update README/wiki and host status, publish
   authorized source/wiki changes, read them back and write a precise handoff.

## Plan, code, function, working and production delta

| Evidence boundary | Current state | Completion evidence needed |
| --- | --- | --- |
| Plan and checklist | Three new capabilities selected; accepted baseline stays 85/17. | Fifteen exact receipt-bound acceptances before generated checkmarks change. |
| Code | Accepted font/preview code is the baseline; recovery/export/history work is in progress. | Reviewed frozen implementation with bounds, revision checks and preserved source authority. |
| Function | Prior tests remain historical; the three new workflows are not yet accepted. | Terminal matching/stale/refusal/recovery/feedback tests and complete isolated browser receipts. |
| Working local project | Local service ownership and rendered behavior need fresh observation. | Owned endpoint probes, actual Navigator regression and real Home GUI save/readback evidence. |
| Production and provider state | This plan authorizes no production deployment or provider activation. | Source/wiki publication readback is recorded separately; deployed acceptance requires its own explicit operator authority and evidence. |

## Ownership and controls

Agent 0 owns integration, the goal, acceptance, real Home GUI proof, README/wiki,
QA receipts and Git. Assigned UI, recovery/history/API and browser owners work on
separate paths; this iteration document and later freshness decisions have their
own documentation owner. Worker results remain subject to independent review.

The familiar structure/canvas/inspector layout remains. Preserve session token,
Host/Origin, path containment, secret-shaped content refusal, explicit source/font
confirmation and current-revision preconditions. Recovery and exports disclose
source-text storage or inclusion; history and literal preview observations grant
no save authority. A single-file hash is an observation, not a filesystem lock,
automatic merge, compiled-canvas guarantee or Git cleanliness claim.

Runtime URLs, process identities, browser saves, emulator data and private proof
paths stay outside tracked release files. Before process control, recheck the
private session record and `npm run systemx:session:status`; export owned emulator
data before a controlled restart and leave unrelated listeners untouched.
Managed release snapshots and both checksummed research packages stay immutable.
Reusable context, task, plan and memory seeds remain blank. New observations do
not change the dates or scope of prior receipts.

See the [generated program plan](LAN-10000-EXECUTION-PLAN.md),
[F001 checklist](backlog/lan-10000/F001.md),
[checklist index](backlog/LAN-10000-TODO.md) and
[source revision receipt](LAN-SOURCE-REVISION-QA-2026-10-26.md).
