# SYSTEMX LAN Builder UX Research

Date: 2026-08-05  
Scope: local-only `.SYSTEMX/LAN` visual builder shell  
Research rule: study interaction contracts and information architecture only. Do
not copy vendor source code, private assets, trademarks, icons, or visual identity.

## Resulting shell contract

The reviewed professional builders consistently treat the canvas as the primary
workspace and put controls around it in predictable, independently scrollable
regions. SYSTEMX LAN therefore uses:

1. A compact top command bar for workspace mode, search, runtime state, preview,
   and the global menu.
2. A narrow left rail with one active structure panel for Add, Pages, Navigator,
   Components, Assets, CMS, Cloud, or Audit.
3. A center canvas that always receives the remaining width.
4. A narrow right rail with four grouped inspector modes: Design, Data, Build,
   and Ops.
5. A tabbed right inspector so related tools share one panel rather than opening
   simultaneous menus.
6. Keyboard-accessible drag handles for left and right panel resizing.
7. Persisted, non-secret panel width, open/closed state, and active tabs.
8. Automatic canvas-width protection: smaller workspaces keep only one heavy
   panel open.
9. A compact bottom application bar in the editor grid, with centered
   responsive controls and Evidence opened only as an explicit drawer.
10. A phone-width focus mode where a panel replaces the canvas instead of
    overlapping it.

## Source register

### Webflow — interface and canvas

1. [Intro to Webflow](https://help.webflow.com/hc/en-us/articles/33961260162323-Intro-to-Webflow) — defines the top bar, canvas bar, left toolbar, right toolbar, and canvas hierarchy.
2. [Webflow canvas overview](https://help.webflow.com/hc/en-us/articles/33961319255059-Webflow-canvas-overview) — canvas interaction, element selection, visual cues, and preview behavior.
3. [Canvas settings](https://help.webflow.com/hc/en-us/articles/33961230930579-Canvas-settings) — explicit canvas width, scale, vision preview, and compact-screen operation.
4. [Navigator](https://help.webflow.com/hc/en-us/articles/33961320786451-Navigator) — left-side hierarchy, pin/collapse behavior, and canvas synchronization.
5. [Style panel overview](https://help.webflow.com/hc/en-us/articles/33961362040723-Style-panel-overview) — right-side property organization and reusable classes.
6. [The Add panel](https://help.webflow.com/hc/en-us/articles/33961270096659-The-Add-panel) — categorized element palette and canvas/Navigator insertion.
7. [Pages panel overview](https://help.webflow.com/hc/en-us/articles/33961360067987) — page hierarchy, search, folders, route settings, and destructive-action warning.
8. [Assets panel](https://help.webflow.com/hc/en-us/articles/33961269934227-Assets-panel) — collapsible/expandable panel state and persisted view modes.
9. [Variables](https://help.webflow.com/hc/en-us/articles/33961268146323-Variables) — centralized tokens, responsive modes, and style-panel integration.
10. [Keyboard shortcuts in Webflow](https://help.webflow.com/hc/en-us/articles/33961359609875-Keyboard-shortcuts-in-Webflow) — direct panel routing, preview, breakpoints, undo/redo, and quick find.
11. [Component canvas](https://help.webflow.com/hc/en-us/articles/49505240420755-Component-canvas) — dedicated component workspace, frames, size modes, pan, and zoom.
12. [Component Canvas is now available](https://webflow.com/updates/component-canvas-is-rolling-out-now) — focused component authoring and multi-variant canvas orientation.
13. [Intro to the Audit panel](https://help.webflow.com/hc/en-us/articles/33961313088531-Intro-to-the-Audit-panel) — audit lane placement and expandable issue groups.
14. [Preview mode](https://help.webflow.com/hc/en-us/articles/40881969908627-Preview-mode) — hide editor chrome while retaining essential breakpoint controls.
15. [Breakpoints overview](https://help.webflow.com/hc/en-us/articles/33961300305811-Breakpoints-overview) — canvas-bar breakpoint controls, resizing, and scaled large-canvas behavior.
16. [Intro to responsive design](https://help.webflow.com/hc/en-us/articles/33961293397779-Intro-to-responsive-design) — reflow, fixed/relative sizing, and breakpoint validation.
17. [Components overview](https://help.webflow.com/hc/en-us/articles/33961303934611-Components-overview) — reusable components, instances, variants, and component-panel workflows.
18. [Component properties](https://help.webflow.com/hc/en-us/articles/33961219350547-Component-properties) — grouped properties, instance overrides, and right-panel editing.
19. [Intro to the Webflow CMS](https://help.webflow.com/hc/en-us/articles/33961307099027-Intro-to-the-Webflow-CMS) — collection schema, items, templates, and field grouping.
20. [Collection items overview](https://help.webflow.com/hc/en-us/articles/33961289539347-Collection-items-overview) — table views, filtering, bulk actions, drafts, and search.
21. [Collection list](https://help.webflow.com/hc/en-us/articles/33961294051347-Collection-list) — dynamic-content binding and collection structure.
22. [Interactions timeline](https://help.webflow.com/hc/en-us/articles/42861689104531-Interactions-timeline) — collapsible bottom timeline with playback controls.
23. [Actions and animations](https://help.webflow.com/hc/en-us/articles/42832337629075-Actions-and-animations) — grouped interaction controls and reusable presets.
24. [Triggers and animations in Classic Interactions](https://help.webflow.com/hc/en-us/articles/33961357722643-Triggers-and-animations-in-Classic-Interactions) — right-panel trigger organization and breakpoint targeting.
25. [Save and restore backups](https://help.webflow.com/hc/en-us/articles/33961244069395-Save-and-restore-backups) — automatic restore points plus operator-created snapshots.
26. [Updates to in-product navigation](https://webflow.com/updates/product-nav-updates) — the canvas bar can be pinned above or below the canvas without changing the editing model.
27. [Modern devices for the canvas](https://webflow.com/updates/modern-canvas-devices) — current device references and updated 393px, 667px, and 820px default canvas widths.
28. [Custom element](https://help.webflow.com/hc/en-us/articles/33961250668691-Custom-element) — controlled custom markup and explicit maintenance responsibility.
29. [Page URLs](https://help.webflow.com/hc/en-us/articles/33961362705171-Page-URLs) — page-route constraints and reserved path handling.
30. [Link settings](https://help.webflow.com/hc/en-us/articles/33961408937747-Link-settings) — selected-element settings in the right inspector.
31. [Copy and paste between sites](https://help.webflow.com/hc/en-us/articles/33961319728403-Copy-and-paste-between-sites) — portable design structures and interaction conflict rules.
32. [Introducing a new look and feel to Webflow](https://webflow.com/updates/webflow-redesign) — reduced chrome, simplified palette, and focused navigation.
33. [Expanded on-canvas editing](https://webflow.com/updates/expanded-on-canvas-editing) — direct canvas content editing and reduced context switching.
34. [CMS collection-specific access](https://help.webflow.com/hc/en-us/articles/43696365862803-CMS-collection-specific-access) — role-aware collection controls and view-only states.
35. [Dynamic vs. curated Collection lists](https://help.webflow.com/hc/en-us/articles/41225336636307-Dynamic-vs-curated-Collection-lists) — inspector-controlled dynamic and manually curated datasets.
36. [Localize page settings](https://help.webflow.com/hc/en-us/articles/33961235760531-Localize-page-settings) — context-aware page names and locale controls in the top bar.

### Builder.io — adaptable panel arrangements and code integration

37. [The Visual Editor](https://www.builder.io/c/docs/visual-editor) — Insert, Layers, Style, Data, Options, and publishing workflow.
38. [Intro to the Visual Editor](https://www.builder.io/c/docs/101-visual-editor/) — central iframe, two/three-column layouts, tabs, history, and device previews.
39. [Breakpoints](https://www.builder.io/c/docs/breakpoints) — top-center responsive preview controls and cascading styles.
40. [Layers tab](https://www.builder.io/c/docs/layers-tab) — synchronized layer/canvas selection, nesting, search, and reordering.
41. [Visual Editor Data tab](https://www.builder.io/c/docs/visual-editor-data-tab) — data bindings, events, state, API data, and code grouping.
42. [Options tab](https://www.builder.io/c/docs/options-tab) — block-specific settings and advanced properties.
43. [Projects Design, Interact, and Code modes](https://www.builder.io/c/docs/projects-editing-modes/) — explicit workspace modes and code-sync actions.
44. [Projects Style tab](https://www.builder.io/c/docs/fusion-style-tab) — style controls, design tokens, and strict-mode governance.
45. [Custom components in the Visual Editor](https://www.builder.io/c/docs/custom-components-visual-editor) — codebase component registration and categorized insert menus.
46. [Customize Builder](https://www.builder.io/c/docs/customizing-builder) — editor extensions, tokens, fields, plugins, and components-only mode.
47. [Built-in component API reference](https://www.builder.io/c/docs/component-api-reference/) — role-aware component availability and insert-tab contracts.
48. [Custom code in the Visual Editor](https://www.builder.io/c/docs/custom-code) — isolated code/data controls and state binding.

### Wix Studio — responsive editor shell

49. [Studio Editor: A Guided Tour](https://support.wix.com/en/article/studio-editor-a-guided-tour) — center canvas, top breakpoint controls, left panels, right inspector, and bottom breadcrumbs.
50. [Studio Editor: Designing Across Breakpoints](https://support.wix.com/en/article/studio-editor-designing-across-breakpoints) — cascading responsive overrides and overlap troubleshooting.
51. [Studio Editor: Working With Layers](https://support.wix.com/en/article/studio-editor-working-with-layers) — hierarchical layers, visibility, selection, and breakpoint ordering.
52. [Using the Studio Editor Tools](https://support.wix.com/en/using-the-studio-editor-tools) — official index for inspector, layers, breakpoints, preview, accessibility, and CSS editing.

### Framer — components and scalable projects

53. [Using components](https://www.framer.com/help/articles/using-components/) — reusable building blocks and component/template separation.
54. [Setting up your Framer site for scale](https://www.framer.com/help/articles/setting-up-your-framer-site-for-scale/) — primary breakpoint first, CMS organization, and scalable project conventions.
55. [Component best practices](https://www.framer.com/help/articles/component-best-practices/) — sensible canvas sizing, responsive variants, and maintainability.
56. [CMS Components](https://www.framer.com/updates/cms-components) — canvas-authored components embedded in CMS content with responsive variants.

## SYSTEMX-specific adaptations

SYSTEMX LAN is not a hosted clone of any reviewed product. Its shell adds
repository status, local-only source editing, backup/diff/confirmation gates,
Firebase and Google Cloud preflight, agent coordination, MCP routing, and
production-leakage protection. The vendor research informs layout behavior only;
SYSTEMX authority, data, and deployment boundaries remain defined by this
repository.
