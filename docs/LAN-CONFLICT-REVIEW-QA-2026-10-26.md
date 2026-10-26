# LAN conflict review QA — 2026-10-26

Status: implemented candidate; 21 isolated browser groups passed. Actual-stack
Navigator regression and aggregate acceptance remain pending.
The accepted program remains **60 requirements / 12 capabilities**. This batch
proposes LAN-00026–LAN-00035 and LAN-00041–LAN-00045: 15 requirements covering
three F001 capabilities. No proposed requirement is checked by this initial receipt.

Baseline: `ca6acec6e6780ac738b4ad3e87006a5052f7358a`.
See the [active iteration](LAN-ACTIVE-ITERATION.md) and
[generated execution plan](LAN-10000-EXECUTION-PLAN.md).

## Implemented scope

The raw source editor compares its retained proposal with a freshly read current
file, showing loaded and current revisions, the proposal's text digest, literal
snapshots and bounded changed-line excerpts. Viewing or cancelling the comparison
does not promote source or rebase the loaded editor. The comparison is positional
line presentation, not an automatic merge or minimal edit alignment.

Review replacement binds the exact path, loaded baseline, displayed draft,
proposed wire representation and latest revision. Preparing clears the previous
approval; a new SAVE LOCAL CHANGE confirmation is required. The normal source
POST uses the reviewed latest revision only while that preparation remains valid.
A newer external edit still conflicts. Input, selection, load and observed source
changes invalidate the review. Accepted saves retain newer input as dirty through
the existing baseline contract. Selected-text editing keeps its independent
revision flow; a leaf save invalidates a raw comparison for the same source.

Missing contained allowlisted source returns fixed 404 SOURCE_UNAVAILABLE guidance
without source, path or revision details. The editor retains its draft and loaded
revision and offers no recreation action. Disallowed paths, directories and links
remain 400 refusals; existing authority, confirmation, secret and stale-write
checks remain. These checks are optimistic single-file preconditions, not an
operating-system lock or multi-file transaction.

## Comparison bounds

Each input is inspected up to 500,000 UTF-16 code units and 10,000 line records.
At most 200 changed rows are returned, with 1,000 code units per text cell.
Line endings, BOM and Unicode remain distinct; string cropping does not split
surrogate pairs. Incomplete or truncated comparisons cannot prepare replacement.
The displayed current text's UTF-8 digest must reproduce the server's raw-byte
revision. This supports valid UTF-8 source, including BOM and CRLF; it does not
claim edited mixed-line-ending or invalid-UTF-8 byte preservation.

## Observed checks so far

- `npm test`: 39 passed, no failures or skips, including 10 pure comparison tests.
- Scoped and aggregate ESLint, syntax checks and diff whitespace checks passed.
- The generated queue check and 16 focused compiler tests passed. Accepted counts
  stayed 60 requirements / 12 capabilities during implementation.
- The final isolated source browser run passed all **21 groups**, with no page
  errors or unexpected requests; all 28 implementation inputs and protected
  real source/seeds were preserved. Five loaded browser module/stylesheet byte
  hashes matched the copied inputs. Actual-stack Navigator regression, full CI
  and separate Hosting preflight remain pending before acceptance.

Browser writes and simulated external edits must stay in disposable synthetic
copies. Preserve real app source, reusable blank seeds, managed snapshots,
research packages, user browser state and unrelated local listeners. Runtime
paths, credentials, emulator datasets and private trace locations stay outside Git.
Production deployment is not authorized by this receipt.

## Pre-acceptance findings

The first browser attempts did not complete. Test synchronization and cleanup
needed to account for a pending refresh and selection-driven return to Settings.
A later complete run passed its original 20 groups, then a new workspace-refresh
case reproduced a real selector defect: the deleted loaded target disappeared,
selection fell to another file, and comparison became inaccessible while the
draft and loaded revision remained. That run is a failure, with retained trace,
result, screenshots and implementation-preservation evidence.

Independent source review also reproduced split UTF-8 request-chunk corruption in
the existing request parser. This blocks exact reviewed replacement until a
streaming decoder repair and real chunked HTTP regression pass. Final acceptance
must bind the repaired UI and parser, with new matching browser fingerprints.

The decoder repair now passes the actual split-chunk regression: BOM, emoji,
accented and CJK characters plus CRLF save byte-for-byte as reviewed, with the
expected returned revision and exact predecessor backup. The regression first
failed against the prior parser with a successful response and the wrong saved
hash, establishing the defect before repair. The repaired shared parser retains
its inclusive 1,000,000 decoded UTF-16-unit body limit; tests accept the exact
boundary with more than 2 MB of UTF-8 bytes and refuse one decoded unit beyond it.
Malformed JSON and the separate 500,000-unit source-content limit are refused
without source or operation effects. The focused source suite has 9 passing
checks; Python security-control fixtures have 8 passes. Final browser and
aggregate acceptance still need the repaired UI and decoder together.

## Final isolated browser evidence

The final owned-fixture run `source-revision-run-qTMHNi` passed all 21 groups after
the selector and decoder repairs. It retained all 11 earlier source-editing
groups and exercised read-only snapshots and hashes, literal rendering,
Cancel/input/file/pending-read invalidation, failed comparison recovery, clipped
and inconsistent snapshot refusal, separate preparation/approval, a post-review
external conflict, exact accepted replacement backup, actual unavailable-source
GET/POST no-recreation, and the real workspace-refresh omission regression.

The refreshed selector retained the loaded Home path and exact draft, approval
and loaded revision. Compare stayed accessible; an actual 404 then disabled Save.
Inventory omission alone did not establish source unavailability. Targeted
screenshots show the actual comparison panes and changed-line excerpts inside
the existing narrow inspector, with horizontal scrolling.

| Retained artifact | SHA-256 |
| --- | --- |
| Final browser result | `17a58062a3fcc0347ae81f6566a785d4792e6bad896cba8ab828c8f7b40f5528` |
| Input/preservation/artifact manifest | `829821408ecc5881936411b9c9f79e4506b1a44975e5e09c6a5627cfb9bb86c7` |
| Final browser trace | `8cb685cca1e45a49ab03a167a89bfa5741300d3ff1b8a0025dc6f345a5438310` |

The manifest binds the implementation, tests and loaded browser assets. Source
writes, deletion and external edits used a disposable synthetic copy. Private
artifact locations, dataset values and runtime records stay outside Git.
Earlier attempts remain retained as failures or incomplete evidence.
