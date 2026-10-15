# Inspect SYSTEMX ownership before an update

The provenance inventory reports which outer `.SYSTEMX` paths belong to this
host, which correspond to retained standalone defaults, and which are immutable
release content. It is a local, read-only inspection. It starts no workflows,
workers, services, updates, Git commands, or provider calls.

```bash
python3 -B scripts/systemx-provenance.py
python3 -B scripts/systemx-provenance.py --format text --limit 40
python3 -B scripts/systemx-provenance.py --path GLOBAL/CONTEXT.md
python3 -B scripts/systemx-provenance.py --target /path/to/host --limit 100
```

All reported paths are relative to the outer `.SYSTEMX`. `--path` accepts one
exact path, including paths omitted from the first page. The tool does not emit
file contents, secrets, import receipt values, timestamps, or machine paths.
Installation version, pin, manual/on-start policy, and retained version names
are the only installation values exposed.

## Ownership and content are separate

The `ownership`, `role`, and `updatePolicy` fields describe the path's documented
responsibility. `contentRelation` and `matchingRetainedVersions` describe an
observed comparison. Equality never authorizes replacement. In particular, a
blank project record remains host owned when it exactly matches an upstream seed.

The policy follows [SYSTEMX integration](SYSTEMX-INTEGRATION.md). The selected
release supplies shared guidance; adopted project records remain in the outer
folder. Existing outer files continue to require the import or reconciliation
workflow appropriate to their owner.

| Paths | Ownership / role | Update responsibility |
| --- | --- | --- |
| `GLOBAL/`, `PLAN/`, `WORK/`, `MEMORY/`, `AGENTS/`, `Projects/`, `CURRENT.md`, `project.json` | `host` / `project-record` | Preserve adopted project records, including blank stock matches |
| Outer `config/` | `host` / `host-configuration` | Preserve configured host commands, policies, manifests and examples; an outer manifest does not select defaults |
| `LAN/`, `KIT/`, `Template/`, `GUSTO/`, `deploy/`, `hooks/`, host setup/deploy scripts, setup packets and standards | `host` / `host-extension` | Maintain separately; includes host-only files and both research packages |
| `status/` | `host` / `host-history` | Preserve LAN roadmap/history; it is not canonical task authority |
| `webapp-version/` | `host` / `host-version` | Maintain the webapp version independently of the standalone version |
| Initial `VERSION`, `SOURCE.json` | `host` / `initial-provenance` | Preserve the initial seed/provenance |
| Outer README, WSG menu, start/standard/format/agent guidance, legacy `docs/` and `AI/` overlaps | `host` / `reconciled-entrypoint` | Explicitly reconcile host instructions with selected defaults |
| The eight manager/launcher bootstrap files | `manager` / `bootstrap` | Use the separate reviewed bootstrap refresh workflow with exact bytes and backups |
| `INSTALLATION.json` | `manager` / `installation-metadata` | Manager selection, pin and retained fingerprints |
| `imports/` | `manager` / `import-metadata` | Retain first-import provenance; this inventory does not revalidate source Git history |
| `.systemx/releases/<version>/` | `upstream` / `immutable-release` | Retain immutable verified snapshots; never rewrite them to hide modifications |
| Other outer paths present in a verified retained bundle | `imported-default` / `outer-default` | Preserve existing files and review before reconciliation, whether exact or modified |
| Other outer paths | `undetermined` / `unrecognized-outer-file` | Preserve and review; no origin or overwrite authority is inferred |
| Runtime, history, cache and secret paths | `local` / `excluded-local-state` | Exclude without reading payloads |

Host script policy includes the existing setup, Firebase, deploy, security,
structure, LAN isolation, packet, version and production helpers. It does not
claim that arbitrary scripts with unrelated names came from upstream. The exact
versioned policy is the `classify_path` function in
[`systemx-provenance.py`](../scripts/systemx-provenance.py).

The eight bootstrap paths are `manager.py`, `lifecycle.py`, `versions.py`,
`systemx_paths.py`, `SYSTEMX.sh`, `SYSTEMX.ps1`, `INSTALL.sh`, and `INSTALL.ps1`.
`bootstrapExactMatch: true` only reports recognized exact retained bytes. It
does not authorize a refresh or establish that the bytes match an incoming
release.

## Comparisons and integrity

For a managed host, the tool validates `INSTALLATION.json` and every registered
retained release using the existing manager's local verification APIs. Each
snapshot must have a valid distribution, match its stored version/fingerprint,
and contain exactly its allowed files and directories. A damaged inactive
release is a failure too. No partial inventory is labeled verified.

| `contentRelation` | Meaning |
| --- | --- |
| `exact` | Outer file bytes equal the same logical path in at least one verified retained release |
| `manifest-equivalent` | No byte-exact match exists, but the retained manifest contract treats the content as equivalent |
| `modified` | This logical path exists in retained defaults, but no retained version matches |
| `verified-retained` | This is a file inside a fully verified retained snapshot |
| `metadata-unread` | Manager/import metadata was classified without exposing its payload; installation metadata was separately validated |
| `unrecognized-unread` | No retained logical path exists; contents were unnecessary for classification and were not read |
| `excluded-unread` | A runtime/cache/history/secret boundary was pruned without reading content |
| `unavailable-unmanaged` | The outer installation has no installation record; no retained comparison is available |
| `type-conflict` | An outer directory occupies a retained file path; the report includes a preservation/review diagnostic |

`matchingRetainedVersions` gives each matching version and its own `relation`:
`exact` or `manifest-equivalent`. All matches are kept in version order. The
same outer file may exactly match an older retained version and only be
manifest equivalent to another.

Historical schema 1 normalizes CRLF to LF for every file. Schema 2 permits that
equivalence only for the manager's reviewed UTF-8 text formats and names. Binary
and unknown formats remain byte exact. This report uses each retained release's
own manifest schema. An outer Python bootstrap converted to CRLF can therefore
be `manifest-equivalent` while `bootstrapExactMatch` remains false. The separate
bootstrap refresh checks exact bytes; normalized equality is insufficient.

Snapshot verification establishes the retained manifest contract and stored
installation fingerprint. It does not prove archive signatures, current public
main, installed CLI behavior, provider acceptance, or production serving.

## Bounded output and failure behavior

The JSON report has `schemaVersion: 1`, `policyVersion: 1`, and
`kind: "systemx-provenance"`. It includes selected/pinned versions, installation
status, integrity, global counts by ownership/role/content relation, and a page
of entries. `total` is the full logical entry count; `returned` is the page size.
`truncated` describes output pagination, not an incomplete filesystem scan.
Every page still verifies all retained releases and scans the complete allowed
outer tree.

The default page is 200 entries and the maximum is 1,000. When `truncated` is
true, pass the returned `continuation` exactly as `--after`:

```bash
python3 -B scripts/systemx-provenance.py --limit 100 --after AGENTS/REGISTRY.json
```

Paths are sorted, so repeated calls on unchanged content produce the same
report. A continuation must still exist; a missing continuation fails with an
instruction to restart. Continue against a stable checkout. Exact lookup uses
`found` and returns zero or one entry; `total` and `counts` still describe the
whole inventory. Diagnostics have their own total and truncation fields.

The internal scan caps retained releases at 64, discovered filesystem entries
at 20,000, path length at 1,024 characters, directory depth at 64, and compared
release/outer content at 128 MiB. The existing manager also caps distribution
file counts and individual file reads. Reaching a scan/byte/depth cap fails
without a verified or partial result. The output can be paginated only after a
complete allowed scan.

Runtime exclusions include `.systemx/` sidecars outside `releases/`, `local/`,
`logs/`, `state/`, `__pycache__/`, `.cache/`, `node_modules/`, LAN Temp/Backup/Files,
guided setup answers, private setup input payloads, deployment counters, and
recognized secret/session/log files. An excluded directory is one boundary row;
its descendants and payloads are never enumerated or opened. Source folders
such as `LAN/Builder/runtime/` remain host extensions because they contain
versioned implementation files.

Links/junctions, path escapes, nonportable paths, case collisions, special
filesystem entries, invalid installation metadata and invalid snapshots fail
with a logical path and a fixed diagnostic. The CLI exits 1 and emits
`valid: false`, `integrity: "unverified"`, and no inventory entries. It never
passes through exception text containing a machine path or file value.

If `.SYSTEMX` is absent, a valid zero-entry report has
`installationStatus: "not-installed"` and `integrity: "not-installed"`.
If an existing canonical outer folder has no `INSTALLATION.json`, its files
are classified without content reads and the report has
`installationStatus: "unmanaged"`, `integrity: "unmanaged"`,
`contentComparison: "unavailable"`, null selection/pin/update fields, and no
retained versions. These reports make no snapshot verification claim. An
unregistered release tree is refused rather than treated as verified defaults.

## Reuse in local tools

Load the script as a Python module by its exact path, following the existing
host script convention. Its public inspection API is:

```python
classify_path(path, known_default=False)  # ownership, role, updatePolicy
is_host_owned(path)                     # explicit host policy, including host-only paths
collect_inventory(target, manager=None) # complete inventory under hard safety caps
inventory(target, limit=200, after=None, path=None, manager=None)  # bounded report
```

`target` is the containing project directory. Paths passed to policy functions,
`after`, or `path` are exact portable paths relative to the outer `.SYSTEMX`.
The optional `manager` injection is for callers already holding the trusted
manager module. By default the tool loads the manager from its own checkout,
never executable code from an arbitrary target. Errors raise `ProvenanceError`
with a safe `code`, logical `path`, and `message`.

For an import review, use the complete internal inventory to enumerate existing
preserved host files, including paths absent from an incoming bundle. Apply the
incoming import's own preservation/conflict policy. A matching path or blank
seed is evidence about bytes and cannot grant overwrite authority.

Focused verification uses temporary synthetic intact retained releases, literal
expected ownership entries, exact/normalized comparisons, inactive snapshot
failures, unmanaged targets, links/types, paging and byte-preservation checks:

```bash
python3 -B -m unittest discover -s tests/systemx -p test_provenance.py
```
