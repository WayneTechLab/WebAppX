# LAN canonical document graph

The LAN graph inspector provides a bounded, versioned read model for imported
pages, nodes and references. It sits beside the source identity and ownership
inspector. Graph metadata is descriptive: it cannot write source or grant the
source editor permission. Current delivery status belongs to the
[active iteration](LAN-ACTIVE-ITERATION.md) and
[F005/F006 execution plan](LAN-GRAPH-API-PLAN-2026-10-31.md).

## Import and inspect

Open **Build → Code → Graph and API contracts**. The disclosure starts closed to
keep the source workspace compact. Help disclosures explain individual actions;
opening the inspector alone sends no graph command.

For real template source, first use the existing
[source identity workflow](LAN-IDENTITY-OWNERSHIP.md) to preview and accept the
selected eligible TSX file. Then choose **Use current identity document ID** and
**Preview graph import**. The server reads that accepted identity through the
same workspace service. Multiple top-level source roots receive an explicit
read-only document wrapper; none is silently discarded or claimed as a live DOM
structure. Opaque and imported external regions remain visibly read-only.

Alternatively, paste an explicit graph JSON document for the current workspace.
A preview validates the full document and reports its schema, revision, counts
and bounded findings. Review the proposal and type **ACCEPT GRAPH** to accept its
exact digest. Initial acceptance requires an explicit null previous revision;
replacing an accepted graph requires its exact observed revision. Editing the
input or producing a newer proposal invalidates the earlier pending action.

The accepted view reports page, node, component, collection, reference, opaque
and unresolved counts against its displayed graph revision. Findings can be
filtered by severity, object and reference type with declared pagination.
Finding totals cover the retained finding set; upstream omissions are reported
separately. Qualified lookup requires workspace, document, object identity and
kind, and refuses missing, cross-document and wrong-kind targets.

## Validation and ownership

Schema 1 has explicit page, node, reference, component and collection collections.
Every page root and parent/child relationship must resolve correctly. Cycles,
unreachable nodes, duplicate child membership, incompatible required references
and exceeded budgets prevent acceptance. Child IDs carry explicit sibling order.
An unresolved optional component or collection reference remains an explicit
warning and supplies no usable component structure or accepted dependent binding.

The declared import limits are 400,000 bytes, 1,000 nodes, 50 pages, 2,000
references, depth 64 and 200 components/collections each. Diagnostics retain at
most 50 findings and an omitted count. The reviewed read-only extension namespace
is `org.webappx.readonly`, bounded to depth 5 and 16 KB with at most 1,000 entries
per object or array. Preserved extension data is never an executable command.

Runtime selection handles, process identifiers, session authority, preview
coordinates and private host paths are excluded. The route codec allows ordinary
routes such as `/about`, `/hr/demo/admin/payroll`, `/cms/demo` and `/crm/demo`.
Nested routes under reserved host-path prefixes are currently refused; for
example `/home/settings` reports `GRAPH_ROUTE_PRIVATE_PREFIX`. This narrow codec
does not establish full route support or source authority from a rendered URL.

## Revisions and recovery

Canonical serialization sorts object keys and ID-based collections while
preserving explicit child order. Equivalent key/collection insertion order gives
the same bytes and revision. Meaningful fields or sibling order change the
revision. Serialization adds no timestamp or machine identity.

Compare two retained accepted revisions to inspect added, removed, changed and
reordered objects. Mixed edits can report both membership changes and sibling
reordering. Both input revisions remain unchanged. A failed reimport retains the
previous accepted graph and identifies the attempted source revision in bounded
findings. Late asynchronous import results cannot replace a newer proposal or an
accepted reopen.

The service keeps up to 50 accepted documents and ten revisions per document in
local memory. **Download selected graph export** saves one versioned metadata
snapshot. **REOPEN GRAPH** revalidates that snapshot, its content revision, the
current workspace and the exact previous accepted revision. This graph export
is separate from the integrity-protected source-identity export and is not a
source backup or a permission grant. Service restart does not retain in-memory
graph history automatically.

## Reviewed schema migration

A supported legacy schema 0 document contains a single `page` and nodes whose
ordered children are represented by their array order and parent references.
The explicit migration preview lists page-list conversion, child-order
construction, schema transition and validation. Unknown transitions and
unsupported fields receive contained refusals.

Type **MIGRATE GRAPH COPY** against the exact preview to produce an isolated
schema 1 copy. That action does not accept or replace a graph. Review the returned
copy, preview it through the normal import flow, and accept a fresh proposal
separately. Newer operator drafts must survive a delayed migration response.

## Verification and related contracts

The [versioned API guide](LAN-VERSIONED-API-CONTRACTS.md) describes request,
response, version, capability, confirmation and revision boundaries. The
[F005 checklist](backlog/lan-10000/F005.md) retains the original hundred
requirements and their dependencies. Generated progress and the final QA receipt,
when accepted, distinguish implementation from tested and published delivery.
