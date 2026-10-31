# SYSTEMX host swarm

WebAppX's host swarm combines Agent 0, Agent X, Agent Y, Agent Z and Alpha above
managed SYSTEMX **1.9.0-alpha.6**. The selected release remains immutable. Its
standard `agent-y` commands retain the existing single-job lifecycle; the host
swarm is a separate executable surface and policy.

| Role | Owns |
| --- | --- |
| Agent 0 | Selected tasks/scopes/budgets, the sole canonical integration checkout, evidence acceptance and configured merge requests. |
| Agent X | Observed runs/checks/reviews/PRs/merge/cleanup events with original times and revisions. |
| Agent Y | At most ten authorized independent CLI slots, each with one task generation, branch and worktree. |
| Agent Z | Independent review of the exact change and evidence; no self-approval or automatic acceptance from a score. |
| Alpha | Independent aggregate integration assurance and bounded policy-lease gate under Agent 0; no unrestricted supervisor or authority override. |

Read the complete [swarm operating contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-SWARM.md),
[operational map](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-SWARM-MAP.md)
and [access matrix](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-SWARM-ACCESS-MATRIX.md).
They are host-owned records beside the public blank map/access seeds; the
reusable template keeps those seeds and its task/context/plan/memory records blank.

## Branch, PR and reassignment lifecycle

Agent 0 selects a bounded task, observed base, provider and allowed paths. A
worker generation owns an isolated branch/worktree. Keep its PR open when review
or checks require revision. Automatic merge is allowed only for the exact
repository/PR/head/base after accepted independent review, terminal passing
required checks, a current Alpha lease/gate, no conflicts and provider protection.
No self-approval, administrative bypass or skipped check is introduced.

Read back the remote PR and target revision after merge. Only accepted work and
verified merge permit separately checked cleanup. `close` retains branches and
worktrees by default. Optional `--delete-branch` refuses ignored worktree data,
creates and verifies a private unlinked regular Git bundle of the exact original
worker ref/head within 128 MiB, records its SHA-256, rechecks origin, then verifies
remote/local removal. Preserve ignored files
separately: a Git bundle does not include them. Preserve cancelled unmerged, dirty, unpushed or unowned work. A free
worker slot starts its next task with a fresh generation branch; it does not
reuse merged history.

## Mac IDE and Codex handoff

Each handoff identifies repository/checkout, branch/revision, task generation,
observed dirty state, evidence and owner. Drift invalidates dependent action
until the receiving surface reobserves current state. A file panel, saved packet
or chat title does not prove synchronized source, inherited credentials or
running CLI workers. Keep private paths, prompts, tokens and process data in
ignored host-local state.

## Host commands

Run `node .SYSTEMX/swarm/cli.mjs --help` in the selected repository. An explicit
private schema-1 manifest pins repository/base, tasks/scopes/checks, concurrency
budget and merge policy. Commands are `plan`, `next`, `status`, `prepare`, `sync`, `run`,
`verify`, `review`, `alpha`, `feedback`, `integrate`, `publish-plan`, `publish`, `ready`,
`merge-plan`, `merge`, `observe-merge`, `accept`, `close` and `advance`. Every
mutation needs `--apply`; read-only plans grant no authority. `next --slot N`
proposes dependency-ready work without dispatching or reusing an old branch.

Z review is separate from the Alpha lease, which lasts 1–15 minutes and binds
the exact task/generation/base/head/check/review snapshot. Merge observes
GitHub strict required checks, required approval, stale-review dismissal and
administrator enforcement. It uses GitHub's immediate REST merge endpoint
through `gh api --method PUT`, with the exact `sha` and `merge_method=squash`
after fresh Alpha/base checks. There is no deferred queue or administrator
bypass. An uncertain write remains pending for observation/manual resolution;
it is not retried automatically. Merge, acceptance and closure verify the
intended PR target plus exact current merge or verified ancestry. Acceptance
remains separate from delivery.

This is a stepwise controller rather than an installed background scheduler.
Agent 0 invokes each command and reuses slots only through verified new
assignments. The immediate merge request must pass the current Alpha lease;
no deferred GitHub auto-merge queue is submitted. A later `observe-merge` call
only records provider state and cannot turn an open PR into accepted work.
Remote lifecycle operations wait for owned workers/checks to finish.
Publication retries first query existing matching PRs to recover uncertain
creation without blindly opening a duplicate.

Within a wave, `integrate` merges a verified new target into the clean owned
worker branch and invalidates old checks/Z/Alpha. Conflicts are preserved for
manual review without automatic rebase, force-push or resolution. New task
generations wait for all current slots to close and the clean local/base/remote
`advance` barrier.

The [full command/effect table](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-SWARM.md#implemented-host-command-surface)
records options, private state, preserved defaults and refusal boundaries.

## Qualification boundary

Inspect the host runtime's current help and tests before executing its commands.
The controller records review/assurance/acceptance digests as operator assertions;
it does not authenticate independent identities or read referenced reports.
Provider/check output is bounded to counts/hashes, so retain original readable
evidence separately. This trusted local CLI controller is not an OS sandbox.
Native Windows worker/check execution is refused; POSIX process-group cleanup
does not qualify detached descendants. Execution sidecars retain observed
PID/group/controller/time/generation/lease facts before packet delivery. A
controller crash needs manual ownership audit rather than an automatic kill
or retry from a potentially stale PID.

A local fixture or dry run qualifies its stated policy behavior; it does not
prove ten live provider processes, a GitHub merge, branch deletion, installed
Windows cleanup or IDE acceptance. Source publication needs full CI and Hosting
preflight. Production deployment needs a separate operator instruction.

Swarm operating support is separate from the next one hundred F002 LAN
requirements. Read the [active iteration](https://github.com/WayneTechLab/WebAppX/blob/main/docs/LAN-ACTIVE-ITERATION.md)
and [source-policy plan](https://github.com/WayneTechLab/WebAppX/blob/main/docs/LAN-SOURCE-POLICY-PLAN-2026-10-30.md)
for those original requirements and acceptance counts. For ordinary new-app
single-job setup, use [Agent Y setup](Agent-Y-New-App-Setup.md).

## Local qualification — 2026-10-30

Functional candidate `e1588c4ebe94b1ef5f1557641334d95aee9b8290` passed all 70 required CI stages and separate
Hosting preflight, including **32 swarm tests**. The previous 27 local orchestration
regressions remain and five tests cover drive/UNC/POSIX syntax plus actual macOS
root and no-link behavior. Ten synthetic CLI processes overlapped in distinct
worktrees; local Git and fake REST responses exercised the full qualified lifecycle.
This is not native Windows, authenticated AI-provider, real GitHub merge, running
IDE or production qualification. Read the [candidate-bound QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/LAN-SOURCE-POLICY-QA-2026-10-30.md).
