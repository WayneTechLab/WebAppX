# 25 — Proposed LAN Routes, Modes, Panels, and Information Architecture

## Local route strategy

Keep the current local entrypoints:

```text
http://127.0.0.1:<vite>/__systemx/
http://127.0.0.1:<lan>/
```

Within the React LAN application use client routes that are local-only:

| Route | Purpose |
| --- | --- |
| `/workspace` | current repository/site summary, sessions, recent work, environments |
| `/designer/:documentId/pages/:pageId` | primary Designer shell |
| `/designer/:documentId/components/:componentId` | component canvas/focus mode |
| `/content/:documentId` | CMS collections/items/workflow |
| `/assets/:documentId` | asset library, metadata, usage, provider sync |
| `/interactions/:documentId` | interaction library/timeline management |
| `/locales/:documentId` | locale configuration and override review |
| `/reviews/:documentId` | comments, branches, approvals, semantic diffs |
| `/releases/:documentId` | snapshots, gates, releases, restore |
| `/integrations/:documentId` | provider adapters, test/emulator readiness |
| `/extensions` | plugins, code components, CLI/MCP capabilities |
| `/evidence` | operation journal, backups, reports, logs |
| `/settings` | LAN preferences and local policy |

Use URL query/hash state for panel/mode/selection only when shareable and safe:

```text
?mode=design&panel=style&breakpoint=tablet&locale=en-US&node=node_123
```

Never put session tokens, secrets, file contents, provider IDs that reveal private targets, or approval tokens in URLs.

## Designer modes

- Design
- Edit
- Preview
- Comment
- Analyze
- Interact

Modes determine allowed commands and chrome; they are not cosmetic labels.

## Left rail

### Structure

- Add
- Pages
- Navigator
- Components
- Libraries

### Content

- CMS
- Assets
- Forms
- Ecommerce (optional)

### Quality

- Audit
- Search/Find

### Local control

- Source
- Providers
- Evidence

## Right rail/inspector

- Style
- Settings
- Layout
- Bindings
- Interactions
- Accessibility
- Source/provenance
- History

Only context-relevant panels should open. The inspector and bottom timeline/drawers must avoid overlapping the editable canvas.

## Bottom application bar

- viewport/breakpoint/device width;
- zoom/Fit;
- Inspect/Interact;
- canvas settings (vision/text zoom/grid overlays);
- breadcrumb/source location;
- history status;
- evidence/gate drawer;
- interaction timeline when active.

## Global top bar

- workspace/site/document/page context;
- mode switch;
- locale;
- branch/review status;
- command palette;
- collaborator/presence indicators;
- preview snapshot;
- publish/release candidate.

## Context menus

Context menu items are generated from the command registry and selection capabilities. Examples:

- select parent/child/sibling;
- reveal Navigator/source/style/component/CMS usage;
- insert/wrap/duplicate/move/delete;
- create component;
- bind data;
- add interaction/comment;
- copy object reference;
- view history/diagnostics.

## Mobile/narrow editor behavior

The LAN is desktop-first. At narrow widths:

- one panel replaces the canvas rather than floating over it;
- return-to-canvas is explicit;
- bottom controls compress but remain keyboard reachable;
- no claim of full phone authoring until separately designed/tested.
