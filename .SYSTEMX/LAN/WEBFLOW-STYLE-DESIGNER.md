# SYSTEMX LAN Designer UI Contract

This document defines the interaction model for the local `.SYSTEMX/LAN`
builder. It is a generic implementation of a visual web-app designer pattern
and is not a copy of another product's source code, assets, or branding.

## Why the layout changed

The LAN builder is a control surface for editing the current SFWA-WTL-G1
template. It needs to keep the live application visible while making the
surrounding tools discoverable. A dashboard that renders every subsystem at
once makes the design surface feel like a status report. The designer mode
therefore uses one active panel at a time on each side of the canvas.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ SYSTEMX LAN · Design / CMS / Insights · command search · runtime · menu  │
├────┬──────────────┬─┬───────────────────────┬─┬──────────────┬────┤
│ SX │ Active left  │↔│ Canvas + live app     │↔│ Active right │ DS │
│ +  │ panel        │ │ live Vite/Firebase    │ │ inspector    │ DB │
│ P  │ Add / Pages  │ │ Vite/Firebase preview │ │ grouped tabs │ {} │
│ N  │ Navigator    │ │ layer/model dock      │ │ Design/Data  │ A0 │
│ A  │ Components   │ │                       │ │ Build/Ops    │    │
├────┴──────────────┴─┴───────────────────────┴─┴──────────────┴────┤
│ Evidence ▾  |  centered device / exact-width / Fit controls  | Inspect │
└────────────────────────────────────────────────────────────────────┘
```

## Panel contract

| Zone | SYSTEMX behavior | Current implementation |
| --- | --- | --- |
| Top toolbar | Switch the main work mode and expose quick actions | `Website_Dashboard.html` `.builder-toolbar` |
| Left rail | Choose a structure or project panel | `.workspace-rail` with `data-panel-target` |
| Left panel | Render only the selected structure tool | `[data-left-panel]` with `.is-active` |
| Canvas context | Show selected page, breadcrumbs, preview, and save state | `.canvas-header` and `.canvas-context-row` |
| Canvas | Keep the running Vite application visible | `#app-preview-frame` |
| Application bar | Keep responsive-device controls centered outside the preview; expose Inspect mode, current stack location, and Evidence | `.canvas-application-bar` and `.canvas-control-toolbar` |
| Panel dividers | Resize a dock without covering the canvas | `.panel-resizer` and persisted CSS width variables |
| Right rail | Choose Design, Data, Build, or Ops | `.right-toolbar` with `data-inspector-group-button` |
| Right tabs | Choose one tool within the active group | `[data-inspector-tab]` |
| Right panel | Render only the selected inspector | `.right-panel > [data-right-panel]` with `.is-active` |
| Evidence drawer | Reveal local sync state, next gates, and controlled files only when requested | `#evidence-toggle` and `#evidence-drawer` |

## Live preview inspection

The same-origin Vite bridge turns the current app into an inspectable canvas
without importing LAN code into the production application:

1. **Inspect** mode is on by default. Hover outlines a target and a click
   selects it without navigating the app.
2. The breadcrumb and bottom application bar show the current route, mapped
   source file, and DOM hierarchy.
3. Right-click opens a local context menu with parent selection, source
   opening, Navigator access, and staging actions for reusable modules or
   components.
4. The Up Arrow selects the current element's parent. Escape closes the
   context menu, Evidence drawer, or active inspector.
5. Turning Inspect off restores ordinary preview interaction so links, forms,
   and controls can be exercised normally.

Reusable shell elements carry non-secret source hints:
`data-systemx-component`, `data-systemx-source`, and
`data-systemx-reusable`. Page content without an explicit hint maps through
the active route model. These attributes exist only in Vite development and
the post-build isolation gate rejects them from `dist`; they do not grant write
authority. A staged module still requires review and the existing
`SAVE MODULE` confirmation before the local registry changes.

Direct access on the LAN control port cannot inspect a Vite iframe on another
origin. In that case selection fails closed and the operator is directed to
the same-origin `/__systemx/` Vite bridge.

## Selected-text editing

A click on a safe leaf-text element opens the Settings inspector and
synchronizes the same target across Settings, Navigator, Components, the
canvas breadcrumb, and the bottom stack-location display.

The text editor has four distinct operations:

1. **Preview text** changes only the current local iframe DOM.
2. **Revert preview** restores the text captured when the element was selected.
3. **Open source** loads the mapped allowlisted React/TypeScript file.
4. **Save text to source** requires `SAVE TEXT CHANGE`, confirms the original
   text occurs exactly once, encodes JSX-sensitive characters, and then uses
   the existing `SAVE LOCAL CHANGE` source API. That API performs the secret
   scan, backup, atomic write, and operation logging.

Elements with nested child elements are not inline-editable because replacing
their `textContent` would destroy structure. Empty elements, script/style/SVG
nodes, text over 2,000 characters, unmapped files, missing source occurrences,
and duplicate source occurrences fail closed and direct the operator to the
controlled source editor.

## Left-side tools

The left rail is deliberately focused on how the site is structured:

- `Menu` opens SYSTEMX navigation and control actions.
- `Add` exposes the module palette for containers, text, images, buttons,
  forms, and collection lists.
- `Pages` manages local page models and routes.
- `Navigator` explains the current page node tree and opens the layer tree.
- `Components` describes reusable shell and template modules.
- `Assets` shows controlled local asset locations.
- `CMS` opens the right-side data inspector for collections and local records.
- `Cloud` opens provider and CLI/SDK readiness.
- `Audit` opens evidence and quality gates.

The left panel is not a second canvas. It is a tool context. Selecting a rail
item updates the hash and hides the other left panel sections.

## Canvas context

The canvas is the primary workspace. The context bar must keep these controls
near the preview:

- Undo and redo affordances for the local edit history.
- Breadcrumbs from Pages to the selected page and element.
- A centered application bar outside the preview with quick breakpoint icons,
  iOS/iPadOS and Android device presets, custom width, and Fit mode.
- Inspect/Interact mode with route, source, and DOM-path feedback.
- Local backup state.
- A `Layers` control for the bottom page-model dock.
- Preview and Save actions.
- Vite/Firebase endpoint information.

The preview remains loopback-only. A preview action does not authorize a cloud
deployment, and Save remains subject to the SYSTEMX backup, diff, and explicit
confirmation policy.

The selected preview preset is a real iframe viewport width, not a decorative
button state. Fixed widths from 320px through 2560px are centered in a
scrollable canvas stage; Fit mode uses the available editor width. The selected
mode and width are non-secret local layout preferences and survive reload.

The layer tree and page-model form are not permanent canvas clutter. They live
inside a bottom dock that starts closed in `#canvas`, opens from `Layers` or
the Navigator lane, and closes when a right-side inspector opens. This keeps
the live preview as the default editing plane on laptop and IDE-sized windows.

## Right-side inspectors

The right rail is deliberately grouped so the operator sees four stable modes
instead of eight competing menu buttons:

- `Design` tabs between Style and Settings.
- `Data` tabs between CMS collections and Users/CRM.
- `Build` tabs between the allowlisted Code editor and Cloud/provider state.
- `Ops` tabs between Agent 0, MCP/tool routing, and quality/deployment Gates.

Only one right-side inspector is active at a time. This keeps the selection
context stable and prevents cloud or agent controls from visually competing
with a style edit.

The rail chooses a group and the inspector tab row chooses a tool. The context
row shows `Inspector`, provides `← Canvas`, and provides the collapse chevron.
Clicking canvas chrome outside the live preview, pressing Escape, or either
Preview action closes the inspector and returns the workspace to `#canvas`.
Clicking inside the preview retains or opens the relevant inspector context.

## Main modes

The top bar exposes three user-facing work modes and one SYSTEMX operations
mode:

1. `Design` — edit page structure, components, styles, and source contracts.
2. `CMS` — inspect collections, records, user fixtures, and data bindings.
3. `Insights` — review evidence, audits, local sync, and provider readiness.
4. `SYSTEMX` — open control, AGI, MCP, setup, and deployment gates.

These are navigation modes, not cloud authorization levels. Production remains
locked behind the existing CLI preflight and deployment controls.

## Route and state rules

- The active workspace is represented by a hash such as `#canvas`, `#pages`,
  `#style`, or `#providers`.
- `dashboard.js` owns panel activation through `activateLeftPanel` and
  `activateRightPanel`.
- The left and right rails have independent collapse state and keyboard-
  accessible resize separators. The canvas grid removes a collapsed panel's
  column and persists non-secret layout preferences under
  `systemx.lan.builder.layout.v2`.
- The right toolbar owns inspector groups. The inspector tab row owns the
  selected tool in that group.
- Below the desktop canvas budget, opening a right panel closes the left panel
  and opening a left panel closes the right panel. At phone widths the selected
  panel replaces the canvas rather than overlaying it.
- `← Canvas`, the inspector collapse chevron, and a click on canvas chrome
  outside the preview collapse the right inspector. A preview-element click
  retains or opens the relevant Settings context. A preview launch clears the
  active inspector context before opening the public app in a new tab.
- The bottom layer/model dock is controlled by the canvas `Layers` button. It
  is closed by default in `#canvas`, opens for Navigator work, and closes when
  Style, Settings, Source, CMS, Cloud, AGI, MCP, or Gates opens.
- The browser URL remains the full local URL, including the bridge path and
  hash, so a staff member can copy or bookmark a workspace context.
- The public app route remains the normal Vite/Firebase route. `.SYSTEMX/LAN`
  is not imported into `src`, `public`, or `dist`.
- Direct LAN access uses the session-owned loopback control port (preferred
  `7331`, automatically moved when another project is using it); the Vite
  bridge uses the session-owned app port (preferred `5173`) at
  `/__systemx/`. Both URLs point to the same LAN builder session.

## Responsive modules and ingest

The Components panel is a registry, not a static list of source filenames.
Each module carries a source or local-model reference, semantic role, tags,
slots, and width behavior. A selected canvas node can be linked to a registry
ID, allowing a header, footer, shell, or content section to be reused while
the page tree retains its own placement. The export is a normalized
`systemx-component` manifest for other WTL stack projects.

The same panel includes an inventory-only existing-project lane. It scans
metadata and safe filenames for pages, routes, components, styles, provider
indicators, and testing tools, then writes a review manifest under ignored
`.SYSTEMX/LAN/Temp/ingest/`. It never reads secret contents, installs a
bridge, or writes to `public`, `dist`, source files, Firebase, GCloud, Drive,
SQL, or Stripe. Bridge installation is a separate backup-first operation.

## Reference research

The interaction model was checked against 56 official sources from Webflow,
Builder.io, Wix Studio, and Framer. Read the source register and per-source
takeaways in
[`WEB-BUILDER-UX-RESEARCH.md`](WEB-BUILDER-UX-RESEARCH.md). This is an
interaction-pattern study only; no vendor code, assets, branding, or private
implementation is copied.

## Acceptance checks

Before changing this shell, verify:

```text
1. Design mode shows the left rail, active Add panel, live canvas, and right
   rail while keeping the right inspector and bottom layer dock closed.
2. Pages hides Add, Navigator, Components, and Assets while keeping the live
   canvas visible.
3. Style hides Settings, Code, CMS, Cloud, AGI, and MCP panels.
4. The top-right workspace menu opens and closes with Escape or outside click.
5. The full Vite bridge URL and hash remain visible in the browser.
6. Production build output contains no SYSTEMX LAN markers.
7. Components can be registered, exported, and linked to a selected node.
8. Existing-project ingest reports findings with `writeAllowed: false`.
9. Left and right panel toggles independently change the canvas width without
   placing either panel over the preview.
10. Panel resize values survive reload and are keyboard adjustable.
11. At 1024px only one heavy panel opens at a time; at phone widths the panel
    and canvas use focus mode.
12. The centered application bar is outside the preview and selecting Desktop,
    Tablet, iOS, Android, a named device, Custom, or Fit changes the iframe
    viewport width.
13. Evidence stays hidden until its application-bar button opens the drawer.
14. A preview click reports route, source, and DOM path; right-click can select
    a parent, open mapped source, or stage a module/component without saving.
15. Turning Inspect off restores ordinary website interaction.
16. Selecting a leaf-text element opens Settings and populates its text, route,
    semantic tag, source file, DOM path, Navigator hierarchy, and Components
    target.
17. Preview and Revert change no source file; Save requires
    `SAVE TEXT CHANGE`, creates a backup, and succeeds only for one exact source
    occurrence.
```
