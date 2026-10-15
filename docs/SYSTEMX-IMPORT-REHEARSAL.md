# Rehearse import preservation with public fictional records

The import rehearsal runs the actual WebAppX importer against an owned temporary
source repository and fictional adopted app. It reports before/after SHA-256
fingerprints for selected logical paths, including preserved project records and
host-only extensions. It never accepts a live adopted target or copies a private
app's records into the rehearsal.

```bash
python3 -B scripts/systemx-import-rehearsal.py
python3 -B scripts/systemx-import-rehearsal.py --limit 10 --offset 0
```

The command requires the existing Python, Git and tar tooling used by the host
importer. It adds no dependency. All mutations, fixture commits, importer
receipts, archive extraction, coordination-view refresh and manager history are
inside an owned temporary workspace that is removed before success is reported.
The real checkout's Git state, outer project records and runtime payloads are
excluded from those operations.

Read [managed integration](SYSTEMX-INTEGRATION.md),
[upstream review](SYSTEMX-UPSTREAM-REVIEW.md) and
[ownership provenance](SYSTEMX-PROVENANCE.md) for actual maintenance policy.
Rehearsal evidence grants no import, worker, provider or deployment authority.

## Source and fixture boundary

The source mode is `local-verified-snapshot`. The tool reads this checkout's
installation selection and verifies the selected retained public distribution
with the existing manager APIs. It chooses the newest supported earlier retained
release as the baseline when available. In the current retained set, that
exercises **1.9.0-alpha.5 → 1.9.0-alpha.6**. If only one supported retained release
is available, it explicitly reports `same-version-reimport`, with that narrower
scope. Historical releases below isolated-runner support are not installed.

Only manifest-listed verified public distribution bytes are copied into the
temporary source repository. Its baseline and incoming Git commits are synthetic
fixture revisions. They are separate from historical upstream commits and do not
establish current public main. The exact fixture source path and exact
`ls-remote origin refs/heads/main` observation receive an injected local response.
Unexpected sources or transport requests are refused. The report states
`publicMain.state: "not-queried-fixture-observation"` and a null public-main
commit. No network verification occurs.

The actual importer is invoked twice with `apply=True` and the exact fixture
commit: first to install the baseline, then to import the incoming distribution.
Between those calls, the tool writes a fixed reviewed map of **20 public,
fictional host paths**. Examples cover context, access references, plan/map,
project and agent memory, a real TODO ledger/focus, command configuration, LAN,
KIT, Template, hooks/deploy, reconciled documentation/menu, host history/version
and a disabled Gusto fixture. Existing overlaps deliberately differ from stock;
other fixture paths exist only on the host. The selected record APIs validate
the fictional task/focus and refresh their generated views before capture, then
validate them again after the import.

The rehearsal performs real fixture installation, version selection, recognized
bootstrap planning/refresh, receipt creation and re-pinning through the unchanged
importer. A version upgrade does not necessarily require bootstrap replacement;
the report exposes the actual add/replace lists. Existing outer defaults remain
preserved according to the manager's additive import rules, while the selected
immutable snapshot contains the incoming universal defaults.

## What the fingerprints establish

Hash selection is restricted to the temporary target and these reviewed paths:

- The fixed fictional host map.
- Manifest-listed public outer defaults, excluding local/runtime boundaries.
- The baseline and incoming immutable distribution files.
- The temporary installation metadata and version-specific import receipts.

No arbitrary host-only path is added to hash selection. The generic provenance
inventory continues to classify unknown host files without reading their content;
this rehearsal does not expand that inventory's privacy behavior. The public
source is checked only through installation selection and explicit immutable
distribution files. Live outer context, plan, tasks, memory, configuration and
runtime payloads are not opened.

`fictionalHostFingerprints` independently pages the 20 fictional host paths.
The default limit of 25 therefore displays both project records and host
extensions immediately. Each row has a logical path relative to `.SYSTEMX`,
ownership/role/update policy, preservation state and exact before/after digests.
It contains no file text. Ownership comes from the versioned provenance policy;
byte equality never authorizes replacement.

The four `fingerprints` groups contain `preserved`, `changed`, `missing` and
`added` rows over the complete reviewed selection. Expected installation metadata
changes, recognized bootstrap replacements and incoming snapshot/default/receipt
additions are reported explicitly. They do not become preservation failures
merely because an import changes manager state. Postconditions separately require
the actual bootstrap/new-default bytes and receipt commit/manifest binding, so
an expected path label cannot hide corrupted output.

Success requires all of these checks:

- Every fixed fictional host path retains its exact expected bytes.
- The first import receipt retains its exact bytes, commit and manifest binding.
- Both immutable fixture snapshots exactly match their verified public inputs.
- New receipts bind to the actual synthetic fixture commit and manifest.
- Root bootstrap bytes equal the incoming distribution and newly added outer
  defaults equal their public source bytes.
- The fictional records and generated views remain valid.
- Selected/pinned version equals incoming, with manual updates and retained history.
- Both actual importer applications completed.
- The inspected public source snapshots, including their verified blank seeds,
  remain byte-identical after the rehearsal.

The final source check concerns the explicit immutable public inputs. It does
not claim to have hashed live outer project records or runtime contents.

## Report and pagination

JSON reports use `schemaVersion: 1` and `kind: "systemx-import-rehearsal"`.

| Field | Evidence |
| --- | --- |
| `source` | Local verified snapshot mode, baseline/incoming version, upgrade versus reimport scope, distribution manifest fingerprints and exact public file-map digests; public main remains unqueried |
| `fixture` | Explicit fictional identity, synthetic source commits, actual apply flag and actual bootstrap changes |
| `fictionalHostFingerprints` | Independently paged fixed fictional project/extension before/after fingerprints |
| `fingerprints` and `counts` | All four comparison groups and complete pre-pagination totals |
| `checks` | Concrete preservation, integrity, record, receipt, byte and selection postconditions |
| `blocking` | Complete conflict/check-failure counts, plus independently paged details |
| `receipts` | Fixture version, synthetic commit, manifest fingerprint and exact receipt digest; no raw receipt payload or timestamp |
| `privacy` | Explicit source/target read/write scope and hash-selection boundary |
| `cleanup` | `owned-temporary-workspace-removed`, added only after successful cleanup |

Each list has `total`, `returned`, `offset`, `truncated`, `nextOffset` and `items`.
The default per-group limit is 25 and the maximum is 100; offsets range from
0 through 100,000. The same offset applies independently to each group. All
blocking totals and postconditions use the complete capture before pagination.
A high offset cannot hide a failure or turn it into success.

Every command invocation performs a fresh owned rehearsal. Logical ordering and
public/fictional content digests remain stable for unchanged inputs, while
installation and receipt digests can differ because the manager records new
fixture timestamps. Pages from separate invocations are separate observations.
Retain the JSON from the run being reviewed when recording evidence.

Exit 0 means the synthetic rehearsal passed its complete checks. Exit 1 means
the rehearsal failed or could not complete; fixed diagnostic codes identify the
stage without printing raw subprocess errors, file contents or machine paths.
Failures before capture do not manufacture an empty successful comparison.
An interrupted invocation stops its owned workers, emits a fixed interruption
diagnostic and exits 130.

## Bounds, links and worker ownership

Public snapshot inspection bounds manifest files with the existing manager's
limits and additionally caps complete structural walks at 2,500 entries, depth
at 64 and bytes at 64 MiB per distribution. Target capture permits at most
7,500 explicitly selected paths and 192 MiB of bounded content. Every selected
file must be an unlinked regular file with safe parents; links, junctions,
hard links, escaping paths and unexpected snapshot entries are refused.

Root local/cache/history/session/secret boundaries are pruned from fingerprint
selection. The tool never reads fixture or live runtime payloads. The actual
manager does create its normal history/operation state inside the owned fixture;
that state is removed with the fixture and is not emitted.

Git children use argument arrays, isolated global/system configuration, empty
owned templates/hooks, disabled signing/fsmonitor/transports and bounded
timeouts. A local untracked `.git/info/attributes` override keeps schema-valid
CRLF public snapshot bytes exact through the synthetic Git commit/archive.
Inherited Git overrides and tar options are stripped.

Importer and record workers run in isolated Python interpreters. Their temporary
directory environment points inside the owned workspace. A timed-out or
interrupted worker's owned process group/tree is terminated before failure is returned; the workspace
then removes temporary archives and target state. POSIX descendant termination
is exercised locally. Windows uses its process-tree termination tool on the
owned worker; native Windows x64/ARM64 runtime acceptance remains separate.
The importer worker has a 90-second deadline, record workers 20 seconds and
fixture Git operations 20 seconds. Individual subprocess output limits are
checked before accepting their result.

## Verification and reuse

```bash
python3 -B -m unittest discover -s tests/systemx -p test_import_rehearsal.py -v
```

Fixtures exercise the actual two-apply version upgrade, fixed host path output,
non-stock record/extension preservation, valid generated views, damaged/linked
source refusal, CRLF exact bytes, source/runtime read boundaries, narrow
observation injection, inherited Git/tar isolation, complete counts under paging,
intentional host/bootstrap/receipt corruption and actual descendant timeout/interruption
cleanup. No live adopted app or provider participates.

Local Python callers can use `run_rehearsal(limit=25, offset=0)` for the complete
owned workflow, or `compare_fingerprints(before, after, ...)` for a pure bounded
comparison of already reviewed SHA-256 maps. The comparison helper reads no
filesystem content and grants no authority to hash a private app. The rehearsal
CLI exposes pagination only; it has no source, destination, selection or apply
operand that could redirect mutations into a live project.
