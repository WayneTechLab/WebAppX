# SYSTEMX host swarm — Agent 0, X, Y, Z and Alpha

This WebAppX host extension defines a supervised swarm above managed SYSTEMX
**1.9.0-alpha.6**. It preserves the selected release and its original import
fingerprints. The managed `SYSTEMX.sh agent-y` commands keep their existing
single-job and PR behavior; the host swarm is a separate execution surface.
Read [SYSTEMX integration](SYSTEMX-INTEGRATION.md) before changing installation
or import behavior.

The owner has authorized bounded parallel CLI work and automatic PR integration
under the host policy. This is authority to perform the configured lifecycle,
not permission to bypass reviews, provider branch protection, failed checks or
production approval. A role name or policy file does not authenticate a worker,
start a CLI, prove a GitHub merge or establish task completion.

Use the [operational map](SYSTEMX-SWARM-MAP.md) and
[access matrix](SYSTEMX-SWARM-ACCESS-MATRIX.md) with this guide. These host records
sit beside the reusable blank `.SYSTEMX/PLAN/MAP.md` and
`.SYSTEMX/GLOBAL/ACCESS-MATRIX.md`; the public template keeps those seeds blank.
Adopted projects populate their own records deliberately.

## One coordinator and five responsibilities

| Role | Responsibility | Boundary |
| --- | --- | --- |
| Agent 0 | Select authorized tasks, scopes, provider configuration and budgets; assign generations; own integration, acceptance and the canonical checkout. | Only Agent 0 writes the canonical integration branch or accepts catalog/task completion. |
| Agent X | Observe real run/check/review/PR/merge/cleanup events with occurrence time, recording time, exact revision and original evidence. | It neither schedules execution from a recorded due item nor changes task acceptance. |
| Agent Y | Execute at most ten concurrently authorized CLI worker slots, each owning one bounded task, generation branch and isolated worktree. | Workers cannot share a writable checkout, accept their own results, or write canonical main. |
| Agent Z | Independently inspect the exact change and evidence; return findings and acceptance recommendation using the selected review policy. | A favorable score does not grant merge authority or replace required checks. |
| Alpha | Independently evaluate aggregate integration conditions and the current policy lease, including revision, ownership and evidence freshness. | Alpha cannot widen its lease, approve its own implementation, override Agent 0, or grant production authority. |

The ten-worker limit is a ceiling, not a target. Existing app/IDE agents and CLI
processes consume the same project resource budget. Assign only useful,
dependency-ready, nonoverlapping work within the available host and provider
capacity. Registered roles, reserved slots and prepared jobs are distinct from
running processes.

## Assignment and generation contract

Each assignment identifies the selected repository and project scope, existing
task/requirement IDs, acceptance criteria, exact observed base revision, allowed
paths, worker slot and generation, isolated branch/worktree, installed provider
and reviewed invocation, required checks, time/resource limits, evidence
destination, and stop conditions. Use argument arrays for child processes.
Keep prompts, credentials, tokens, executable paths, private outputs and runtime
state in ignored local storage rather than portable release records.

One worker slot may serve successive tasks. Each new task or invalidated
assignment gets a **fresh generation and fresh branch** from a newly observed
base. Reusing a slot does not reuse merged history or old acceptance. Preserve
old receipts and result commits. A review requiring changes returns work to the
same open task branch while that assignment remains valid; do not close and
recreate its PR merely because the first review failed.

A changed remote base, changed worker head, retargeted PR, altered allowed paths,
expired lease or superseded evidence invalidates the corresponding integration
decision. Reobserve the state, update the bounded assignment where authorized,
and obtain new review/check evidence for the resulting candidate. Never repair
stale state with a reset, force-push or broadened write scope by default.

## Automatic integration gate

The host policy delegates an automatic integration step to Agent 0 only while
all required conditions are true for the same immutable candidate:

1. The repository identity, GitHub destination, PR identity, intended base
   branch, exact base revision and exact worker head match the assignment.
2. The branch belongs to that task generation, its changes stay within the
   reviewed scope, and no conflicting canonical writer or worktree owns it.
3. Required project checks have terminal passing results for the exact candidate.
   Unknown, pending, failed, cancelled or mismatched checks do not pass.
4. Agent Z's independent review is accepted for that change/evidence revision;
   required findings are resolved. The author cannot substitute self-approval.
5. Alpha confirms the integration lease is current and its constraints still
   match the observed repository, candidate, review and checks.
6. GitHub reports the PR open, mergeable and free of unresolved conflicts, with
   all required branch-protection conditions met. The merge uses the expected
   head; a provider race must refuse or require fresh observation.

There is no administrative bypass, self-approval, skipped check, unconditional
merge or automatic production deployment. Agent 0 records acceptance against
the original criteria and retained evidence; PR existence, a CLI exit code and
a merged branch are separate delivery observations.

After a merge request, read the remote PR and target branch again. Record
verified merge/closure and resulting revision only from that readback. If the
outcome is uncertain, retain the branch/worktree and reconcile the existing PR
before retrying. A merged PR is already closed by GitHub; do not close an
unmerged PR as a shortcut to successful integration.

## Cleanup and reassignment

A failed check or review keeps the result and PR available for revision. A
cancelled unmerged PR may be closed only under its authorized cancellation
policy; preserve its branch/worktree and evidence for deliberate disposition.

After accepted work and a verified remote merge, cleanup must recheck the exact
owned branch head and worktree state, preserve a verified recovery artifact,
and refuse dirty, unpushed, unowned or unexpectedly changed material. The host
`close` command retains branches/worktrees by default. Its optional
`--delete-branch` path refuses ignored worktree data, creates a private Git
bundle, verifies that bundle and its exact worker branch head, and records its
SHA-256 before any remote or local branch removal. The bundle preserves the
original worker commits even after a squash merge. Preserve ignored data
separately before attempting retirement; it is not included in a Git bundle. Remote
branch deletion must be followed by remote absence verification. Local branch
or worktree removal needs its own ownership and preservation checks. A cleanup
failure is reported as remaining cleanup, without changing a verified merge
into a failed merge or inventing deletion success.

Reassign a free slot only after its previous process is terminal and ownership
is reconciled. The next assignment uses a fresh generation branch. Never reuse
an active slot merely because a timeout elapsed or a worker stopped sending
updates.

## Mac IDE and Codex continuity

The Mac IDE and Codex app may inspect the same repository while separate
workers use independent worktrees. Handoffs identify the checkout/repository,
branch, source revision, task generation, dirty-state observation, evidence
snapshot, current owner and exact next action. Local absolute paths stay in
private host handoffs; shared records use contained references and repository
identity.

Before either surface performs a dependent action, compare its handoff revision
and generation with fresh Git and runtime observations. A changed source,
branch, dirty state or task generation makes the old handoff stale. Invalidate
its action authority and load the new bounded context; do not silently pull,
reset, overwrite files, copy session tokens, or infer that chat history has
synchronized. Opening a file panel does not verify that an IDE or CLI is using
the intended revision.

## Implemented host command surface

The host entry point is `.SYSTEMX/swarm/cli.mjs`; use its help from the selected
repository. It does not install/authenticate a provider or choose an account:

```bash
node .SYSTEMX/swarm/cli.mjs --help
node .SYSTEMX/swarm/cli.mjs plan --manifest "/path/to/private/swarm-run.json" --repo "/path/to/adopted-app"
node .SYSTEMX/swarm/cli.mjs status --manifest "/path/to/private/swarm-run.json" --repo "/path/to/adopted-app"
```

The paths above are placeholders for an explicitly selected adopted repository
and reviewed private manifest. Every state-changing command requires `--apply`.
A plan/readiness output is an observation rather than execution authority.
Do not activate project records or run example tasks in the blank reusable template.

| Command | Actual effect and gate |
| --- | --- |
| `plan`, `status` | Read bounded manifest/assignment state; no worker or provider starts. |
| `next --slot N` | Read the dependency-ready, nonoverlapping next-task proposal for a free slot. A new generation and reviewed provider choice are still required; it does not dispatch. |
| `prepare --task ID --slot N --executable ABSOLUTE_PATH --arg VALUE` | With `--apply`, pin the reviewed executable and create the owned generation branch/worktree after repository/base, dependency, budget and scope checks. Repeat `--arg` for an argument array. |
| `sync --slot N` | Return a read-only revision/generation/state digest for a Mac IDE/Codex handoff. An optional `--sync-digest SHA256` verifies an earlier observation. |
| `run --slot N --sync-digest SHA256` | With `--apply`, require a fresh handoff, recheck provider identity and start the bounded CLI in its task worktree. |
| `verify --slot N` | With `--apply`, run the manifest's local checks and bind terminal results to the current head and assignment. |
| `review --slot N --reviewer agent.z --evidence-digest SHA256` | With `--apply`, record an operator-attested independent Z review bound to passing checks and the exact head. It does not authenticate a reviewer or approve a GitHub PR. |
| `alpha --slot N --evidence-digest SHA256 --expires-minutes N` | With `--apply`, record a separate Alpha lease binding repository, task/generation, base/head and Z/check evidence. Validity is 1–15 minutes, default 10. |
| `feedback --slot N --reason TEXT` | With `--apply`, keep the existing unmerged task branch available for revision while invalidating checks, review and Alpha lease. |
| `integrate --slot N --base-revision FULL_GIT_SHA` | With `--apply`, fetch and verify the current target, then merge it into the clean owned unmerged worker branch. Invalidate checks, Z review and Alpha; preserve conflicts for manual review without automatic abort/resolution, rebase or force-push. |
| `publish-plan`, `publish`, `ready` | Inspect publication readiness; with `--apply`, publish the exact owned branch/draft PR or request ready state. Before a create retry, query existing PRs for the exact owned branch/base/head; uncertain publication stays pending. Local review is distinct from required remote review. |
| `merge-plan --slot N --pr NUMBER` | Read current PR, remote base and branch protection; require active policy, exact candidate, passing required checks, accepted review and current Alpha lease. |
| `merge --slot N --pr NUMBER --plan-digest SHA256` | With `--apply`, reobserve the gate under the controller lock, recheck Alpha/current remote base immediately before action, and call GitHub's immediate REST squash-merge endpoint with the exact head SHA. No deferred merge queue or administrator bypass is used. An uncertain write or open readback stays pending/unverified and is not retried automatically. |
| `observe-merge --slot N` | With `--apply`, record a fresh remote observation of a pending/unverified PR outcome; it does not request a merge. Remaining open is still pending; only verified `MERGED` with the expected head and merge commit advances the generation. |
| `accept --slot N --reviewer agent.0 --evidence-digest SHA256` | With `--apply`, recheck the PR target/merge and target-history inclusion, then record Agent 0's delivery acceptance. It does not write the canonical task ledger or LAN completion catalog. |
| `close --slot N` | With `--apply`, recheck the accepted PR target/merge and target-history inclusion, then close the generation while retaining its branch/worktree. Optional `--delete-branch` refuses ignored/untracked data, creates/verifies a bounded exact-head private Git bundle and rechecks origin before guarded remote deletion/readback and clean owned local removal. |
| `advance --base-revision FULL_GIT_SHA` | With `--apply`, advance the shared baseline only when every slot generation is closed and clean coordinator, named base branch and remote agree on the new descendant revision. |

This is a stepwise controller, not a continuously running ten-worker scheduler.
Agent 0 or its authorized caller invokes each lifecycle command. Parallel CLI
processes need separate owned slots and remain within the manifest's shared
budget. No background monitor, recurring task or unattended reassignment loop
is installed by writing the manifest or opening the command help.

An Alpha lease gates the immediate merge request and is rechecked just before
the action. The controller does not submit a deferred provider auto-merge queue
that could outlive that lease. An open or uncertain response does not establish
merge or acceptance; `observe-merge` records a fresh remote observation when
invoked. No polling or reassignment daemon is installed by this command surface.

The [schema-1 manifest](../.SYSTEMX/swarm/manifest.schema.json) pins `runId`, `repository`, `baseBranch`, full
`baseRevision`, `maxWorkers` (1–10), `externalWorkers`, `reservedPaths`, named
`requiredChecks`, explicit `autoMerge` and bounded tasks. Each task contains
`id`, `title`, `acceptance`, `allowedPaths`, executable/argument-array `checks`
and `dependsOn`. External app/IDE workers reduce available CLI capacity;
overlapping active or reserved scopes are refused.

The [synthetic manifest example](../.SYSTEMX/swarm/examples/manifest.example.json)
contains an example repository, deliberately all-zero base SHA and
`autoMerge: false`. It is not an active task seed and cannot prepare a real
worktree unchanged. Copy it to private adopted-run configuration and replace
its scope, acceptance, check, repository and observed base deliberately.

Default private state is `.SYSTEMX/state/swarm/<runId>/`. A selected `--state-dir`
must be outside tracked content or Git-ignored; linked state paths are refused.
POSIX state directories/files use owner-only modes. Assignments, generation
state, completion hashes and events remain host-local. The controller uses a
local lock and atomic state updates; it is not a distributed lock or a defense
against another same-user process editing state.

The merge gate observes strict required checks, at least one required approval,
stale-review dismissal and administrator enforcement in GitHub branch protection.
An unavailable or insufficient protection observation refuses integration.
After that fresh gate, the controller calls GitHub's immediate REST endpoint
through `gh api --method PUT repos/OWNER/REPO/pulls/NUMBER/merge`, supplying
`--raw-field sha=HEAD` and `--raw-field merge_method=squash`. It requires a
successful merge receipt and matching PR readback. It does not use a deferred
queue, `--admin`, an unconditional merge or an automatic retry of an uncertain
merge. `autoMerge` in the manifest opts into the Agent 0 integration policy;
it defaults to false. GitHub enforces protected-branch rules atomically; the
host cannot reserve an atomic expected-base lock across the remote request.

Remote lifecycle mutations are serialized only after all owned worker/check
processes are terminal. A publication retry first queries existing PRs to recover
a matching already-created artifact; uncertain publication stays pending.
Merge, acceptance and closure require the intended PR base plus the exact merge
at the current target, or verified merge ancestry in that target's observed
history. Fetching the observed target object for this proof changes Git objects,
not source files or the canonical branch.

Within a wave, one merged task may advance main while other branches still
have the earlier base. `integrate` merges a freshly verified target into one
clean owned worker branch, invalidates checks/Z/Alpha and requires qualification
again. Conflicts remain for manual review; there is no automatic resolution,
rebase or force-push. Fresh task generations wait for every current generation
to close and the clean coordinator/base/remote `advance` barrier to pass.

Retirement bundles live under the private state directory's
`archive/yN-gG-HEAD.bundle` namespace. The controller verifies bundle validity,
checks an unlinked regular bundle within the 128 MiB budget, verifies the exact
original worker ref/head and retains the bundle SHA-256 in private state. Keep that recovery artifact private and verify its receipt
before later restoring or moving it; a bundle does not contain ignored files.

Before a provider receives its packet, the execution sidecar records the
observed PID, owned process group, controller PID, timestamp, generation and
lease in private state. A controller crash requires manual ownership audit;
a historical PID is not permission to kill a possibly reused process or retry
an uncertain provider job automatically. A successful execution also requires
observed owned-group termination. Detached descendants remain unqualified.

Provider/check output is bounded and represented by byte counts and hashes;
raw stdout/stderr is not retained as a readable test transcript. Keep original
review and verification artifacts separately and use their exact digest in the
operator assertions. Role labels and evidence hashes are consistency records,
not authenticated independent identities or proof that references were read.

## Evidence and implementation boundaries

The host runtime and its tests define the executable surface. Inspect its
current help and contract before running a command. This is a trusted local CLI
controller with post-run scope checks, not an OS sandbox. Bounded POSIX process
group termination does not qualify detached descendants. Native Windows worker
and check execution are refused until descendant termination is qualified;
manifest planning and record inspection remain available on Windows x64/ARM64. A local fixture or dry run
can qualify policy refusal and lifecycle bookkeeping; it cannot prove that a
real installed CLI authenticated, ten providers ran simultaneously, GitHub
checks passed, a PR merged, a branch was deleted or either IDE accepted a
handoff. Report those boundaries separately.

Before source publication, run the required `npm run ci:all` and separate
`npm run deploy -- hosting --preflight`, plus host/template checks required by
the repository instructions. Production deployment still needs explicit
operator authorization. Preserve failed attempts and terminal reruns rather
than rewriting them as a single pass.

This swarm work is additional operating support. It does **not** accept any of
the next one hundred LAN source-policy requirements by itself. The
[active iteration](LAN-ACTIVE-ITERATION.md) and
[F002 plan](LAN-SOURCE-POLICY-PLAN-2026-10-30.md) retain that separate goal,
original definitions and revision-bound acceptance gates.

## Local qualification — 2026-10-30

Functional candidate `e1588c4ebe94b1ef5f1557641334d95aee9b8290` passed all 70 required CI stages and separate
Hosting preflight, including **32 swarm tests**. The previous 27 local orchestration
regressions remain and five tests cover drive/UNC/POSIX syntax plus actual macOS
root and no-link behavior. Ten synthetic CLI processes overlapped in distinct
worktrees; local Git and fake REST responses exercised the full qualified lifecycle.
This is not native Windows, authenticated AI-provider, real GitHub merge, running
IDE or production qualification. Read the [candidate-bound QA receipt](LAN-SOURCE-POLICY-QA-2026-10-30.md).

## Observed authenticated worker wave and coordinator commit handoff

The F003/F004 iteration observed ten authenticated Codex CLI processes
simultaneously, each in its owned generation worktree and branch. Provider
availability, PID/CWD/branch observations, terminal execution and cleanup are
retained separately from source acceptance. The ten branches were integrated
locally by Agent 0; that observation does not qualify real provider PR approval,
automatic merge, native IDE control or production.

If a CLI sandbox refuses a worktree's Git metadata write, return the scoped
uncommitted files and original verification evidence to Agent 0. Preserve that
boundary; do not reroute the Git index or widen the sandbox. Agent 0 can review
and commit only those owned files, then use `feedback` to observe the committed
head and invalidate old checks before a new `sync` or verification. A provider
exit with uncommitted files is not a completed branch or accepted task.
