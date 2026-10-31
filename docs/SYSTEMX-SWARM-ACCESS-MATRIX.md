# SYSTEMX swarm access and authority matrix

This host-owned matrix records WebAppX's authorized swarm boundaries. It is
not an authentication system or a provider permission grant. The reusable
[access-matrix seed](../.SYSTEMX/GLOBAL/ACCESS-MATRIX.md) remains blank. Use the
[swarm operating guide](SYSTEMX-SWARM.md) and
[operational map](SYSTEMX-SWARM-MAP.md) for lifecycle details.

## Role capabilities

| Action | Agent 0 | Agent X | Agent Y worker | Agent Z | Alpha |
| --- | --- | --- | --- | --- | --- |
| Select task, acceptance and write scope | Owns under owner authority. | Observes decision. | Receives bounded packet. | Reviews clarity/scope. | Checks consistency with lease. |
| Change canonical integration checkout/branch | Sole writer. | No. | No. | No. | No. |
| Edit an assigned task worktree | Coordinates integration. | No. | Only its exact task/generation/allowed paths. | Review-only unless separately assigned a distinct implementation task. | Review-only. |
| Launch a configured CLI | Dispatches under selected policy/budget. | Records actual launch/exit. | Executes its one authorized provider invocation. | No implied execution authority. | Can refuse gate; cannot self-grant launch authority. |
| Set canonical task/catalog acceptance | Owns after original criteria and evidence pass. | No. | No. | Recommends; does not accept. | Reports gate; does not accept. |
| Review own implementation for integration | Cannot replace required independent review. | No. | Cannot self-approve. | Reviewer must be independent of that implementation. | Cannot approve its own implementation. |
| Open/update owned task PR | Delegates exact repository/branch lifecycle. | Records provider observation. | Only if opted into assignment and supported by provider adapter. | Reviews. | Checks candidate/lease consistency. |
| Merge PR automatically | Agent 0 host policy lane only, after all exact-candidate gates; immediate REST expected-head request. | No. | No independent merge authority. | No. | Gate conclusion only; no override. |
| Integrate current target into a worker | Invokes reviewed per-worker integration and owns conflict disposition. | Records observation. | Its owned branch receives the target merge; no canonical write. | Reviews resulting changed candidate. | Old lease invalidated; reevaluate after new checks/review. |
| Close cancelled unmerged PR | Explicit configured cancellation policy. | Records readback. | Only delegated owned PR operation. | No implied authority. | Checks ownership/evidence if required. |
| Delete merged task branch/worktree | After verified merge, acceptance, preservation and fresh ownership/head checks. | Records outcome. | Only separately delegated safe cleanup. | No. | Verifies gate; cannot discard work. |
| Create next assignment | Chooses fresh task/generation/base/branch. | Observes assignment. | Receives free slot; cannot reuse merged history. | No. | Checks eligibility and lease. |
| Deploy production / change financial authority | Separate explicit operator authorization. | Observes actual event only. | No inherited authority. | No. | No. |

A shared project resource budget includes app/IDE agents and external providers.
The runtime ceiling is **at most ten authorized CLI slots**, not ten guaranteed
processes or an allowance to exceed provider/account limits.

## Operation gates and refusals

| Operation | Required facts | Refuse or invalidate when |
| --- | --- | --- |
| Assign/run | Exact selected repository and base, bounded paths, known installed provider, free owned slot/worktree, reviewed budgets and stop condition. | Destination occupied, ownership ambiguous, provider replaced, stale base, unsupported host or expired assignment. |
| Review | Original task acceptance, exact source/evidence snapshot, independent reviewer and retained negative/refusal proof. | Self-review, unexamined worker summary, changed source/evidence or unresolved required findings. |
| Lease | Agent 0-selected policy, repository/task/generation/head/base constraints, bounded validity and retained evidence. | Expired, broadened, missing or not matching fresh observations. A same-user editable record is not a cryptographic attestation. |
| Merge | Explicit host auto-integration policy; exact repository, PR, base/head; accepted independent review; all required checks pass; Alpha gate; no conflict/protection bypass. | Pending/unknown/failing checks, stale review, retarget, conflict, head/base drift, competing writer or provider refusal. |
| Merge verification | Immediate expected-SHA REST receipt plus intended PR base, matching merged readback and exact target or verified ancestry. | Timeout, open/pending response, provider refusal or unknown result. Preserve and observe; do not retry an uncertain merge automatically. |
| Cleanup | Accepted work, verified PR target/merge ancestry, exact owned branch/head and clean reconciled worktree. Default close retains branch/worktree. Optional deletion creates/verifies an unlinked regular exact-head private Git bundle within 128 MiB, then rechecks origin before removal. | Dirty/unowned material, ignored/untracked files, moved branch, invalid/oversized bundle, active process or uncertain provider state. Preserve ignored data separately. |
| Target integration / next generation | Integrate verified target into only the clean owned worker; invalidate check/Z/Alpha records. Next-wave `advance` requires all slots closed and clean coordinator/base/remote agreement. | Dirty branch, conflict needing manual resolution, stale target or an open generation. No rebase, force-push, reset or implicit conflict resolution. |
| IDE/App handoff | Exact checkout/branch/revision/generation plus observed dirty state, owner and evidence. | Changed source/branch/dirty state/generation or outdated handoff. Reobserve before action; never reset/pull silently. |

## Data and credential boundary

Portable tracked contracts may contain role names, rule versions, contained
repository paths, requirement IDs and sanitized evidence references. Keep
provider credentials, session tokens, process environment, raw private prompts,
absolute executable/worktree paths, provider output and lease/runtime sidecars
in ignored host-local state with the platform's appropriate access controls.
Git ignores do not prevent force-adds, backups or external sync tools from
copying private state.

Only authenticated installed tools and provider permissions establish actual
access. Do not change accounts, install providers or copy credentials to make a
worker available without the corresponding user authorization. Do not claim
cross-platform descendant cleanup from a macOS test; unsupported execution
must remain a clear refusal rather than an unsafe fallback.

WebAppX's blank root registry and context/task/plan/memory seeds remain reusable.
An adopted project can deliberately activate supported roles and configure its
own scopes. The host swarm adds no unrestricted supervisor and does not alter
the immutable managed release or grant production deployment authority.

## Enforced checks versus operator assertions

The runtime checks manifest/scope consistency, current slot/generation/head,
provider executable identity, terminal local check results, separate Z review
and expiring Alpha record bindings, provider PR/protection state and exact-head
merge/closure observations. Z review and Alpha/Agent 0 evidence digests are
operator assertions, not authenticated identities or automatically inspected
original reports. Preserve independent review evidence separately.

A trusted provider process is not OS-isolated by the controller. Post-run path
checks cannot prevent all filesystem or external actions by that process.
Bounded POSIX process-group termination does not prove cleanup of detached
descendants. Native Windows worker/check execution refuses until its descendant
termination is qualified; planning/inspection remains available. No real
provider, branch-protection or IDE qualification follows from fixture tests.

Provider/check execution records its observed PID, group, controller, timestamp
and lease before packet delivery. A controller crash leaves an ownership audit
requirement; stale process records authorize neither an automatic kill nor a
provider retry. Remote lifecycle operations require all owned executions to be
terminal. Publication retries inspect existing PRs first; uncertain merge writes
remain pending for observation/manual resolution, without a deferred queue.

## F003/F004 execution observation

Agent 0 observed ten authenticated CLI worker processes simultaneously in
separate generation branches/worktrees, retained terminal execution/cleanup
records and reviewed local integration. Child Git metadata refusals were handed
back to Agent 0 for scoped commits and fresh feedback/sync observations. This
changes the observed provider-execution boundary only. Catalog acceptance,
canonical delivery, real PR approval/automatic merge, branch retirement, native
IDE/Windows operation and production retain their separate gates. No role label,
process receipt or local integrity tag grants those permissions.
