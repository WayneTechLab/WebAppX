# Host swarm delivery controller

This host extension leaves the selected managed SYSTEMX release and its blank task,
context, map, access and memory seeds unchanged. Agent 0 owns assignments and
canonical task acceptance. X observes events, Y carries bounded CLI work, Z supplies
an independent review, and Alpha records a short integration assurance lease.
The controller validates the supplied role labels and evidence bindings; it does
not authenticate independent reviewers or prove a supplied evidence digest true.

Use the [operator guide](../../docs/SYSTEMX-SWARM.md),
[operating map](../../docs/SYSTEMX-SWARM-MAP.md) and
[access matrix](../../docs/SYSTEMX-SWARM-ACCESS-MATRIX.md) for the complete workflow.
Run `node .SYSTEMX/swarm/cli.mjs --help` from the repository root for exact options.
`manifest.schema.json` describes adopted-run inputs; no active run, account or
provider is selected by the reusable template.

The [synthetic manifest example](examples/manifest.example.json) is not an active
task seed. Copy it to a private adopted-run file and replace the example repository,
all-zero base SHA, task scope, acceptance and check command with observed values.
Its all-zero base deliberately cannot prepare a real worktree. Keep automatic
merge disabled until the adopted repository's actual protection and role policy
have been reviewed. Supply the configured provider executable explicitly at
`prepare`; it is never embedded in the portable example.

The controller supports up to ten isolated Git worktrees and generation branches.
The manifest's declared app/IDE workers consume the same configured capacity.
These reservations are supplied by Agent 0, not automatic discovery of every
external process. File scopes detect conflicts conservatively across case aliases.
Managed releases, private runtime paths and reusable ledgers remain protected
even when a broad host scope is assigned.

`plan`, `next`, `status` and `sync` are read-only observations. Mutations require
`--apply`. `prepare` pins the selected absolute provider executable and argument
array. `run` hands it a task packet through stdin in its own worktree. Provider
and check execution use short state locks and separate completion leases, allowing
different slots to run concurrently. Remote integration waits until these owned
processes finish. `verify`, Z `review`, and Alpha `alpha` are separate stages.
`feedback` preserves the branch and invalidates old check/review/lease authority.

`publish` verifies an exact branch and draft PR; a fresh head lookup precedes any
create retry. `ready` requests readiness and still requires real GitHub reviews.
`merge-plan` checks exact HEAD/base, terminal named checks, independent review,
unexpired Alpha evidence, and observed strict GitHub branch protection. `merge`
rechecks its conditions and calls the immediate REST merge endpoint with the exact
HEAD SHA. It does not enable a deferred merge queue or bypass protections.
GitHub remains responsible for enforcing protected-branch rules atomically;
the host cannot reserve an atomic expected-base lock across a remote API request.
An uncertain write/readback remains pending and cannot accept or reassign a task.

Verified merge, Agent 0's recorded delivery acceptance and generation closure are
separate. Neither updates the canonical SYSTEMX task ledger automatically. Default
`close` retains the worktree and branch. Explicit `close --delete-branch --apply`
first refuses ignored/untracked local data, creates and verifies an owner-private
Git recovery bundle containing the original branch HEAD (including commits not
retained by a squash merge), and checks the 128 MiB bundle budget. It then deletes
only the exact remote ref with a compare-and-swap lease, removes the clean owned
worktree and deletes the exact local ref. The private archive and event record
remain available. After every current generation closes, `advance` can establish
a new clean coordinator/base/remote sync point. `next` proposes another dependency-
ready task; `prepare` creates a fresh branch generation. This is a stepwise
controller, not an autonomous scheduler or a permanently running ten-worker daemon.

Within a wave, the first accepted merge can advance the target while other workers
still have the old base. `integrate` merges a verified current target into one
owned branch and clears its old checks, Z review and Alpha lease. It preserves
conflicts for manual review and does not rebase or force-push. Repeat the local
and remote gates before another merge. Fresh generations wait for the next clean
coordinator `advance` barrier, so accepted dependencies cannot silently dispatch
from an obsolete source baseline.

Private records default to ignored `.SYSTEMX/state/swarm/<runId>/` with exclusive
controller locks, atomic JSON, owner-only files and unlinked directory boundaries.
They contain local paths and process ownership observations, so keep them private.
Public checks never require copying that state into a release. Provider/check
output retains byte counts and hashes only; original review or test transcripts
must be retained separately when their content is needed as acceptance evidence.

Providers are trusted same-user programs. Scope checks inspect the assigned
worktree after execution and are not an OS sandbox against a malicious provider,
network access or writes outside that checkout. The controller bounds output,
deadlines and held pipes, terminates its owned process group and requires observed
group termination before passing execution. Detached descendants that escape the
group remain unqualified; an unresolved owned group blocks further work. Native
Windows execution is unavailable until descendant termination is qualified;
planning and record inspection remain available. macOS and Linux local fixtures
do not establish provider credentials, model availability, ten live paid sessions,
real remote approval or production deployment.

On spawn, each execution lease records its observed PID, process group, controller
PID and timestamp in a private sidecar. A controller crash still needs a manual
ownership audit: the record is historical evidence and does not authorize killing
a potentially reused PID or automatically rerunning an uncertain provider job.
