# 13 — Target Architecture for SYSTEMX LAN Designer

## Architecture principles

1. **Kernel before panels.** Editor behavior lives in typed domain services, not DOM event handlers.
2. **Repository ownership is explicit.** Every object records source/document ownership and adapter status.
3. **Commands are the mutation API.** UI, CLI, MCP, and plugins call the same handlers.
4. **Queries are projections.** Canvas, Navigator, inspectors, diagnostics, and source views consume shared read models.
5. **Evidence is automatic.** Every mutation and release points to validation, diff, backup, and resulting revision.
6. **Local first; provider explicit.** Emulators/test environments are defaults; live operations need target proof and owner approval.
7. **Standards over imitation.** CSS/HTML/DOM semantics come from browser standards.
8. **Capability packs over monolith.** React/Vite/Firebase is the first supported pack, not an assumption embedded everywhere.

## Proposed module map

```text
.SYSTEMX/LAN/
├── app/                         # React/Vite Designer UI
│   ├── shell/
│   ├── panels/
│   ├── canvas/
│   ├── commands/
│   └── state/
├── Builder/
│   ├── kernel/
│   │   ├── DesignerKernel.ts
│   │   ├── transactions/
│   │   ├── revisions/
│   │   └── migrations/
│   ├── domain/
│   │   ├── documents/
│   │   ├── pages/
│   │   ├── nodes/
│   │   ├── styles/
│   │   ├── variables/
│   │   ├── components/
│   │   ├── cms/
│   │   ├── interactions/
│   │   ├── localization/
│   │   └── assets/
│   ├── commands/
│   │   ├── registry/
│   │   ├── handlers/
│   │   ├── policies/
│   │   └── schemas/
│   ├── queries/
│   │   ├── navigator/
│   │   ├── selection/
│   │   ├── style-trace/
│   │   ├── usage-index/
│   │   ├── source-map/
│   │   └── diagnostics/
│   ├── adapters/
│   │   ├── source-react/
│   │   ├── source-css/
│   │   ├── tailwind/
│   │   ├── firebase/
│   │   ├── sql-connect/
│   │   ├── storage/
│   │   └── drive/
│   ├── rendering/
│   │   ├── preview-runtime/
│   │   ├── canvas-bridge/
│   │   └── overlay-protocol/
│   ├── publishing/
│   │   ├── snapshots/
│   │   ├── manifests/
│   │   ├── gates/
│   │   └── rollback/
│   ├── extensions/
│   │   ├── manifests/
│   │   ├── capability-runtime/
│   │   ├── mcp/
│   │   └── plugin-host/
│   ├── collaboration/
│   │   ├── comments/
│   │   ├── presence/
│   │   ├── branches/
│   │   └── merge/
│   ├── server/
│   │   ├── http/
│   │   ├── session/
│   │   ├── authz/
│   │   └── transport-schemas/
│   ├── persistence/
│   │   ├── document-store/
│   │   ├── journal-store/
│   │   ├── evidence-store/
│   │   └── indexes/
│   ├── contracts/
│   └── tests/
├── Website_Dashboard.html       # compatibility launcher during migration
└── server.mjs                   # compatibility entry delegating to modular server
```

## Runtime boundaries

### Browser UI

- no Node APIs;
- no environment/secrets;
- no generic source access;
- all reads/writes via typed protocol;
- short-lived session token in memory;
- selection/canvas state local;
- object revisions supplied on mutation.

### Loopback server

- validates host/origin/method/body/schema/session;
- authenticates capability and target;
- invokes queries/commands;
- owns repository/provider access;
- records evidence;
- never exposes a shell proxy.

### Kernel

- deterministic domain rules;
- no HTTP/UI assumptions;
- transaction and revision control;
- derived indexes;
- source/publish plans;
- testable in memory.

### Adapters

- read-only by default;
- explicit supported subset;
- dry-run plan before apply;
- backup/restore and verification;
- no hidden target changes.

## Persistence

### Initial local implementation

- `documents/<document-id>/<revision>.json` — immutable snapshots or compact periodic snapshots;
- `journal/<document-id>.jsonl` — commands/events;
- `indexes/` — rebuildable projections;
- `evidence/` — operation reports;
- `backups/` — source pre-write copies;
- `releases/` — publish manifests;
- all ignored unless intentionally promoted as fixture/contract.

Use SQLite later if journal/query volume justifies it. Preserve exportable JSON/JSONL schemas.

## Revision strategy

- document revision increments once per committed transaction;
- commands carry `expectedRevision`;
- a mismatch returns conflict and a semantic rebase report;
- preview snapshots point to document revision + source commit + adapter versions;
- source apply records resulting commit/hash independently.

## Derived indexes

Rebuildable indexes include:

- parent/ancestor/descendant;
- route/path;
- style usage and cascade candidates;
- variable usage/alias graph;
- component instance/dependency;
- CMS field/query/binding usage;
- asset usage;
- interaction target usage;
- source path/span mapping;
- diagnostics;
- locale overrides;
- comments/analytics anchors.

## Deployment shape

The LAN remains absent from public `dist`. The editor may generate source into `src/`, then normal Vite/Firebase tooling builds the product. Preview can use:

1. live Vite HMR for source-owned changes;
2. isolated in-memory renderer for document-owned changes;
3. immutable generated preview snapshot for release review.

## Migration compatibility

Keep current URLs and launcher commands during the refactor. `server.mjs`, `Website_Dashboard.html`, and existing API routes can delegate to new modules until the React app and versioned API are ready. Mark legacy endpoints and remove only after tests and docs migrate.
