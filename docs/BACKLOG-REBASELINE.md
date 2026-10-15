# Proposal source rebaseline impact

`scripts/backlog-impact.mjs` compares two explicit, locally available Git commit
revisions and lists proposals whose referenced source scopes changed. Every
match requests review. The report leaves catalog status, completion dates,
canonical task state and blank reusable SYSTEMX records untouched. A proposal
already recorded as `done` can require review while retaining that status.

Run it from this checkout with reviewed revision operands:

```bash
node scripts/backlog-impact.mjs --from FROM_REVISION --to TO_REVISION
node scripts/backlog-impact.mjs --from FROM_REVISION --to TO_REVISION --json
```

Both operands are required. Branches, tags, unambiguous abbreviated commit IDs
and commit ancestry expressions resolve once to full commit SHAs. Annotated
tags peel to commits. Trees, blobs, unavailable objects and invalid revisions
are refused. The comparison uses the two resolved endpoint trees directly; it
does not use their merge base, the index or the workingtree. It never fetches
missing history or contacts a network service. Obtain and review missing
history separately before retrying.

## Choosing the catalog

By default, the proposal catalog is the regular committed blob at
`docs/backlog/webappx-1000-todo.json` in `TO_REVISION`. The report records its
resolved revision and the SHA-256 digest of its exact bytes. The catalog's
historical `sourceCommit` field does not select the comparison operands.

An explicitly reviewed catalog revision or alternate committed catalog path
can be selected:

```bash
node scripts/backlog-impact.mjs --from FROM_REVISION --to TO_REVISION \
  --catalog-revision REVIEWED_CATALOG_REVISION \
  --catalog-path docs/backlog/webappx-1000-todo.json --json
```

`--catalog-path` is a safe repository-relative path inside that commit. It is
never an arbitrary filesystem JSON input. Symlink and directory entries are
refused. Choosing another catalog revision changes the proposal membership and
source mapping used for source impact. The JSON identifies that explicit
selection. A deleted catalog requires an explicit available catalog revision.

Historical catalog validation checks schema 1 WebAppX proposal metadata, a
bounded proposal count, unique IDs, `todo`/`done` status and safe lexical source
scopes. It does not validate a historical catalog against today's files or
rejudge its completion evidence. Use the normal catalog checks for current
catalog acceptance.

## Matching source scopes

Git emits NUL-delimited name/status records. The parser retains the status and
both paths of a rename or copy; deleted paths remain matchable. Additions,
modifications, type changes and executable-bit changes are included. Spaces,
tabs and newlines in Git names retain their exact values in JSON and are quoted
in text output. Invalid UTF-8 or an incomplete NUL record fails the comparison.

A proposal source matches either its exact path or a changed path beginning
with that source followed by `/`. For example, `src/hr` matches
`src/hr/Payroll.tsx` and the path `src/hr`, while `src/hr-extra/Payroll.tsx` does
not match. Matching is lexical and case-sensitive. A path can serve as a file
in one tree and a directory in another; the same exact-or-descendant rule
applies. Source paths are data: the tool does not open them, resolve their
symlinks, inspect submodule contents or infer dependencies from imports.

Each affected proposal includes its ID, recorded catalog status, referenced
scope, matched paths and `reviewRequired: true`. The catalog currently supplies
one `source` path per proposal, represented as a one-element `referencedScopes`
array in the report. Reviewers must determine whether the changed scope affects
the original acceptance criterion and which evidence needs refreshing.

## Catalog edits and review advice

The raw Git records retain catalog changes. The selected catalog path is
classified separately from product source scope changes so a status edit does
not make every proposal referencing `docs` require review.

The report compares catalog JSON at both endpoint revisions:

| Change | Report behavior |
| --- | --- |
| `status` or `completion` changes with the same proposal definition | Report exact metadata IDs and counts; retain acceptance state; no source-scope review from the catalog path |
| Proposal title, acceptance, source, dependency or another definition field changes; proposal added or removed | Request separate definition review with exact affected IDs and counts |
| Top-level catalog metadata or JSON formatting changes | Identify metadata separately; no source-scope review from the catalog path |
| Source files change | Match source scopes in the selected committed catalog and request review, including accepted proposals |

For metadata-only edits to the default catalog, the Markdown and CSV companion
views are also classified as metadata **only if both revisions' committed bytes
exactly match the renderer's output for those catalogs**. A hand-edited view
remains a document scope change. Renderer differences between historical
versions can therefore produce conservative document review requests. Views
associated with substantive definition edits remain ordinary document changes.

Definition review is an advisory request and can include an ID removed from the
selected catalog. `counts.reviewRequired` counts the union of source-match IDs
and definition-advisory IDs. `scopeReviewRequired`,
`acceptedScopeReviewRequired` and `definitionReviewRequired` expose the
individual counts. A proposal present in both groups is counted once in the
union. No report operation reopens, completes or rewrites a proposal.

## Report format, limits and failure behavior

JSON reports use `schemaVersion: 1` and
`intent: "proposal-source-rebaseline-impact"`:

| Field | Meaning |
| --- | --- |
| `fromRevision`, `toRevision` | Full resolved endpoint commit SHAs |
| `catalog` | Committed path, resolved revision, exact byte SHA-256 digest and selection mode |
| `counts` | Exact counts across all successfully read inputs before display limits |
| `changes` | Git status and endpoint paths with `product-scope`, `catalog` or `generated-catalog-metadata` classification |
| `proposals` | Affected proposals and review requests for source matches |
| `catalogChanges` | Catalog metadata IDs and separate definition review advice, counts and omissions |
| `truncation` | Omitted change/proposal/matched-path counts and whether displayed output is truncated |
| `limitations` | Evidence and acceptance boundaries retained in every report |

`--limit` selects 1–100 displayed proposals and catalog advisory IDs (default
50); `--change-limit` selects 1–200 displayed Git records (default 100).
Each displayed proposal contains at most 20 matched paths and its exact omitted
match count. Matching uses complete paths before any display limit. Totals still
describe the full bounded input. Omitted match counts cover emitted proposals;
omitted proposals have their own count. Definition and metadata ID omissions
are reported in `catalogChanges`.

Git commands use child-process argument arrays, no shell, a 10-second timeout
per command and an 8 MiB output cap. Catalog blobs are limited to 2 MiB, catalogs
to 1,000 proposals, changed records to 20,000 and Git metadata traversal to
100,000 entries. Source scope paths are bounded to 240 characters and changed
Git paths to 4,096 characters. Input overflow, unavailable objects, timeouts,
signals, malformed output or unsupported metadata refuse the whole comparison;
the tool does not issue a successful partial impact report.

The checkout must have its own local `.git` directory. Linked worktrees,
external gitdirs, common directories, Git metadata symlinks, object alternates,
configuration includes, worktree-specific configuration and partial-clone
promisor configuration are refused. The local Git config is inspected before
starting Git and is limited to 64 KiB.
Inherited Git environment overrides are removed. Git replacement objects and
grafts are disabled; global/system configuration and external attributes are
isolated. Lazy fetching, transports, external diffs and text conversion are
disabled. Git still runs as the installed local executable and reads its own
runtime files; the source inputs remain inside the selected checkout's object
store. No source path or catalog reference opens another checkout.

Exit status `0` means a complete advisory report was produced, including when
review is required. Exit status `1` means the request was invalid, refused or
incomplete. Neither status establishes implementation correctness, acceptance,
deployment, provider access or operational readiness.

## Verification

```bash
node --test tests/backlog/impact.test.mjs
```

Tests create temporary real Git repositories and compare literal expected IDs,
paths, statuses and counts. Fixtures cover renames, deletes, type and mode
changes, unusual names, explicit historical catalogs, status and definition
edits, verified generated companions, accepted proposal review, output
truncation and refusal paths. A dirty fixture compares catalog, index,
workingtree files and blank canonical records byte for byte before and after
both API and CLI reporting. Fault injection covers timeout, signal, output
overflow and incomplete NUL failures without waiting for an actual timeout.
All test comparisons are local and offline. These checks do not establish
Windows runtime behavior on a macOS host.
