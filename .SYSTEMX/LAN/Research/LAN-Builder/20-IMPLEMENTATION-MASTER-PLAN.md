# 20 — Implementation Master Plan

## Program objective

Transform the existing LAN prototype into a typed, testable, repository-native visual development platform while preserving all current local-control safety properties and maintaining a working template after every wave.

## Wave 0 — Truth, safety, and characterization

**Goal:** establish a trustworthy baseline before refactor.

Deliverables:

- fix P0 wiki/security defects;
- canonical version/platform/command/process manifests;
- docs path/command/link validator;
- API characterization tests for health/status/workspace/data/components/source/tools and every mutation confirmation;
- tests for host/origin/session/body/path/secret/backup/atomic write/process ownership/leak assertion;
- feature manifest generated from tests;
- ADRs for document ownership, command model, adapter boundaries, and UI migration.

Exit gate: current behavior is reproducibly tested; docs no longer instruct unsafe or nonexistent operations.

## Wave 1 — Modular server and typed contracts

**Goal:** separate transport, policy, domain, persistence, and evidence without changing UX.

Deliverables:

- `server/` modules;
- JSON Schema validation and generated TypeScript types;
- versioned API prefix;
- command/query registry scaffolding;
- stores for local data, components, source access, backups, evidence;
- standardized errors and request IDs;
- legacy endpoint adapters.

Exit gate: old UI works against modular server and all characterization tests pass.

## Wave 2 — Canonical document importer and read models

**Goal:** create stable object identity and read-only projections.

Deliverables:

- `DesignerDocument` schema/migrations;
- stable ID/fingerprint strategy;
- React/router/CSS/token read-only importers;
- source ownership/capability classification;
- Navigator/page/style/component/source-map queries;
- import report with `roundtrip-safe`, `read-only`, `needs-review`, `unsupported`;
- current starter imported into the document graph.

Exit gate: repeated imports are stable/idempotent and do not modify source.

## Wave 3 — Command journal and local model editing

**Goal:** make every existing local model mutation transactional and reversible.

Deliverables:

- command envelope/schema/registry;
- transaction/revision/journal stores;
- page/node/component/CMS fixture commands;
- inverse/restore strategy;
- undo/redo/history UI;
- semantic diffs;
- object-level authorization and stale revision conflicts.

Exit gate: commands replay deterministically to the same document hash.

## Wave 4 — React Designer UI migration

**Goal:** replace monolithic dashboard internals while preserving visible behavior.

Deliverables:

- React/Vite LAN app shell;
- typed editor store/query cache;
- accessible rails/panels/tree/inspector/drawers;
- selection/focus/mode/canvas state;
- command palette from registry;
- compatibility launcher;
- visual regression against current shell.

Exit gate: all current LAN flows work in the new UI, keyboard and accessibility tests pass.

## Wave 5 — Structural source editing

**Goal:** support safe element/page structure changes in the current React/Vite template.

Deliverables:

- constrained TSX AST writer;
- route adapter replacing hard-coded mapping;
- insert/move/wrap/unwrap/duplicate/delete commands;
- source plan/diff/approval/apply/verify pipeline;
- import/source-map refresh;
- parse-print idempotency fixtures;
- generated-owned page/section/component conventions.

Exit gate: a supported page can be structurally edited, undone, rebuilt, re-imported, and verified with stable IDs.

## Wave 6 — Style, variables, and responsive engine

**Goal:** implement standards-aligned design control.

Deliverables:

- PostCSS style importer/writer;
- selector/rule/declaration graph;
- breakpoint cascade and state model;
- token collections, modes, aliases, usage index;
- Grid/Flex/typography/spacing/background/border/effects inspectors;
- computed provenance trace;
- browser conformance fixtures;
- Tailwind adapter supported subset.

Exit gate: style changes across breakpoints/states are predictable, reversible, source-safe, and browser-verified.

## Wave 7 — Components and libraries

**Goal:** reusable design system primitives.

Deliverables:

- definitions/instances;
- props, slots, variants;
- focus mode and ownership UI;
- extraction/detach/upgrade/migration;
- dependency and usage indexes;
- local library package/export/import;
- code-component manifest spike.

Exit gate: component API changes produce impact reports and migrations; instances round-trip.

## Wave 8 — CMS, binding, forms, and assets

**Goal:** data-driven authoring.

Deliverables:

- collection/field/item schemas and workflow;
- references, queries, bindings, conditions, transformations;
- collection list/template page renderer;
- form contract and emulator endpoint;
- asset catalog/usage/metadata/transforms;
- Firestore/Storage/Auth emulator adapters;
- local content-editor projection.

Exit gate: a CMS-driven page and form work end-to-end through emulator with rules and accessibility tests.

## Wave 9 — Interactions and localization

**Goal:** motion and multi-locale authoring.

Deliverables:

- interaction trigger/target/timeline graph;
- preview playback and reduced-motion policy;
- runtime generator;
- locales, sparse overrides, route/slugs/metadata;
- locale switcher and publish manifests;
- FOUC and interaction performance tests.

Exit gate: one component/page supports reusable interaction and two locales without document cloning.

## Wave 10 — Preview, publish, backup, and release manifests

**Goal:** immutable release pipeline integration.

Deliverables:

- preview snapshot service;
- semantic review report;
- publish manifest/artifact hashes;
- gate policy and approval tokens;
- staging/production target adapters through existing deploy flow;
- full backup/restore record;
- release history UI;
- rollback drill.

Exit gate: approved snapshot publishes deterministically; prior release restores with evidence.

## Wave 11 — Extensions, CLI, and MCP

**Goal:** safe platform clients.

Deliverables:

- plugin manifest/capability sandbox/protocol;
- read-only plugin SDK;
- structured Designer CLI;
- read-only MCP tools;
- mutation proposal/approval protocol;
- code-component isolation and dependency policy;
- developer docs/examples.

Exit gate: an extension and MCP client can query selection/styles/CMS safely; approved mutation uses the same command journal.

## Wave 12 — Collaboration, insights, optional domain packs

**Goal:** team and business platform capabilities.

Deliverables:

- comments, review requests, approvals;
- presence and soft locks;
- page branches/merge;
- activity/history filters;
- analytics overlay mapping;
- experiment definitions/snapshots;
- optional Ecommerce pack;
- hosted collaboration feasibility study.

Exit gate: page branch review and merge are conflict-aware and release evidence remains complete.

## Program controls

- one active wave with explicit exit gate;
- bounded subagent lanes and file ownership;
- status/TODO/DONE updates per milestone;
- no feature marked complete without tests and docs;
- no provider live write before emulator/test lane;
- no removal of legacy behavior until migration and rollback are proven;
- all generated files reproducible from checked-in contracts/scripts.
