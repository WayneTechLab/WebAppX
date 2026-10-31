# LAN source browser and access policy

The Code inspector's **Source browser and policy** section lists eligible source
metadata for one selected repository checkout. It keeps source content, an open
draft, navigation preferences, policy proposals and save authority separate.
The [F002 plan](LAN-SOURCE-POLICY-PLAN-2026-10-30.md) maps the twenty capabilities
to LAN-00101–LAN-00200; acceptance is recorded in the progress ledger after the
required integration gates.

## Browse, filter and inspect

Open **Build → Code → Source browser and policy**, then **Refresh eligible
files**. Filter by `.tsx`, `.ts` or `.css`, or search filenames and declared tags.
Search never indexes source bodies. Each eligible row reports its size, authored
or generated origin, active rule and supported write kinds. Structural editing
remains unavailable. Inventory omissions do not establish that a file was deleted.

The policy covers direct page files, direct layout/navigation/shell components,
`src/config/siteControls.ts`, `src/index.css` and `src/router.tsx`. It excludes
runtime records, backups, operation logs, ingest, dependencies, private files and
unreviewed source trees. A manual path must be canonical and repository-relative;
absolute paths, traversal, encoded aliases and incorrect casing cannot select
another file. Linked files and linked ancestors are refused.

Select a path and choose **Load** explicitly. Loading does not save. A failed
read retains the previous loaded draft and baseline. Changing a filter preserves
the selected path even if it is outside the visible results. A complete error-free
inventory may clear an ineligible picker selection, while keeping the editor's
loaded text and revision. It never activates the next row. A delayed inventory
cannot replace a newer selection, load or source observation.

## Read and write boundaries

Content reads require lossless UTF-8 without NUL bytes, at most **1,000,000 bytes**
and **500,000 UTF-16 text units**. Unsupported encodings and oversized reads fail
as a whole; no partial or lossy text becomes an editor baseline. UTF-8 BOM and
line-ending bytes retain their revision significance. History can report the
bounded raw-byte revision of an unsupported encoding without returning its text.

Generated filenames and recognized generated comment markers in the first
**4,096 bytes** label a file read-only. This is a bounded classification rule,
not proof that every unmarked file was hand-authored. Raw source and font writes
enforce generated-file protection on the server. Existing exact-revision,
confirmation, secret-marker, backup and operation-record guards still apply.

Enumeration declares a **depth of 4**, **4,000 inspected directory entries** and
at most **500 returned files**. It does not recursively expand excluded trees or
follow links. Counts and notices distinguish result truncation, directory-budget
limits and unavailable metadata; incomplete inventories cannot establish absence.

## Review policy without applying it

**Review policy proposal** compares `source-access-v1` with the reviewed
`source-pages-only-v1` subset. It reports named added/removed rules, affected
eligible paths and whether the selected path would lose eligibility. A truncated
inventory qualifies the affected-path result as partial. Comparison uses path
and filesystem metadata without opening source files, reading headers or applying
policy. There is no Apply button or endpoint for a policy expansion.

## Remember navigation and export metadata

The optional **Remember eligible path and metadata filters** preference stores
only a schema version, opaque checkout identity, eligible path, extension and
search text. It stores no source text, baseline, revision, credentials or operation
authority. Reopening checks a fresh eligible inventory and restores only picker
metadata; **Load** remains explicit. Storage failure preserves the existing
editor and prior saved metadata. Opting out removes this checkout's preference.

**Export eligible inventory** deliberately downloads the current bounded public
metadata snapshot, including policy decisions, counts and omissions. It excludes
source bodies, private paths, absolute checkout roots, process values and tokens.
This download cannot import data, change the policy or approve a source save.

Read the [GUI workflow](LAN-TEMPLATE-GUI-WORKFLOW.md) and the separate
[swarm operating contract](SYSTEMX-SWARM.md). Browser-local HR/CMS/CRM records,
source navigation and recovery slots remain independent storage systems.
