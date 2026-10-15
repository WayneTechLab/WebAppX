# Review documentation evidence after source changes

This workflow addresses WX-0901. It identifies guides whose mapped source
scopes differ between their examined revision and the review target, displays related proposal
definition advisories, and records a dated maintainer decision. It preserves
original receipts and their dates, revision qualifications and byte digests.
Catalog completion remains in the canonical backlog. Review decisions do not
change task state, refresh a browser observation or establish provider health.

## Preview an explicit target

```bash
node scripts/documentation-freshness.mjs --to REVIEWED_LOCAL_REVISION
node scripts/documentation-freshness.mjs --to REVIEWED_LOCAL_REVISION --json
```

`--to` is required. The existing [committed source impact engine](BACKLOG-REBASELINE.md)
resolves it to a full locally available commit SHA and compares that endpoint
with each guide's full `examinedRevision`. This is a direct endpoint comparison;
the workflow does not infer ancestry or chronological ordering. It binds the committed catalog at
the mapping's reviewed revision and verifies its exact SHA-256 digest. Git
revision handling, local-object policy, NUL change parsing, rename endpoints,
timeouts and output limits come from that engine. No new Git diff engine,
fetch, browser run or service request is introduced.

The mapping, guides and receipts are **explicitly reviewed local inputs**.
Their paths and byte digests are recorded in the report. The tool does not
claim that their current document bytes are blobs from `--to`. Uncommitted
document changes require a deliberate mapping review; a digest mismatch refuses
the preview. Source comparison still uses committed endpoint trees and never
substitutes the index or workingtree for source revisions.

## Reviewed mapping contract

The host-owned [mapping](evidence/documentation-freshness-map.json) uses schema 1,
`intent: "documentation-evidence-freshness"`, a bound `catalog`, and `guides`:

| Field | Reviewed meaning |
| --- | --- |
| `catalog.path`, `revision`, `sha256` | Repository-relative committed catalog, full revision and exact byte digest. This identifies the proposal edition. |
| Guide `id` | Unique stable identifier for a guide review. |
| `guide.path`, `guide.sha256` | Contained local Markdown file and exact reviewed digest. |
| `examinedRevision` | Full commit used as the source-comparison baseline. |
| `sourceReview.reviewedOn`, `scope` | Actual source-review date and explanation of what was inspected. A source-only review is described as such. |
| `proposalIds` | IDs that must exist in the bound committed catalog, used for definition advisories. Their relationship to the guide is reviewed explicitly rather than inferred from prose. |
| `sourceScopes` | Explicit guide dependencies, matched as exact paths or slash-delimited directory descendants. These may include implementation files added after the original proposal source pointer was authored. |
| `receipts` | Original receipt paths/digests, categories, observation dates, qualified revisions and supported scope. |

Each receipt contains `path`, `sha256`, `category`, `observedOn`,
`observationRevision`, `revisionBasis` and `scope`. The date must be a real
calendar date no later than the guide's source-review date. The tool checks
that the receipt contains the literal mapped observation date and revision;
human review establishes what the prose actually supports.

Two revision qualifications are supported, following the
[existing evidence index](BACKLOG-EVIDENCE.md):

- **`examined-source`** describes an original observation at the receipt's exact
  `observationRevision`. A later source-only guide review can have a different
  `examinedRevision`; keep the original exact observation revision and its
  qualification. Preview does not rerun that observation.
- **`receipt-source-base`** retains a receipt's original starting source base.
  This does not identify the exact final browser build. A new source review
  must preserve this qualification and cannot relabel the receipt as a browser
  observation at the new examined revision.

The supplied mapping reviews the rebaseline and portal-state guides against
published source `aae465ae033f3191a69ed7d40056b0c6e2159e17`. Those are
source-only document/implementation reviews. The
[adoption receipt](SYSTEMX-ADOPTION-QA-2026-10-15.md) keeps its original
`f8494b750447af7d4e39695f4a6fceeff29f48bb` starting base; the
[session/contracts receipt](SESSION-CONTRACTS-QA-2026-10-15.md) keeps
`4ca558015a66c4f7b9f50eb085f98ab62c1c8335`. Both retain the original
2026-10-15 observation date. The mapping supplies no new browser evidence.

## Interpret candidates

| Assessment | Meaning and next action |
| --- | --- |
| `source-changes-require-review` | At least one committed changed path matches a mapped guide source scope. Read the changed implementation and original evidence before deciding what needs updating. |
| `definition-review-advisory` | A mapped proposal definition changed, while no mapped product source path matched. Review the changed requirement or scope. |
| `no-mapped-source-change` | The bounded committed comparison found no matching source path or related definition advisory. This does not establish current browser behavior or completeness of the manually reviewed dependency map. |

Unrelated paths do not request guide review. Catalog status/completion edits
and verified exact generated metadata companions follow the impact engine's
metadata policy. Related title, acceptance, source or dependency changes remain
definition advisories. Both rename endpoints and deleted paths are matchable;
matching does not open source files or resolve their symlinks.

Guide matching uses the complete changed-path set, independently of the impact
engine's first 100 displayed proposal matches. Proposal membership is checked
against the complete catalog blob already read and validated by that engine,
bound to its reported revision/path/digest. The check adds no Git commands and
never substitutes a workingtree catalog; an unknown ID is refused even if local
uncommitted JSON contains it. If underlying change records or
definition IDs are truncated, the whole freshness preview refuses to issue a
result. Each guide displays at most 20 relevant paths with its exact total and
omission count. `currentBrowserVerified` is always `false` for this workflow.

## Record one deliberate decision

Read the preview and evidence first. Copy its `reportDigest`,
`decisions.sha256` and resolved `targetRevision` into an explicit append:

```bash
node scripts/documentation-freshness.mjs --to FULL_REVIEW_TARGET_SHA \
  --record-decision --guide backlog-rebaseline --decision retain \
  --reviewed-by MAINTAINER --reviewed-on YYYY-MM-DD \
  --rationale "Retain the historical receipt within its original scope; the reviewed changes do not require new observations." \
  --expected-report-digest REPORT_SHA256 \
  --expected-decisions-digest DECISION_HISTORY_SHA256
```

Use `retain` to record the reason existing qualified evidence remains useful,
or `refresh-needed` to record the gap and the next verification required. The
tool accepts either decision when supported by an explicit rationale. A retain
decision does not clear the source-change candidate, accept work or certify
that an old browser run applies to a new build.

The [decision history](evidence/documentation-freshness-decisions.json) uses
schema 1 and `intent: "documentation-review-decisions"`. Each append stores:

- Stable review ID, guide ID, reviewer, actual review date and rationale.
- Full resolved target SHA and the preview's `reportDigest`.
- Mapping, combined local-input and guide-scope SHA-256 bindings.
- The explicit `retain` or `refresh-needed` decision.

The history contains no proposal/task status or completion fields. A preview's
source report digest is stable after appending a decision; its separate
decision-history digest changes. Matching records are returned only when their
exact target and source report digest match the preview. Records for older
targets remain preserved without being presented as current decisions.

Recording reruns the preview and rejects stale report/history digests, unknown
guides, invalid/future dates and dates earlier than the source review. It
acquires an exclusive sibling lock, rechecks document/history digests, creates
and syncs a new JSON file, rechecks again, and atomically replaces only the
selected decision history. Existing decisions are retained byte-for-field in
the JSON records. A duplicate guide/target/report binding is refused rather
than overwritten. Concurrent tool writers serialize; an existing lock is
preserved for its owner. Temporary/lock files created by this invocation are
removed on completion or a handled failure.

If history is intentionally absent, preview returns `decisions.sha256` as
`absent`; that exact token authorizes initial creation. The parent directory
must already exist. Alternate mapping/history paths can be supplied with
`--mapping` and `--decisions`; both must be distinct JSON files directly under
`docs/evidence/`. A history cannot overwrite a guide, receipt or mapping input.

## Update the map without rewriting history

After inspecting a changed guide or its source relationships, deliberately
update its local digest, reviewed source scopes, source-review date/scope and
examined revision as appropriate. Keep existing receipt files, their byte
digests, original dates and revision qualifications. If fresh execution is
needed, create a separately dated receipt with its actual source/host/origin
evidence, then explicitly add that new reference. Do not edit an old receipt's
date to satisfy freshness or reuse a starting source base as an exact build.

The map is a dependency/review aid. It is separate from the canonical
[proposal catalog](backlog/webappx-1000-todo.json),
[review attachment index](BACKLOG-EVIDENCE.md), and blank reusable SYSTEMX task
and memory seeds. None of those records is rewritten by this workflow.

## Bounds and verification

Mappings allow at most 20 guides, 12 source scopes, 20 proposal IDs and four
receipts per guide. Local files are limited to 1 MiB; history is capped at 200
decisions. Relative paths are bounded to 240 characters. Symlinks, nonregular
files, path escapes, unknown schema fields, digest drift and incomplete Git
inputs fail closed. Files are inspected only through contained local public
Markdown/data paths; no secret/runtime discovery occurs. Inherited impact-engine
Git limits and unsupported-checkout policy apply. These are checked local
observations, not a filesystem lease against arbitrary external mutations.

```bash
node --test tests/backlog/documentation-freshness.test.mjs
```

The focused suite uses temporary real Git commits and literal expected scopes,
counts, metadata exclusions and definition advisories. It rejects syntactically
valid unknown IDs using the committed catalog, including workingtree poisoning
and cached multi-guide comparisons. It checks full target
bindings, historical versus exact observation qualification, missing revisions,
scope/input/history staleness, duplicate/lock refusal, regular-file boundaries,
input caps, and both API and CLI append behavior. Receipts, guides, catalog,
index, unrelated worktree content and blank task records are compared byte for
byte across previews and decision recording. These checks are local evidence;
they establish no Windows runtime, browser, provider or deployed acceptance.
