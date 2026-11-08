# SYSTEMX LAN Canonical Graph

The experimental F005 graph inspector provides a bounded read model of pages,
nodes, components, collections and references beside the existing
[source identity inspector](SYSTEMX-LAN-Identity-and-Ownership.md). Graph data is
descriptive metadata. It cannot save source, infer writable structure from a
canvas element or widen source policy.

**LAN-00401–LAN-00600 remain TODO** pending original F005/F006 acceptance.
Accepted progress remains **400/10,000 requirements and 80/2,000 capabilities**.
The [execution plan](https://github.com/WayneTechLab/WebAppX/blob/main/docs/LAN-GRAPH-API-PLAN-2026-10-31.md)
separates implementation, verification, acceptance and publication.

## Open and import

1. From the repository root run `npm run dev:systemx`, then open the printed
   same-origin `/__systemx/` bridge. Read the current session URLs rather than
   assuming a fixed port. No provider account is needed for this local workflow.
2. Open **Build → Code → Graph and API contracts**. This disclosure starts
   closed; opening it alone sends no graph command.
3. For actual template source, preview and accept an eligible TSX file through
   **Source identities** first. Choose **Use current identity document ID** and
   **Preview graph import**. Alternatively, paste an explicit graph document for
   the current workspace. Multiple source roots receive a read-only wrapper;
   opaque and external regions stay read-only.
4. Review schema, revision, counts and findings. Type **ACCEPT GRAPH** to accept
   the exact preview digest. Initial acceptance explicitly expects no previous
   revision; replacement requires the observed accepted revision. A changed
   draft or newer preview invalidates the previous pending action.
5. Inspect retained findings and qualified lookup. Supply workspace, document,
   object identity and kind; wrong-kind or cross-document references are refused.

## Revisions, export and recovery

Canonical serialization sorts object keys and ID collections while preserving
meaningful child order. Revision comparison reports added, removed, changed and
reordered objects without changing either input. Failed or late imports retain
the previous accepted graph and newer operator drafts.

The local service keeps at most **50 documents and ten revisions per document
in memory**. **Download selected graph export** saves one versioned snapshot.
Before a service restart, export the selected graph you want to retain.
**REOPEN GRAPH** revalidates the snapshot, content revision, current workspace
and exact previous revision. Graph export is separate from the source-identity
integrity-protected export; it is metadata, not a source backup or portable
write permission.

Legacy schema 0 migration is explicit. Preview the supported transition, type
**MIGRATE GRAPH COPY**, and review the returned isolated schema 1 copy. Preview
and accept that copy separately through the normal import flow. Migration does
not replace the accepted graph automatically.

## Limits and remaining boundaries

Imports are capped at **400,000 bytes, 1,000 nodes, 50 pages, 2,000 references,
depth 64 and 200 components/collections each**. At most 50 findings are retained
with an omitted count. Cycles, invalid roots/reciprocity, incompatible required
references and exceeded budgets prevent acceptance. Optional unresolved
references remain explicit warnings, without usable dependent structure.

The conservative route codec accepts ordinary routes such as `/about`,
`/hr/demo/admin/payroll`, `/cms/demo` and `/crm/demo`. Nested reserved host-path
prefixes remain refused; `/home/settings` reports `GRAPH_ROUTE_PRIVATE_PREFIX`.
This is not full route support. Runtime paths, credentials, session authority
and rendered DOM handles do not belong in graph exports.

Read the [canonical graph guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/LAN-CANONICAL-GRAPH.md)
for the complete contract and the original
[F005 checklist](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/lan-10000/F005.md)
for acceptance. Full structural Designer authoring and production qualification
remain separate work.

[Versioned API contracts](SYSTEMX-LAN-Versioned-API-Contracts.md) · [LAN Builder](SYSTEMX-LAN-Builder.md) · [Home](Home.md)
