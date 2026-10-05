# 10 — LAN Current-State Code Audit

## Audit baseline

Repository: `WayneTechLab/SFWA-WTL-TEMPLATE`  
Branch reviewed: `main`  
Synchronization commit examined: `626f80d23bdaf301309a3cc9943fc12594cd25ff`  
Later documentation commit noted: `e361eab4872425b5c29b272086467b320a9d1e60`

## Files reviewed

- `.SYSTEMX/LAN/README.md`
- `.SYSTEMX/LAN/WEBFLOW-STYLE-DESIGNER.md`
- `.SYSTEMX/LAN/WEB-BUILDER-UX-RESEARCH.md`
- `.SYSTEMX/LAN/BUILDER-SYSTEM-PLAN.md`
- `.SYSTEMX/LAN/CONTROL-PLANE-PLAN.md`
- `.SYSTEMX/LAN/server.mjs`
- `.SYSTEMX/LAN/Website_Dashboard.html`
- `.SYSTEMX/LAN/Website/dashboard.js`
- `.SYSTEMX/LAN/Website/dashboard.css`
- `.SYSTEMX/LAN/Builder/contracts/*`
- `.SYSTEMX/LAN/Builder/importer/current-repo.mjs`
- `.SYSTEMX/LAN/Builder/runtime/port-utils.mjs`
- `.SYSTEMX/LAN/dev-session.mjs`
- `.SYSTEMX/LAN/session-control.mjs`
- `vite.config.ts`
- `package.json`
- `.SYSTEMX/scripts/assert-lan-isolation.mjs`
- the full `wiki/` publication set.

## What exists today

### Execution topology

`npm run dev:systemx` starts a managed Node session that finds safe loopback ports, launches the LAN service and Vite with `shell: false`, records PIDs/URLs, and supports status/stop operations that verify ownership before termination.

Vite proxies `/__systemx/` to the loopback service for same-origin preview inspection. Production builds emit `dist/` and run an assertion that rejects LAN filenames, paths, names, and `data-systemx-*` markers.

### Server/API surface

Read routes cover health/status, workspace, local data, components/export, source, and tools. Mutation routes require a session header and support:

- source save with `SAVE LOCAL CHANGE`;
- page model operations;
- component save with `SAVE MODULE`;
- inventory-only external project scan with `SCAN EXISTING PROJECT`;
- local CMS/user record creation;
- preview readiness.

### Current editor behaviors

- canvas-first four-sided shell;
- left structure tools and docks;
- right inspector tools/panels;
- bottom device controls and Evidence drawer;
- Inspect/Interact mode;
- iframe hover/click selection;
- DOM path and source hints;
- parent selection and Navigator synchronization;
- safe leaf-text preview/revert/exact-source save;
- module/component staging;
- page metadata and local node-tree fixtures;
- local CMS/CRM/user fixtures;
- provider readiness cards;
- component registry and external-project inventory.

## Strengths to preserve

| Strength | Why it matters |
| --- | --- |
| Loopback-only control plane | Reduces accidental public exposure and separates editor from product runtime |
| Session/port/PID ownership | Prevents one project from disrupting another local process |
| Host/origin/token checks | Establishes a basic local request trust boundary |
| Allowlisted writes | Avoids generic filesystem access |
| Exact confirmation | Adds human friction before mutation |
| Backup + atomic write | Supports recovery from partial or mistaken saves |
| Secret-marker rejection | Prevents common credential leakage into source |
| JSONL operation evidence | Creates a durable local audit trail |
| Inventory-only external ingest | Avoids silently modifying unrelated projects |
| Production leakage assertion | Enforces the core control-plane/runtime boundary |

## Critical architectural gaps

### 1. No canonical document kernel

The current workspace schema permits generic page/component objects, and local node trees are fixtures. The rendered DOM, local model, repository source, and component registry are not reconciled through stable IDs and revisions.

**Impact:** undo/redo, semantic diffs, comments, branches, source maps, CMS bindings, and publish snapshots cannot be reliable.

### 2. No real command journal

Mutations are route-specific imperative code. There is no common command schema, transaction boundary, inverse command, optimistic revision, deterministic replay, or command-level capability.

**Impact:** UI undo/redo cannot be made trustworthy by storing snapshots in browser memory.

### 3. Fragile source round trip

Selected text is saved only when the captured original string appears exactly once in an allowlisted source file.

**Impact:** valid source containing repeated text, expressions, translations, components, formatting, or generated content becomes unmappable; string replacement can change the wrong semantic object.

### 4. Hard-coded discovery

`routeByPage` recognizes a fixed starter page set. Component roles are inferred from filenames. External project discovery is regex/file-layout based and intentionally inventory-only.

**Impact:** real routers, nested layouts, lazy routes, route objects, framework conventions, generated routes, and component metadata require AST/framework adapters.

### 5. Shallow contracts

Several schema properties are generic arrays/objects with `additionalProperties`, so server state can drift without failing validation.

**Impact:** the contracts document intent but do not yet enforce a stable product model.

### 6. Monolithic implementation

The server, dashboard script, dashboard CSS, and HTML entry are each large, cross-cutting files.

**Impact:** parallel development, unit tests, feature flags, plugin boundaries, and replacement of prototype logic become increasingly expensive.

### 7. Style engine absent

Token sources are listed, but there is no parsed selector/cascade/breakpoint/state/variable model.

### 8. Components and CMS are registries/fixtures

No definition/instance semantics, props, slots, variants, component migrations, collection field enforcement, references, queries, bindings, or provider synchronization.

### 9. Publishing is external only

This is correct for safety, but the LAN lacks immutable preview/release snapshot records and semantic evidence that the deploy process can consume.

### 10. Test coverage is insufficient for editor semantics

The package scripts have typecheck/lint/build/security checks, but no editor-kernel unit suite, command replay tests, source round-trip fixtures, interaction tests, or large-document performance benchmarks.

## Refactor boundary

```text
.SYSTEMX/LAN/Builder/
├── domain/          # document, pages, nodes, styles, components, CMS
├── commands/        # schemas, handlers, transactions, inverse operations
├── queries/         # projections, search, cascade/source traces
├── adapters/
│   ├── source-react/
│   ├── source-css/
│   ├── tailwind/
│   ├── firebase/
│   └── providers/
├── canvas/          # renderer bridge, selection, overlays, viewport
├── collaboration/   # comments, presence, branches (later)
├── publishing/      # snapshots, manifests, preflight
├── server/          # HTTP transport and session boundary
├── ui/              # React/Vite editor application
├── contracts/       # JSON Schemas and generated TS types
└── tests/            # fixtures, replay, round-trip, integration, security
```

## Immediate code actions

1. Add characterization tests around every current API and safety check.
2. Extract request validation, auth/origin, source access, backups, evidence, and local-data stores from `server.mjs`.
3. Introduce a read-only `DesignerDocument` importer and object IDs without changing writes.
4. Introduce `DesignerCommand` and journal for local model changes first.
5. Move dashboard state/actions into typed modules and a React UI shell.
6. Keep exact-text write as a legacy constrained adapter until AST source writes pass gates.
