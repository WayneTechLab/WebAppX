# Maintain WebAppX and optional template mirrors

WebAppX is the public template maintained by WayneTechLab. It begins with fresh
Git history and project identity based on the reviewed SFWA-WTL-TEMPLATE release.
No private mirror is configured for WebAppX. The workflow below is available for
a separately selected, authorized template mirror; do not apply it to an active app.
Compare Git tree hashes for exact parity after any intentional identity changes.

## Evidence freshness and disposable adoption examples

Use [documentation freshness](DOCUMENTATION-FRESHNESS.md) to compare a guide's
examined source with an explicit target, identify relevant changed paths and
append a deliberate dated decision. Original QA receipts remain unchanged; a
source-only review establishes no new browser/provider observation.

The [import rehearsal](SYSTEMX-IMPORT-REHEARSAL.md) verifies preserved fictional
host records and extensions across an actual importer run in owned scratch
installations. The [HR-disabled example](examples/hr-disabled-adoption.md)
builds and exercises a temporary CMS/CRM-only app with explicit bundle, backup
and recovery compatibility decisions. Neither rewrites an existing adopted app.
Run the [role](HR-ROLE-EXAMPLES.md) and [Gusto capability](GUSTO-CAPABILITY-GAPS.md)
consistency checks after relevant source changes; fingerprints require deliberate
review rather than automatic refresh.

## Three update paths

| Path | Owner | Entry point |
| --- | --- | --- |
| Standalone defaults | Public dotSYSTEMX | `systemx:upstream:check` / explicit `systemx:upstream:import` |
| Webapp and host operations | This template | App/LAN/KIT/setup changes and `sync:system:check` |
| Optional mirror parity | Reviewed template maintainer | `scripts/sync-template.py` and Git publication |

An upstream import applies to the selected target and does not publish a wiki.
Host governance sync does not import standalone defaults or mirror a repository.
Each operation has a separate preview/check and explicit mutation boundary.

## Managed standalone updates

The 3.4.0 host selects dotSYSTEMX 1.9.0-alpha.6. Preview with
`npm run systemx:upstream:check`, then apply the reviewed plan with
`npm run systemx:upstream:import`. The importer verifies a clean standalone
checkout against exact public `main`, archives that revision and uses its
reviewed external manager. Preview includes required stock bootstrap changes.
Apply backs up recognized manager/launcher originals under ignored local
`.SYSTEMX/.systemx/history/` before refresh, adds the immutable snapshot and
missing outer files, then pins the selected release with manual updates.
The returned `bootstrapBackup` path is local evidence; tracked provenance keeps
only relative bootstrap filenames and the import commit/fingerprint.
Add `-- --expected-commit <reviewed-public-main-sha>` to both npm upstream
commands to bind preview and apply to the reviewed revision.

Documentation-only public-main advancement outside `.SYSTEMX` does not require a
new managed version. The importer verifies the original receipt's repository,
version and manifest and proves its available historical commit has the identical
complete `.SYSTEMX` Git tree. It reports the reviewed `commit`, original
`receiptCommit` and `identicalSourceTree`, preserving first-import bytes. A
different tree remains a conflict, even if a manifest fingerprint matches. When
the preview has no additions or bootstrap changes and the selected release
already matches, retain the existing installation rather than reapplying it.

Customized bootstraps and altered retained snapshots are conflicts. Preserve
downstream context, plans, tasks, memory, configured commands, original releases
and host extensions. The new blank access/map seeds and optional Agent Y guides
do not activate roles or providers. Schema 2 media hashes are byte exact; avoid
normalizing binary bytes when verifying an import.
For this reusable base, outer stock tooling/guidance may be reconciled only
after matching the old retained release. That maintenance step does not add
blanket replacement of downstream files to the importer.

## Review and validate the source

The [operational health vocabulary](MONITORING.md),
[security assumptions register](SECURITY-ASSUMPTIONS.md) and
[command effects table](COMMAND-SAFETY.md) distinguish examined source,
local processes/browser behavior, optional provider operations and deployed
services. Use [the QA coverage map](QA-COVERAGE-MAP.md) to select checks with
the right scope; do not refresh historical evidence by relabeling its revision.

`npm run repository:identity` creates a read-only
[publication observation](REPOSITORY-IDENTITY.md) with direct remote main and
separate worktree/index categories. Run it before an authorized publish step;
clean local commits ahead of the verified remote ancestor remain distinguishable
from parity. The report never fetches, stages, commits or pushes. For example
configuration changes, run `npm run environment:check` and inspect the
[proposal's explicit file/classification boundaries](ENVIRONMENT-CONFIGURATION.md).

The [WebAppX roadmap](WEBAPPX-ROADMAP.md) contains 1,000 proposed improvements
in a separate planning catalog. Query one area with `npm run backlog`, review
its current applicability and only activate bounded work in an adopted project's
canonical ledger. `npm run backlog:check` validates the catalog and generated
Markdown/CSV as part of full CI; template task/context/memory seeds stay blank.

Confirm the branch, remotes, live main revisions and local changes before work.
Preserve existing changes and ignored state. Reconcile public-only and
private-only features deliberately; keep managed releases immutable and
research manifests consistent. Ship blank context/plan/task/memory seeds, and
keep secrets, active project records and local runtime state outside the release.

Select the relevant runtime and locked dependency scope using
[dependency installation](DEPENDENCY-INSTALLATION.md). The root app/starter
and optional Functions adapter have different runtime declarations and separate
lockfiles. Keep installer output and local browser/session artifacts outside
tracked reusable files.

```bash
npm ci
npm run sync:system:check
npm run ci:all
npm run deploy -- hosting --preflight
```

If host generated metadata needs updating, review `npm run sync:system` changes
and repeat the affected checks. Version the app independently of the managed
standalone release. Documentation-only updates can retain the app version.
The `webapp-version/` directory avoids a case-insensitive collision with
standalone `VERSION`.

Core PowerShell record tools are included. Native Windows Agent Y
`run --apply` remains unavailable pending verified descendant-process
termination. Report the actual host and checks performed; macOS checks do not
establish Windows x64/ARM64 or deployed Firebase acceptance.

Commit the reviewed source before mirroring. Use its own repository's normal
Git workflow and publication authorization; do not import private Git history
into the public repository.

## Preview and apply the mirror

```bash
python3 -B scripts/sync-template.py --target /path/to/template-mirror
python3 -B scripts/sync-template.py --target /path/to/template-mirror --apply
```

Both checkouts must be clean. The tool stages a tracked source archive,
validates it, then copies tracked files only. Review the target diff and commit
it in the target repository. The tool deliberately refuses local-only collisions
and file/directory transitions rather than discarding those files.

```bash
npm run template:check -- --against /path/to/template-mirror
git rev-parse 'HEAD^{tree}'
```

Parity includes paths, file contents and executable modes. It excludes `.git`,
ignored dependencies, build output, environment files and local session state.
Preserve those local resources under their own project policies.

## Publish and verify

Publish each reviewed main branch, then compare local HEAD with live remote refs
and confirm both committed trees match. Existing histories remain intact.

Run in each repository:

```bash
npm run wiki:check
npm run wiki:sync
```

The wiki script derives its destination from that checkout's GitHub origin.
It exports checked-in Markdown pages, preserves wiki-only material/history, and
pushes without forcing. Local links to known wiki `.md` pages become rendered
GitHub wiki URLs during export; source pages and code examples keep their local
links. Verify the preview and published navigation after sync.
Source publication and wiki publication are separate from Firebase hosting.

See [release provenance](UNIFIED-TEMPLATE.md),
[managed integration](SYSTEMX-INTEGRATION.md) and the
historical [3.1.0 validation receipt](VALIDATION-3.1.0.md). That receipt covers
its examined revision and does not validate the 3.4.0 update.


## Execute the complete WebAppX backlog

The owner-selected full goal and twenty-area coverage are in the
[execution plan](WEBAPPX-EXECUTION-PLAN.md). Read current counts and
local dependency-ready candidates with:

```bash
npm run backlog:plan
npm run backlog:ready -- --limit 20
npm run backlog:ready -- --gate all --priority P1 --limit 30
npm run backlog:graph -- --id WX-0317 --id WX-0409 --id WX-0551
```

The graph includes selected predecessors, edges, longest chains and unresolved
nonlocal acceptance criteria. It does not dispatch workers, infer provider
access or change checklist status. Explicit item selection is limited to forty
IDs per graph; ordinary candidates are bounded to fifty per query. Source and
acceptance must still be reviewed. Done entries cannot bypass unfinished
catalog dependencies.

After accepted completions, regenerate every derived view together:

```bash
npm run backlog:render
npm run backlog:plan:render
npm run backlog:check
npm run backlog:plan:check
```

Keep `docs/backlog/webappx-1000-todo.json` canonical. Do not copy a second
maintained task-status ledger into the blank reusable SYSTEMX records. The
execution plan is deterministic and its check fails if the rendered counts,
area coverage or dependency-ready candidates are stale.

## Review and adopt a bounded proposal selection

The host [adoption workflow](BACKLOG-ADOPTION.md) converts explicitly selected
proposals into new TODO records in a separately selected configured app or
registered child. Its preview binds a locally available catalog commit/digest,
registered owners, exact target identity/scope, task allocation and every mapped
dependency. Source completion evidence does not become target acceptance.

Review per-task credentials, operator authority and local prerequisites
independently. Missing constraints remain unknown; available credentials are
reported without provider probes. Deliberate reviewed-plan intake is separate
from activating or executing the work. Applying a stale or repeated plan refuses
before duplicating tasks. Unreadable records cannot disappear from fingerprints.
Do not apply this host tool to the reusable template itself.

Use [revision-impact reports](BACKLOG-REBASELINE.md) when comparing committed
source versions. Review candidates retain their original canonical state.
The [work-status view](WORK-STATUS.md) separates root work-record byte matches,
roadmap source acceptance and one explicitly selected adopted scope. The
[provenance inventory](SYSTEMX-PROVENANCE.md) separates path ownership from stock
content relation before any update; inspect the [bounded upstream review](SYSTEMX-UPSTREAM-REVIEW.md)
for exact source/pin facts and all conflict totals before a separately authorized
import. An omitted display row cannot remove a blocker.

## Maintain contracts and evidence attachments

The [portal state contract](PORTAL-STATE-CONTRACT.md) describes actual retained
records, temporary UI, route/remount behavior and Reset/restore/history boundaries.
The [capability matrix](PORTAL-CAPABILITIES.md) describes synthetic domain checks
and complete backup scope. Reconcile both with source when changing portal state,
preview identities, exports or navigation. Complete demo backups are role agnostic;
they include private fictional drafts beyond a restricted visible projection.

For session changes, preserve the printed scheme/hostname/port and browser-profile
boundary. Fixed origin startup must reject a busy app port without fallback, and
app/LAN readiness remains independent of Auth/Firestore/Storage readiness.
`systemx:session:restart:preview` is a read-only snapshot with an advisory proposed
launch. It does not reserve replacement listeners or perform a restart.

Inspect the focused contracts with:

```bash
npm run systemx:session:test
npm run browser:state-contract
npm run backlog:evidence:check
npm run backlog:evidence:test
```

The [evidence index](BACKLOG-EVIDENCE.md) records examined revisions and references
to original observations. Preserve the original observation's date, source base
and limitations when reusing it. An attachment can describe existing behavior
for an unfinished proposal without accepting the proposal or bypassing a pending
dependency. Read `npm run backlog:evidence -- --id WX-0717` for that distinction.
The evidence CLI validates/queries/renders attachments without changing the
canonical catalog or generated completion views. A new attachment requires a
deliberately reviewed index edit; CLI output is not an acceptance operation.

Record current check results and remaining boundaries in a dated host receipt,
such as [session/contracts QA](SESSION-CONTRACTS-QA-2026-10-15.md), rather than
populating the blank reusable context, plan, task, focus or memory seeds. Retain
the required `ci:all`, Hosting preflight, host-drift and template-copy gates.
