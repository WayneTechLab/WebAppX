# LAN conflict review QA — 2026-10-26

Status: **locally accepted 15-requirement batch covering three F001 capabilities**.
The program now has **75/10,000 requirements and 15/2,000 capabilities accepted**;
**9,925 requirements remain TODO**. Agent 0 accepted LAN-00026–LAN-00035 and
LAN-00041–LAN-00045 after independent review and terminal verification.
Functional candidate `d9bd9e763ef2274ebaace559c32c92103c53ca12` passed all **68 CI stages**, separate
**Hosting preflight**, **21 isolated source-flow browser groups**, **16 actual-stack
Navigator groups** and **three actual-app read-only comparison observations**.
App 3.4.0 retains deployment count 0; production deployment was skipped.

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
  and separate Hosting preflight subsequently passed on the same functional candidate.

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
the existing request parser. This initially blocked exact reviewed replacement; the final streaming-decoder
repair and real chunked HTTP regression subsequently passed. Final acceptance
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
checks; Python security-control fixtures have 8 passes. The final browser and aggregate runs verified the repaired UI and decoder together.

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

## Actual-stack integration and terminal verification

The fresh Navigator regression passed all 16 groups with 745 browser GET requests
and four explicit GET preflights, no page errors or refused requests, and all 687
protected fingerprints unchanged. A separate fresh context loaded actual Home
source, typed a client-only comparison comment and performed Compare latest.
Its three observations passed with 165 GET requests, no source POST or replacement
preparation, and all 730 protected source/harness/seed/model files unchanged.
The served dashboard and comparison-module bytes matched the committed candidate.
These read-only observations corroborate integration; isolated fixtures provide
write/recovery acceptance. Neither used the existing user browser context.

| Check | Tested source and terminal result |
| --- | --- |
| Full `npm run ci:all` | `d9bd9e763ef2274ebaace559c32c92103c53ca12`; 2026-10-26T22:24:37.373369+00:00 through 2026-10-26T22:37:05.245696+00:00; exit 0. |
| Separate Hosting preflight | `d9bd9e763ef2274ebaace559c32c92103c53ca12`; 2026-10-26T22:38:23.584521+00:00 through 2026-10-26T22:38:44.163308+00:00; exit 0. |

Full CI includes 39 npm tests and the existing portal, lifecycle, security,
dependency, template, managed-integrity, research, build and production-isolation
gates. The pipeline retains 68 required stages and 134 package-script names.
Existing build-size warnings remain advisory. Tests ran on macOS with Node
25.8.1; declared runtime pins and backend policies were preserved. Native Windows,
live provider and production acceptance are not inferred.

The six affected historical guide mappings were reviewed against the functional
candidate; six guarded retain decisions grew history from 50 to 56 without
changing original entries or the 19 guide/receipt/mapping inputs. Acceptance
metadata and generated views follow the tested functional commit. No runtime
source changed for these metadata updates.

The owned emulator session was exported privately before restart and explicitly
imported into the refreshed local stack. Owned-process and component readiness
checks passed; Auth/Firestore import messages and complete startup were retained.
Storage readiness is a listener check, not a record-by-record recovery or provider
workflow result. Runtime addresses, export datasets and process records remain
outside tracked template files.

## Tested fingerprints

| Repository-relative file | SHA-256 |
| --- | --- |
| `.SYSTEMX/LAN/server.mjs` | `afcf9bc45918d69cbe34e0c7e34a39a8188f50be4a5cf79b052f5ecb6f320839` |
| `.SYSTEMX/LAN/Website/dashboard.js` | `c79cafb1f57d5cea5f470e3a1db50f3d4fdb75e6903f8b4932919ea8f91001b6` |
| `.SYSTEMX/LAN/Website_Dashboard.html` | `8aff669d95dec04e8b5861db0d3021f96fef5dd1101fc122c3472e2f5f64bf33` |
| `.SYSTEMX/LAN/Website/dashboard.css` | `6bc85f257c3677473bba34e65d2cdf839a1d8cdcfb65fb0f8f3e12911414fc38` |
| `.SYSTEMX/LAN/Website/source-comparison.js` | `f8442e2adafffc7be2b6c16d53e5f589fb9cd690df74d2cd357fe27b3a9316e9` |
| `.SYSTEMX/LAN/tests/source-revision.test.mjs` | `042d3fd5dc0661b03ae97467f10e6b44cdba6c487b75de260958f7352d6673e9` |
| `.SYSTEMX/LAN/tests/source-comparison.test.mjs` | `6f05003dd1b06117c1f2e67b35579285b51bf16f462710a227f8f687b2a2a7c3` |
| `.SYSTEMX/LAN/tests/source-revision-browser.mjs` | `20f857e42bf4048062e5ad412195e3bac9b8e9fed728ccbe138f712ada6c28d5` |

| Additional retained artifact | SHA-256 |
| --- | --- |
| Navigator result | `08975fee440c30907e6cd001babb5c2303f75893813a859d586cf3d250f0ca8b` |
| Actual Code comparison result | `3f937609455388b8225f3604170a8563a92fd814857015ab0bf171b22fea6953` |
| Actual-stack manifest | `f13e804ed1f17d7d417ac691595e7772bc74bef0aee391679266936e6bf963f1` |

## Acceptance metadata checks

After the receipt and progress ledger were recorded, exact catalog regeneration
and check passed at 75 accepted requirements / 15 capabilities. Thirty backlog
tests, 14 CI-plan tests and all 39 npm tests passed again. Template parity,
maintained documentation commands and links, and host synchronization checks also
passed. The original 60 completion records remain unchanged. Generated counts do
not grant provider, operator or production authority.

## Exact accepted requirement bindings

```lan-completion-evidence
{
  "schemaVersion": 1,
  "requirements": [
    {
      "id": "LAN-00026",
      "definitionSha256": "c163e74c82aa81b7ced428870fb1fcaf56a0f251381b5da3f2234edcd3929e39",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00027",
      "definitionSha256": "c03823857c93ccb345e43d5a74d7ccfd810b84db604ecc7ffb1f6f888ee343c8",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00028",
      "definitionSha256": "53070c18b8714a56ac29393aa4601500867ea7ca3a05369e4a562aff0a3f1344",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00029",
      "definitionSha256": "7140923e9f86c8f21ba6bfa7429ccce6ff1c618972f716e76f2cc376c354a5dd",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00030",
      "definitionSha256": "cfafeaee81a532b1b04b7d778f0a379cf9abad5ce8ec7b800a2d6d45a9021917",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00031",
      "definitionSha256": "26c7f9828e7e73837453964047b482958371afcf1ce0ef745cdff7376934a314",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00032",
      "definitionSha256": "fd50761e0e047be9a6136920426430a2e654534987ac0a29ce3c8822c55ae0b3",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00033",
      "definitionSha256": "9e80c384b378dd2d96a3c4de8e5ee553fb34f86c48bc2fd3dcff2f732563e5c5",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00034",
      "definitionSha256": "5f1f032b89894a0b7aa35ff3600ca3fe03a06c3fe417c675206e3153046637fa",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00035",
      "definitionSha256": "5727f9ce45bbcb597c79362b0622e9abb773c9a5ee7459579cfdcf3923294ee8",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00041",
      "definitionSha256": "770aa0cea26d620617229edf2fba342b3a771bb231354b910dd930939dfad464",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00042",
      "definitionSha256": "cc00318fd23f74464a0744629be52b3fb4b28740ea06c3726a7264df35e72e69",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00043",
      "definitionSha256": "1b64949bd58a18f8e4c04aae8b9ef88886b37ce97cb004d39428a1dbb3269062",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00044",
      "definitionSha256": "9103f5e86f843ccd8eddaf8c9789a48982926e073b18437c6b189acdf63b89e6",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    },
    {
      "id": "LAN-00045",
      "definitionSha256": "9c858c105d8fb90c04ff6d9dfd02262c80ffca4cb55e10ec49e941f8c23fd498",
      "sourceRevision": "d9bd9e763ef2274ebaace559c32c92103c53ca12"
    }
  ]
}
```
