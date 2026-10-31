# LAN versioned graph API contracts

The graph contract surface advertises and validates the implemented graph and
contract-inspection operations. Its current API version is **1.1**, with an
executable supported **1.0** contract. Legacy LAN routes remain separate; a new
registry entry does not silently version every existing route or implement a
planned operation. Delivery status belongs to the
[F005/F006 execution plan](LAN-GRAPH-API-PLAN-2026-10-31.md).

## Discover and inspect

Open **Build → Code → Graph and API contracts** and choose a client version.
Discovery identifies the current server version, the requested compatible
version, its schema revision, limits, available operations and unavailable
additions. The older contract retains its own schemas and operation set. An
unsupported version receives a typed refusal rather than silent fallback.

Descriptors identify operation kind, versioned capability, input and result
schemas, effect scope, confirmation and revision preconditions. Inspecting valid
and invalid synthetic examples retrieves metadata without executing those
example operations. The editable request runner sends only when the operator
chooses **Send editable envelope explicitly**.

All discovery reads, queries and commands retain the LAN session, loopback Host
and Origin checks. A public contract export excludes session authority,
credentials, machine paths, provider settings and private runtime values.

## Request and response boundaries

Query envelopes contain exactly `apiVersion`, `requestId`, `kind`, `operation`
and `payload`. Commands additionally require the advertised `capabilityId`,
`confirmation` and explicit `expectedRevision`. The payload discriminator `type`
must equal the selected operation. Fields are validated before target resolution
or domain effects; unknown fields, hidden mutation flags and mismatched variants
are refused. Validated dispatch uses an explicit operation map.

An absent field differs from explicit null. For example, a graph read may omit
its revision to request the current accepted version but cannot pass null. A
command must carry its revision field; initial acceptance may use null only
when there is no previous accepted graph. Replacing or reopening an existing
graph requires its exact current revision. Preview and migration-copy operations
have their own declared metadata-only preconditions.

Pagination uses integer offsets from 0 through 10,000 and page sizes from 1
through 50. String numbers and malformed limits are not coerced. Findings use a
maximum of 50 retained diagnostics plus an explicit omitted count, without
reflecting submitted values into error messages.

Success responses contain `apiVersion`, `requestId`, `ok: true` and a validated
result. Failure responses contain `ok: false` and a bounded typed error.
Categories distinguish validation, missing target, conflict, capability,
confirmation, incompatible version and internal failures. A malformed handler
result is an internal response-contract failure; neither server nor client
substitutes fabricated successful data. The client retains its last valid view
when a response is refused.

## Implemented operation sets

| Contract | Supported operations |
| --- | --- |
| 1.0 | `graph.status`, `graph.document`, `graph.preview`, `graph.accept`, `graph.export`, `contracts.list`, `contracts.describe`, `contracts.examples`, `contracts.export` |
| 1.1 additions | `graph.findings`, `graph.lookup`, `graph.compare`, `graph.reopen`, `graph.migrationPreview`, `graph.migrationApply`, `contracts.compatibility` |

Graph queries inspect accepted state, findings, qualified references, retained
revision differences and explicit exports. Graph commands preview/accept
metadata, reopen a checked graph or produce an isolated reviewed migration copy.
They do not write source. The [graph guide](LAN-CANONICAL-GRAPH.md) describes
operator use and recovery.

Versioned capability identities are stable contract identifiers, independent of
translated labels and route filenames. Discovery describes the supported older
contract's replacement and compatibility window; removal requires an explicit
release. A local version comparison reports additive and breaking changes in
both directions so an operator can assess clients before selecting a contract.

## Evidence and acceptance

The canonical registry, validators and type declarations describe available
shapes; generated or declared types alone do not prove runtime behavior. Test
receipts must bind the exact schema revision and implemented operation IDs to
executed checks. Browser proof must exercise the actual dashboard controls,
including older/current execution, strict refusal and client recovery.

The [F006 checklist](backlog/lan-10000/F006.md) retains the original hundred
requirements. F005 must be accepted before F006; schema availability, a rendered
label, a worker exit or a published branch accepts neither family automatically.
