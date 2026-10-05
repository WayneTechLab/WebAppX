# 03 — Webflow Designer Interface Anatomy

## 1. Workspace geometry

The documented Designer uses a persistent canvas surrounded by mode and tool surfaces. Exact visual placement changes over time, but the interaction contract is stable:

- **Top bar:** site/mode context, responsive/breakpoint controls, preview, collaboration, publish, and global actions.
- **Left tool rail/panels:** Add, Navigator, Pages, Assets, CMS, Components/Libraries, Audit, and related structure/content tools.
- **Canvas:** direct selection, insertion, inline editing, focus modes, overlays, responsive preview, and interaction testing.
- **Right inspector:** element settings and style controls, including selector/state/breakpoint-aware values.
- **Mode-specific lower/overlay surfaces:** canvas settings, interaction timeline, comments, analytics overlays, quick find, and dialogs. [WF-005–WF-018, WF-036–WF-040, WF-059]

The current LAN layout already approximates this geometry. The next step is not to add more permanent panels; it is to formalize mode, focus, selection, and command behavior.

## 2. Interaction state model

A robust Designer distinguishes at least these states:

```ts
interface EditorUiState {
  mode: 'design' | 'edit' | 'preview' | 'comment' | 'analyze' | 'interact'
  activeSiteId: string
  activePageId: string
  activeLocaleId?: string
  activeBreakpointId: string
  selection: SelectionRef[]
  hovered?: SelectionRef
  focusedComponentInstanceId?: string
  activePanel?: PanelId
  openDrawers: DrawerId[]
  canvas: {
    zoom: number
    width: number
    fit: boolean
    scrollX: number
    scrollY: number
    visionPreview?: string
    textZoomPx?: number
  }
}
```

This UI state must be ephemeral or locally persisted. It must not pollute the saved document or generated app source.

## 3. Selection synchronization

Selection should be one shared reference used by:

- canvas outline and handles;
- Navigator row;
- breadcrumb/path bar;
- Style and Settings inspectors;
- component/CMS binding cards;
- command palette context;
- audit finding navigation;
- comments and analytics overlays;
- source span mapping.

The current LAN shares some selection state across canvas, Navigator, and Components. It should move from raw DOM element references to stable `NodeRef` objects:

```ts
type NodeRef = {
  documentId: string
  nodeId: string
  instancePath?: string[]
  localeId?: string
  sourceRevision?: string
}
```

## 4. Inspect vs. interact

Webflow preview mode preserves responsive testing and site interactivity while reducing editor chrome. LAN's Inspect/Interact switch is directionally correct. The complete model should have:

- **Inspect:** prevent product navigation; hover/select editor objects.
- **Interact:** allow links, forms, dropdowns, sliders, and app behavior; selection is frozen.
- **Preview:** hide authoring chrome, run the preview snapshot, retain viewport controls.
- **Edit:** expose only content-safe fields and prevent structural/style commands.
- **Comment:** anchor feedback without mutation authority.
- **Analyze:** render read-only metrics overlays keyed to stable nodes.

## 5. Add panel and insertion

Insertion is not “append a fixture.” It requires:

1. choose a module definition;
2. determine insertion target and position;
3. validate allowed parent/child relationships;
4. create defaults and stable IDs;
5. create required styles/tokens/assets/bindings;
6. execute one transaction;
7. select and reveal the inserted object;
8. update source/snapshot adapters and evidence.

Drag-and-drop and click-to-add should call the same `InsertNodeCommand`.

## 6. Navigator behavior

Required Navigator features:

- expansion state independent from document state;
- virtualized large trees;
- keyboard navigation and reorder;
- drag indicators with valid/invalid parent feedback;
- search/filter by element, class, component, binding, issue, or name;
- symbols for hidden, conditional, bound, component, slot, locked, and issue states;
- multi-selection;
- isolate/focus component context;
- context menu generated from capabilities.

The Navigator must not be reconstructed solely from the rendered iframe DOM because conditionals, components, data-bound templates, slots, and non-rendered editor metadata cannot be recovered reliably from runtime DOM.

## 7. Style inspector behavior

Every displayed property should show:

- computed/effective value;
- authored value at the current selector/breakpoint/state;
- inherited source;
- variable alias chain;
- unit and validation state;
- whether the value differs across selected nodes;
- reset/remove action;
- breakpoint propagation impact;
- source output location;
- linked audit findings.

A simple form field without provenance creates destructive CSS edits.

## 8. Focus modes

Component editing and nested content need explicit focus context. The editor should show:

```text
Page -> Header instance -> Navigation slot -> Link component instance -> Text node
```

Commands must specify whether they target:

- the instance override;
- the component definition;
- all instances;
- a variant;
- a locale override;
- the slot content owned by a parent instance.

## 9. Command palette

LAN's existing command search should evolve into a registry query. Each command supplies:

- title, aliases, category, shortcut;
- required selection/active panel/context;
- parameters and defaults;
- capabilities and risk level;
- dry-run/preview support;
- help and evidence destination.

The palette can then safely route human, keyboard, CLI, MCP, and agent requests to the same command implementation.

## 10. Accessibility of the editor itself

The editor must be keyboard-operable, screen-reader meaningful, and not dependent on color. Required features include:

- roving tabindex in rails and trees;
- ARIA tree semantics for Navigator;
- visible focus and status text;
- keyboard resizing and direct numeric inputs;
- announcements for selection, command completion, errors, and undo;
- reduced motion;
- high-contrast editor theme;
- minimum target sizes;
- escape hierarchy for menus, focus modes, dialogs, and panels.

Webflow's own audit, contrast, accessible element, vision, and text-zoom tools demonstrate that accessibility belongs inside the creation workflow, not only at release. [WF-059, WF-153–WF-156]
