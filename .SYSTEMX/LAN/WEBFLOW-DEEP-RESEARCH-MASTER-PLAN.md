# SYSTEMX LAN — Webflow-Class Designer Master Plan

**Status:** proposed research-backed implementation program  
**Research package:** `SFWA-WTL-WEBFLOW-RESEARCH-MASTER-PLAN-v1.0.0`  
**Research cut:** 2026-08-05  
**Source basis:** 200 sources, including 160 first-party Webflow documents.

**Current gate:** Wave 0 truth/safety/documentation/characterization is complete
for this repository. The capability manifest, schema decisions, evidence packet,
Markdown-link check, and required local gates pass. Wave 1 is planned and not
started; the full Designer is not a current release claim.

## Global goal

Evolve `.SYSTEMX/LAN` from a guarded local current-template prototype into a repository-native visual development platform that supports stable structural editing, responsive styling, components, CMS/data binding, preview/release evidence, and bounded extension/agent clients.

## Non-negotiable inherited controls

Do not weaken or remove:

- loopback-only LAN/Vite control plane;
- host/origin/session-token checks;
- managed session/port/PID ownership;
- allowlisted source reads/writes;
- explicit confirmation/approval friction;
- backup-before-write and atomic promotion;
- secret-shaped content rejection/redaction;
- sanitized evidence logs;
- inventory-only external project ingest by default;
- public build isolation checks.

## Core architecture decision

Introduce a typed `DesignerKernel` with:

1. canonical normalized `DesignerDocument` and stable IDs;
2. versioned query and command registries;
3. atomic transactions, revisions, journal, undo/redo, replay, and semantic diffs;
4. AST/CSS/Tailwind source adapters with explicit object ownership;
5. standards-aligned selector/cascade/breakpoint/state/token engine;
6. component definitions/instances/props/slots/variants/versions/migrations;
7. CMS schemas/items/references/queries/bindings/forms/provider adapters;
8. interactions, locales, comments, branches, snapshots, releases;
9. plugin/CLI/MCP clients over bounded capabilities.

## Immediate P0 sequence

1. Repair wiki secret handling, removed commands/paths, Node/version/process drift.
2. Add characterization tests for all current LAN routes and security/write behavior.
3. Split `server.mjs` and dashboard internals behind versioned contracts without changing behavior.
4. Add `DesignerDocument` read-only import and stable IDs.
5. Add the command journal for local page/node/component/CMS fixture mutations.
6. Migrate the UI to React only after the API/kernel boundary exists.

## Source ownership rule

Every object is one of:

- `source-owned` — existing source is truth; only supported semantic writes;
- `document-owned` — LAN document generates designated artifacts;
- `hybrid-controlled` — ownership is explicit and ambiguous round trips are blocked.

Never claim universal two-way editing. Unsupported source objects remain read-only and are labeled.

## Wave order

- Wave 0: truth, safety, documentation, characterization.
- Wave 1: modular server and typed contracts.
- Wave 2: canonical document and read-only import.
- Wave 3: commands, journal, undo/redo, semantic diff.
- Wave 4: React Designer UI migration.
- Wave 5: structural React/Vite source editing.
- Wave 6: style/token/responsive engine.
- Wave 7: components and libraries.
- Wave 8: CMS, bindings, forms, assets, emulator adapters.
- Wave 9: interactions and localization.
- Wave 10: immutable previews, publish manifests, restore.
- Wave 11: plugins, CLI, MCP, code-component sandbox.
- Wave 12: comments, branches, presence, insights, optional commerce.

## Required evidence per milestone

- updated TODO/DONE/status records;
- tests and validation report;
- semantic and source diffs;
- migration and rollback information;
- security/target preflight where applicable;
- current capability manifest;
- synchronized README/wiki/operator documentation.

## Stop rules

Stop the active wave and repair the foundation when:

- document IDs or command replay are unstable;
- source writes produce unrelated/nondeterministic diffs;
- a safety gate regresses;
- docs advertise a command or feature not implemented/tested;
- a provider target cannot be proven;
- a schema/component migration risks silent loss;
- control-plane content appears in public output.

## Reference files in the package

- full plan: `.SYSTEMX/LAN/Research/Webflow/20-IMPLEMENTATION-MASTER-PLAN.md`
- code audit: `10-LAN-CURRENT-STATE-CODE-AUDIT.md`
- wiki drift audit: `11-LAN-WIKI-DRIFT-AUDIT.md`
- target architecture: `13-TARGET-ARCHITECTURE.md`
- command model: `14-EDITOR-KERNEL-AND-COMMAND-MODEL.md`
- schemas: `INJECT/.SYSTEMX/LAN/Builder/contracts/`
- backlog/roadmap/risks: `planning/`
