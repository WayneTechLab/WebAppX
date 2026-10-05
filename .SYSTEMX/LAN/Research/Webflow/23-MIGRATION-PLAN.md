# 23 — Migration Plan from Current LAN Prototype

## Constraint

The current LAN is active and useful. Migration must preserve its URLs, local safety, and current-template editing slice while internals are replaced.

## Stage 1 — Freeze behavior

- record current API responses and errors;
- test all confirmation phrases and write boundaries;
- capture editor screenshots and keyboard flows;
- document current local files/logs/backups;
- add capability flags for every existing feature.

No visible redesign in this stage.

## Stage 2 — Strangler server refactor

Keep `server.mjs` as entrypoint, but route functions into modules:

```text
legacy route -> transport adapter -> query/command service -> existing store
```

Move one responsibility at a time: security middleware, workspace query, source store, backup/evidence, component store, local data store, ingest.

## Stage 3 — Versioned API

Add `/api/v1/queries/*` and `/api/v1/commands/*`. Existing endpoints translate to v1 commands/queries. The old dashboard continues to work.

## Stage 4 — Canonical document read path

Build a read-only importer and serve both:

- legacy workspace/local-data responses;
- canonical document/read-model responses.

Compare them in tests. Do not enable source writes through the new document yet.

## Stage 5 — Command journal for fixture mutations

Move page metadata, local nodes, local CMS/users, and component registry mutations into commands. Implement undo/redo for these local stores first. Legacy routes call commands.

## Stage 6 — React UI coexistence

Serve a new React editor under a feature flag or new local path while `Website_Dashboard.html` remains default. Both consume v1 queries/commands. Run visual/usability tests before switching default.

## Stage 7 — Source adapter cutover

- keep exact-text writer as `legacy-literal-text` adapter;
- add AST read-only mapping;
- enable AST literal writes for supported files;
- compare plans/results;
- move supported operations to AST adapter;
- disable legacy writer only after migration fixtures pass.

## Stage 8 — Document/source ownership

Mark existing imported objects `source-owned`. New generated pages/components can be `generated-owned`. Provide explicit conversion commands and never infer ownership from UI location.

## Stage 9 — Remove legacy internals

Remove legacy API/UI/store code only when:

- no route/client references it;
- equivalent v1 tests pass;
- local data/registry migration is complete;
- docs are updated;
- rollback tag/branch exists.

## Data migration

Current files such as local data and component registry receive import migrations into the new document/store. Preserve original files in a timestamped backup and write a migration report containing record counts, IDs, warnings, and checksums.

## Rollback strategy

At each stage:

- one release tag/commit before cutover;
- feature flag to select old/new path where practical;
- backups of local state;
- schema migration down/forward-fix plan;
- documented command to revert default entrypoint;
- production build remains unaffected.

## Operator communication

The LAN UI should show:

- current editor/kernel/API/schema versions;
- migration status;
- legacy features in use;
- unsupported source objects;
- required backup or upgrade steps;
- exact release notes.
