# Maintain WebAppX and optional template mirrors

WebAppX is the public template maintained by WayneTechLab. It begins with fresh
Git history and project identity based on the reviewed SFWA-WTL-TEMPLATE release.
No private mirror is configured for WebAppX. The workflow below is available for
a separately selected, authorized template mirror; do not apply it to an active app.
Compare Git tree hashes for exact parity after any intentional identity changes.

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
