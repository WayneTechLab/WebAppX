# SYSTEMX LAN Versioned API Contracts

The experimental graph/contract surface implements API **1.1** and an executable
supported **1.0** contract. Each has its own schemas, capability IDs and operation
set. This surface does not silently version every legacy LAN route or implement
planned source/structure commands. **LAN-00401–LAN-00600 remain TODO**; the
accepted baseline remains **400/10,000 requirements and 80/2,000 capabilities**.

## Discover and run deliberately

Start `npm run dev:systemx`, open its printed `/__systemx/` bridge and expand
**Build → Code → Graph and API contracts**. Select a client version and inspect
discovery: server/current version, selected compatible version, schema revision,
limits and available/unavailable operations. An unsupported version receives a
typed refusal rather than silent fallback.

Inspect descriptors and synthetic valid/invalid examples before editing a
request. Examples are metadata; they run only when the operator chooses
**Send editable envelope explicitly**. No provider account is required. Keep
session values private and obtain current authority through the served GUI.

| Method and path | Purpose |
| --- | --- |
| `GET /api/contracts/discovery` | Discover the requested compatible contract and current server metadata. |
| `POST /api/contracts/query` | Validate and dispatch a declared query envelope. |
| `POST /api/contracts/command` | Validate a command envelope and its capability, confirmation and revision preconditions. |

All routes retain current LAN session authority and loopback Host/Origin checks.
Public descriptor/export metadata excludes credentials, private paths and
session values. A contract descriptor supplies no source-write authority.

## Supported operation sets

| Contract | Executable operations |
| --- | --- |
| 1.0 | `graph.status`, `graph.document`, `graph.preview`, `graph.accept`, `graph.export`, `contracts.list`, `contracts.describe`, `contracts.examples`, `contracts.export` |
| 1.1 additions | `graph.findings`, `graph.lookup`, `graph.compare`, `graph.reopen`, `graph.migrationPreview`, `graph.migrationApply`, `contracts.compatibility` |

Graph commands alter only local graph metadata or produce a reviewed migration
copy. Editing Home and other source files still uses the existing separate
revision, diff, confirmation and save workflow. The
[graph workflow](SYSTEMX-LAN-Canonical-Graph.md) explains acceptance and recovery.

## Validation and client recovery

Queries carry exactly `apiVersion`, `requestId`, `kind`, `operation` and
`payload`. Commands also require the advertised `capabilityId`, `confirmation`
and explicit `expectedRevision`. The payload `type` must match the operation.
Unknown fields, hidden mutation flags and mismatched variants are refused
before handler effects. Absence and null are distinct: an omitted graph-read
revision may select current state, while null is invalid; initial graph
acceptance may expect null only when no graph has yet been accepted.

Pagination accepts integer offsets 0–10,000 and sizes 1–50, without coercing
strings. Requests are capped at 400,000 bytes and responses at 800,000 bytes.
Errors distinguish validation, missing targets, conflicts, capability,
confirmation, incompatible versions and internal response-contract failures.
A malformed server result is refused; the client retains its last valid view.
Compatibility inspection reports additive and breaking changes in both
directions before a version selection is made.

The [versioned API guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/LAN-VERSIONED-API-CONTRACTS.md)
and [F005/F006 execution plan](https://github.com/WayneTechLab/WebAppX/blob/main/docs/LAN-GRAPH-API-PLAN-2026-10-31.md)
own full shapes and delivery gates. The original
[F006 checklist](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/lan-10000/F006.md)
requires F005 acceptance first. Type declarations, examples, a published branch
or a successful worker exit alone accept neither family.

[Canonical graph](SYSTEMX-LAN-Canonical-Graph.md) · [Legacy API reference](SYSTEMX-LAN-API-Reference.md) · [LAN Builder](SYSTEMX-LAN-Builder.md) · [Home](Home.md)
