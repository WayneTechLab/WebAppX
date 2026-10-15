# Recorded work status

The local SYSTEMX status view distinguishes reusable work seeds, the WebAppX
proposal catalog, and an explicitly selected scope's recorded project work.
Open the LAN builder's **AGI / Agent 0** panel to inspect all three sources.
The local React status card shows the same summaries and links to the builder.

| Source | What the view establishes |
| --- | --- |
| Reusable work seeds | Readable outer task, focus and role records; exact byte comparison with those three files in the selected installed release |
| WebAppX roadmap proposals | Catalog identity, current computed TODO/done counts and SHA-256 of the source JSON |
| Selected project work | Recorded counts, focus, role records and source digests for an explicitly selected root or registered child |

An exact stock match establishes equality of those work-record bytes. It does
not establish project identity, pristine context/plan/memory records, adoption
status or project completion. A valid empty adopted ledger means **no work
recorded**. A role registry records roles; it does not observe running workers.
Catalog source completion records do not transfer acceptance to another app.

## Read API and explicit scope

`GET /api/status` retains the existing `operating` fields and adds
`operating.workStatus`, schema version `1`, with `authority: "records-only"`.
The Vite development bridge exposes the same endpoint under
`/__systemx/api/status`. This controller remains a local development service.

| Request | Recorded project scope |
| --- | --- |
| `/api/status` | `adoptedProject.state: "not-selected"`; no child records loaded |
| `/api/status?workScope=root` | Explicit outer `.SYSTEMX` records |
| `/api/status?workScope=child&project=Example%20App` | The exact name `Example App`, only if present in the validated registry |

The browser selector makes this choice for the current page session. Reloading
starts with no selected adopted scope. The server does not infer a scope from
the last chat, a path, project context or saved runtime state. Request paths
are fixed; callers cannot supply a record path. Child options list registry
names and do not load child contexts, plans or memory contents.

The versioned read model contains:

- `reusableSeed`: `state`, selected version, `stockMatch` (`exact`, `modified`,
  `unavailable`), task counts, focus facts, registered roles and per-file
  hashes with `exactStockMatch` and `stockSha256`.
- `roadmap`: source path, readability, catalog schema/project/intent,
  `sourceCommit`, `itemCount`, computed `itemsByStatus` and source `sha256`.
- `adoptedProject`: `not-selected`, `available` or `unavailable`; explicit
  selection, relative record root, recorded counts/focus/roles, source hashes,
  and the child's configuration source when selected.
- `scopeOptions`: registry readability/digest, explicit root option, and up
  to 200 exact registered child names. Invalid registry data yields unavailable
  options and a diagnostic, rather than an empty child list.

Record sources contain only relative paths, state, source hashes and bounded
diagnostic codes. Task titles, acceptance/evidence contents, memory contents,
secrets and absolute filesystem paths are not included. Focus exposes its
bounded recorded objective, selected task IDs and update time. A nonempty task
milestone additionally checks the selected scope's bounded master-plan table;
its digest appears in `supportingSources`. Registered memory paths and optional
focus checkpoint files are checked as regular files without reading their text.

## Unavailable data and validation limits

Missing, malformed, unsupported, linked, conflicting-case or oversized inputs
are unavailable. The source list retains the affected path and diagnostic.
Readable empty data is represented with actual zero counts. Independently
readable facts remain visible: an invalid focus can coexist with a readable
task count, while the combined scope state remains unavailable.

The legacy `operating.taskCount`, `tasksByStatus` and `childProjectCount` use
`null` when their records cannot be validated. `agentRoles` retains its array
shape for existing clients; failures are explicitly listed in
`operating.recordDiagnostics`. Installation status is `null` when its required
status metadata is unavailable. Clients must display unavailable data without
coercing it to zero or an empty project.

Reads reject duplicate JSON fields, invalid UTF-8, unknown coordination-record
fields, invalid owners/statuses, inconsistent task history, dependency cycles,
invalid focus references, unsafe record paths and unmatched child identity.
Every traversed component is inspected with `lstat`; final files must be
unlinked regular files, opened without following links where the platform
supports it. Each file is bounded to 2 MiB, JSON nesting to 64 levels, and task,
role, history and check arrays to 10,000 entries. Child names are portable and
unique ignoring case; selection requires the exact stored spelling.

This is a host read model. It does not run the complete selected-release
validator, verify distribution manifest integrity, inspect generated work views,
authenticate acceptance evidence, prove runtime readiness or observe providers.
Use `npm run systemx:status` for installed integrity and
`npm run systemx:validate` for the complete project-record/view validation.
The roadmap summary validates its required record shape and counting fields;
`npm run backlog:check` additionally checks the complete catalog and generated
views. Independent file reads are observations, not a transaction across a
concurrently changing ledger, focus and registry.

## Verification

Run focused source and safety fixtures:

```bash
node --test .SYSTEMX/LAN/tests/work-status.test.mjs
```

Run the actual rendered control journey with installed Playwright Chromium:

```bash
node .SYSTEMX/LAN/tests/work-status-browser.mjs
```

The browser journey copies host LAN/source files to an owned temporary
fixture, excluding LAN runtime, research and test directories. It uses
OS-allocated loopback ports and creates a fresh isolated browser
context. It exercises default, explicit root, exact child, malformed child and
unavailable roadmap states through rendered controls. It also holds a genuine
older scope response until a newer selection has rendered, verifying that stale
responses cannot misattribute recorded work. A pending selection clears the
previous source cards while the latest request is loading. JSON results and four
screenshots remain in the printed temporary evidence directory. The fixture
server, browser and fixture copy are closed/removed; reusable source records
are compared byte for byte after the journey. The journey has a 90-second
deadline and bounded browser/server teardown. No real project records are
populated and no provider or deployment action occurs.
