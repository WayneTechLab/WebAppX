# 12 — Webflow-to-LAN Gap Analysis

## Maturity scale

- **0 — absent**
- **1 — concept/document only**
- **2 — prototype/fixture**
- **3 — functional constrained slice**
- **4 — production-capable for defined scope**
- **5 — extensible platform capability**

## Summary scorecard

| Capability | Current LAN | Target | Primary gap |
| --- | ---: | ---: | --- |
| Local control-plane safety | 4 | 5 | Broader schema/capability tests, log integrity, plugin/MCP boundary |
| Canvas shell and panel layout | 3 | 5 | Typed UI architecture, accessibility, large-document performance |
| Selection and source hints | 3 | 5 | Stable IDs, source maps, component/instance paths |
| Canonical document model | 1 | 5 | Normalized graph, migrations, ownership, revisions |
| Command journal / undo / redo | 1 | 5 | Typed commands, transactions, inverse operations, replay |
| Structural editing | 2 | 5 | Parent/child constraints, DnD, AST/source generation |
| Style/cascade/breakpoints | 1 | 5 | Selector graph, provenance, standards resolver, token modes |
| Components | 2 | 5 | definitions/instances/props/slots/variants/versions/migrations |
| CMS and binding | 2 | 5 | schemas, relations, queries, bindings, workflow/locales |
| Assets | 2 | 5 | metadata, transforms, usage index, providers, optimization |
| Interactions | 1 | 5 | trigger/target/timeline graph and runtime adapter |
| Localization | 1 | 5 | locale inheritance/overrides/routes/publishing |
| Content editor role | 2 | 5 | capability projection over the canonical model |
| Comments/review | 0 | 4 | stable anchors, threads, notifications, API |
| Branching/merge | 0 | 4 | branch journals, semantic diff, merge transaction |
| Publish snapshots | 1 | 5 | immutable manifests, artifact hashes, approvals, rollback |
| Provider operations | 1 | 4 | emulator-first adapters, scopes, target evidence |
| Extension/plugin API | 1 | 5 | manifest, sandbox, shared query/command protocol |
| CLI/MCP | 1 | 5 | structured clients over shared kernel |
| Analyze/Optimize overlays | 0 | 3 | stable runtime IDs, read-only overlay and experiment model |
| Ecommerce | 0 | 3 | optional domain pack after CMS/forms/provider foundations |
| Documentation accuracy | 2 | 5 | generated command/path/version validation |
| Automated test depth | 2 | 5 | kernel, replay, round-trip, visual, security, performance suites |

## P0 gaps — must close before expanding the UI

1. Documentation and secret-handling defects.
2. Characterization tests for existing security/write behavior.
3. Contract validation and schema versioning.
4. Canonical document IDs/revisions.
5. Command journal and transaction boundary.
6. Monolith decomposition.

## P1 gaps — required for real visual editing

1. AST/CSS import/source maps.
2. structural commands and DnD;
3. style cascade, breakpoints, states, variables/modes;
4. deterministic generated source;
5. semantic diff and undo/redo;
6. accessible typed React editor UI.

## P2 gaps — required for application-scale authoring

1. components and libraries;
2. CMS schemas, queries, bindings, forms;
3. assets and provider adapters;
4. interactions and localization;
5. preview/publish snapshots and rollback.

## P3 gaps — platform ecosystem

1. content editor/reviewer projections;
2. comments, presence, branches, merge;
3. extension SDK and plugin marketplace policy;
4. MCP mutation proposals;
5. Analyze/Optimize overlays;
6. optional Ecommerce and hosted collaboration.

## Key dependency rule

Do not implement collaboration, AI mutation, a plugin ecosystem, or production provider writes before the command journal, stable IDs, capabilities, and immutable evidence exist. Those features multiply authority and conflict; without the kernel they amplify defects.
