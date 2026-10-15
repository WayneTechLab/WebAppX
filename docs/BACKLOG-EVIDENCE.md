# Proposal evidence review index

[webappx-evidence-index.json](backlog/webappx-evidence-index.json) attaches dated,
scoped review references to proposals in the canonical
[1,000-item catalog](backlog/webappx-1000-todo.json). Its
[schema](backlog/webappx-evidence.schema.json) describes the record structure;
[the local validator](../scripts/backlog-evidence.mjs) also verifies dates, known
proposal IDs, revision relationships and existing contained files.

The catalog owns proposal status and completion metadata. This index contains
review attachments and deliberately prohibits status/completion fields at every
record level. Evidence can be attached while a proposal or its prerequisite
awaits acceptance. Index commands read local files and print results; they do
not change the catalog, start workers, contact providers or accept work.

## Inspect and check

Run from the repository root:

```bash
node scripts/backlog-evidence.mjs --check
node scripts/backlog-evidence.mjs --summary
node scripts/backlog-evidence.mjs --id WX-0717
node scripts/backlog-evidence.mjs --category browser --limit 10
node scripts/backlog-evidence.mjs --markdown
node --test tests/backlog/evidence.test.mjs
```

Queries return at most 20 review records by default; `--limit` accepts 1–100.
An exact ID may return zero records for a known proposal with no attachment.
Category filtering returns only references of the chosen category, retaining
the containing review's scope and limitations. The check validates all records;
`--markdown` explicitly prints a complete Markdown view to stdout. Its relative
links are intended for a page saved under `docs/backlog/`. The CLI has no write,
apply, completion, task-state or provider-request mode. It does not fetch links
or assert that a receipt's reported observations are true.

## Attach a reviewed receipt

Manually append a review to the JSON index after reading the actual source and
receipt. Use a unique `WXR-0001`-style identifier, an existing `proposalId`, the
full lowercase 40-character `examinedRevision`, and the actual `reviewedOn`
calendar date. State the reviewed behavior in `scope` and the remaining
acceptance boundaries in `limitations`. Each review carries one to eight
evidence references; the index accepts up to 1,000 reviews and the CLI caps the
input at 1 MiB. Multiple dated reviews may reference the same proposal.

Each evidence record contains:

| Field | Meaning |
| --- | --- |
| `category` | `local`, `browser`, `provider` or `operator` evidence method/scope. This does not change the proposal's acceptance gate. |
| `reference` | Existing regular file under this repository, using a relative POSIX path. Store reviewed, redacted public receipts here; keep credentials, personal data and runtime artifacts outside tracked files. |
| `observedOn` | Original observation date, no later than the review date. Reusing a receipt retains its date. |
| `observationRevision` | Full revision recorded for the observation, qualified by `revisionBasis`. Reusing an observation retains its revision. |
| `revisionBasis` | `examined-source` means the observation concerns the exact examined revision and must equal it. `receipt-source-base` means the original receipt records a starting/source base; it does not identify an exact final browser build. |
| `scope` | What this particular receipt supports, including whether it records source inspection, synthetic checks, an actual browser run or historical evidence reuse. |

References reject absolute paths, Windows drive/UNC paths, URLs, queries,
fragments, percent escapes, backslashes, empty segments and `.`/`..` segments.
Both the repository and target are resolved with `realpath`; missing files,
directories and symlink escapes fail. An internal symlink to a regular file
inside the repository is permitted. Provider and operator references use the
same local-file contract, allowing a reviewed redacted receipt without embedding
credential-bearing URLs or contacting an external environment. Their categories
do not grant provider access or deployment authority.

After an attachment, run the check and inspect the exact-ID query. Preserve the
original receipt and its limitations. Evaluate current acceptance separately
against the canonical criterion and prerequisites through Agent 0's review.
An attached review neither refreshes a browser observation nor establishes that
unchanged-looking behavior still works at the current checkout revision.

## Recorded examples

**WXR-0001 / WX-0717** links the source examination at
`0469e11bcb17ec67b118099a73958e039c759979` to the
[foundation review](EXISTING-FOUNDATION-ACCEPTANCE-2026-10-15.md). Its separate
browser reference retains the
[keyboard receipt](KEYBOARD-PORTALS-QA-2026-10-15.md)'s recorded wave base,
`cae18da251b0a9c4418a4fbebf2bd514ccd2dcdd`. Both dates are 2026-10-15, but they
describe different source contexts. The foundation review inspected source and
test assertions and reused the earlier browser observations; it did not run the
browser again. That browser receipt includes Undo cancellation focus return and
removed-opener fallback among nine local Chromium checks.

The foundation receipt leaves WX-0708 prerequisite acceptance pending and does
not independently authorize closing WX-0717. The initial attachment therefore
records verified behavior alongside that boundary. Read the catalog for current
status; there is no duplicate status field here. Neither reference establishes
Windows, screen-reader, whole-site accessibility, provider or deployment results.

**WXR-0002 / WX-0452** records the same foundation review's local retention
inspection and its dated synthetic restore-budget result: 12 passed, zero
failed, zero skipped. Index validation does not rerun those checks. The initial
index has two reviews and three references: two local, one browser, zero provider
and zero operator observations. No external observations have been invented to
illustrate the supported categories.

Reusable `.SYSTEMX` context, task, plan, memory seeds and immutable managed
snapshots retain their own boundaries. Public template evidence belongs in these
host documents; attachments do not import another project's private records.
