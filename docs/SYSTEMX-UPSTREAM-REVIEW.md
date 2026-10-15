# Bounded upstream import review

The host importer keeps a versioned, read-only review separate from applying an
upstream distribution. Use it before changing the selected defaults:

```bash
npm run systemx:upstream:check -- --source /path/to/dotSYSTEMX --limit 25
python3 -B scripts/sync-systemx.py --source /path/to/dotSYSTEMX \
  --expected-commit FULL_REVIEWED_COMMIT --limit 25 --offset 25
```

These paths and commit words are placeholders. The default source selection is
documented in [SYSTEMX integration](SYSTEMX-INTEGRATION.md); no source location
is stored in the review or tracked release records.

The source must be the clean standalone repository with the reviewed origin.
The importer resolves its exact HEAD and queries canonical public GitHub main
independently of local URL rewrites and cached tracking refs. This HTTPS query
disables credential helpers, prompts, redirects and global/system Git config.
An unavailable, malformed or different observation cannot become a verified
source selection. The optional expected commit must match the observed revision.

## Report contract

Default preview stdout is JSON with schema version 1 and kind
`webappx-systemx-upstream-review`. Exit 0 means `ready`; exit 1 means `blocked`
or `invalid`. Bad command arguments are refused. The source is archived at the
captured commit and verified with the unchanged incoming manager before planning.
Read-only Git observations and archive extraction use argument arrays, timeouts,
disabled optional index locks/replacement objects/grafts, stripped inherited Git
overrides and disabled lazy fetch/transports. The one explicit public-main query
permits HTTPS. Archive extraction uses a temporary directory and leaves it clean.

| Field | Meaning |
| --- | --- |
| `selection` | Current, pinned and incoming versions; unknown facts remain null. |
| `source` | Canonical repository, exact observed commit, expected commit, public-main observation, verification state and distribution manifest fingerprint. |
| `receipt` | First-import commit and same-commit or identical-complete-tree proof. A differing historical source requires the existing receipt verification; a matching manifest alone is insufficient. |
| `outer` | Additions, incoming overlaps preserved, every host-owned path preserved including host-only extensions, and planning conflicts. |
| `bootstrap` | Available add/replace/conflict lists, not applicable for initial installation, or unverified when planning failed. Customized bootstrap files remain conflicts. |
| `diagnostics` | Fixed portable diagnostic codes. Underlying Git/extraction errors do not print machine paths or raw subprocess errors in preview mode. |
| `blocking` | Whether any conflict or unavailable prerequisite blocks this review, and the total blocking observations before display pagination. |
| `observationStage` | Controlled stage name identifying where an invalid review stopped, or `complete`. |
| `checklist` | Five review actions; these statements grant no apply or deployment authority. |

The [provenance inventory](SYSTEMX-PROVENANCE.md) supplies independent ownership
classification. A host file remains host owned when its bytes match a retained
blank seed. An inventory diagnostic blocks the review rather than silently
omitting unknown preservation scope. Initial unmanaged targets can still expose
host-owned paths without reading those files' content for stock comparison.

### Pagination

Every list contains `total`, `returned`, `offset`, `truncated`, `nextOffset` and
`items`. The default limit is 25, maximum 100, and offset is 0 through 100,000.
The same offset applies independently to each group; follow a group's
`nextOffset` to inspect its remaining rows. Stable ordering supports inspection.
An offset beyond the end yields no displayed rows and keeps the complete total.

`blocking` uses the complete planning results. Hiding a conflict with `--limit`
or `--offset` cannot make a blocked review ready. An unverified or invalid source
does not provide empty lists as proof that no change is needed: inspect `status`,
the observation stage and null/unverified facts first.

## Apply boundary

The existing explicitly requested apply command retains its receipt format and
preservation behavior:

```bash
npm run systemx:upstream:import -- --source /path/to/dotSYSTEMX \
  --expected-commit FULL_REVIEWED_COMMIT
```

Use the same actual reviewed commit and the already applicable operator authority.
Pagination flags cannot be combined with apply. The apply path rechecks source
identity/current public main and all manager/receipt conflicts; a prior `ready`
report cannot waive these checks. Existing host records, immutable snapshots and
the first import receipt stay protected. Any bootstrap backup identity remains
local execution evidence outside tracked provenance.

This is planning evidence, not a guarantee about a later network observation,
provider setup, deployment, running workers or application migrations. It does
not import upstream changes merely by generating a checklist. Follow the
[command effects](COMMAND-SAFETY.md) and [maintenance guide](TEMPLATE-MAINTENANCE.md)
for the surrounding authorized workflow.

## Verification

`npm run systemx:integration:test` discovers the import-review fixtures alongside
the existing importer tests. Temporary real Git source/distribution fixtures use
an injected public-main response and check initial/managed targets, host-only
preservation, conflict pagination, receipt retention/tree proof, invalid and
missing observations, wrong expected revisions, path redaction, inherited Git
override refusal and source-index/target byte preservation. A separate command
construction assertion checks the isolated canonical HTTPS query without making
a network request. No fixture applies to this reusable template's project ledger.
