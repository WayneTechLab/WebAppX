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

### Primary public builder references

1. [Reference record 1](reference://lan-builder/ux/01) — defines the top bar, canvas bar, left toolbar, right toolbar, and canvas hierarchy.
2. [Reference record 2](reference://lan-builder/ux/02) — canvas interaction, element selection, visual cues, and preview behavior.
3. [Reference record 3](reference://lan-builder/ux/03) — explicit canvas width, scale, vision preview, and compact-screen operation.
4. [Reference record 4](reference://lan-builder/ux/04) — left-side hierarchy, pin/collapse behavior, and canvas synchronization.
5. [Reference record 5](reference://lan-builder/ux/05) — right-side property organization and reusable classes.
6. [Reference record 6](reference://lan-builder/ux/06) — categorized element palette and canvas/Navigator insertion.
7. [Reference record 7](reference://lan-builder/ux/07) — page hierarchy, search, folders, route settings, and destructive-action warning.
8. [Reference record 8](reference://lan-builder/ux/08) — collapsible/expandable panel state and persisted view modes.
9. [Reference record 9](reference://lan-builder/ux/09) — centralized tokens, responsive modes, and style-panel integration.
10. [Reference record 10](reference://lan-builder/ux/10) — direct panel routing, preview, breakpoints, undo/redo, and quick find.
11. [Reference record 11](reference://lan-builder/ux/11) — dedicated component workspace, frames, size modes, pan, and zoom.
12. [Reference record 12](reference://lan-builder/ux/12) — focused component authoring and multi-variant canvas orientation.
13. [Reference record 13](reference://lan-builder/ux/13) — audit lane placement and expandable issue groups.
14. [Reference record 14](reference://lan-builder/ux/14) — hide editor chrome while retaining essential breakpoint controls.
15. [Reference record 15](reference://lan-builder/ux/15) — canvas-bar breakpoint controls, resizing, and scaled large-canvas behavior.
16. [Reference record 16](reference://lan-builder/ux/16) — reflow, fixed/relative sizing, and breakpoint validation.
17. [Reference record 17](reference://lan-builder/ux/17) — reusable components, instances, variants, and component-panel workflows.
18. [Reference record 18](reference://lan-builder/ux/18) — grouped properties, instance overrides, and right-panel editing.
19. [Reference record 19](reference://lan-builder/ux/19) — collection schema, items, templates, and field grouping.
20. [Reference record 20](reference://lan-builder/ux/20) — table views, filtering, bulk actions, drafts, and search.
21. [Reference record 21](reference://lan-builder/ux/21) — dynamic-content binding and collection structure.
22. [Reference record 22](reference://lan-builder/ux/22) — collapsible bottom timeline with playback controls.
23. [Reference record 23](reference://lan-builder/ux/23) — grouped interaction controls and reusable presets.
24. [Reference record 24](reference://lan-builder/ux/24) — right-panel trigger organization and breakpoint targeting.
25. [Reference record 25](reference://lan-builder/ux/25) — automatic restore points plus operator-created snapshots.
26. [Reference record 26](reference://lan-builder/ux/26) — the canvas bar can be pinned above or below the canvas without changing the editing model.
27. [Reference record 27](reference://lan-builder/ux/27) — current device references and updated 393px, 667px, and 820px default canvas widths.
28. [Reference record 28](reference://lan-builder/ux/28) — controlled custom markup and explicit maintenance responsibility.
29. [Reference record 29](reference://lan-builder/ux/29) — page-route constraints and reserved path handling.
30. [Reference record 30](reference://lan-builder/ux/30) — selected-element settings in the right inspector.
31. [Reference record 31](reference://lan-builder/ux/31) — portable design structures and interaction conflict rules.
32. [Reference record 32](reference://lan-builder/ux/32) — reduced chrome, simplified palette, and focused navigation.
33. [Reference record 33](reference://lan-builder/ux/33) — direct canvas content editing and reduced context switching.
34. [Reference record 34](reference://lan-builder/ux/34) — role-aware collection controls and view-only states.
35. [Reference record 35](reference://lan-builder/ux/35) — inspector-controlled dynamic and manually curated datasets.
36. [Reference record 36](reference://lan-builder/ux/36) — context-aware page names and locale controls in the top bar.

### Component-oriented builder references

37. [Reference record 37](reference://lan-builder/ux/37) — Insert, Layers, Style, Data, Options, and publishing workflow.
38. [Reference record 38](reference://lan-builder/ux/38) — central iframe, two/three-column layouts, tabs, history, and device previews.
39. [Reference record 39](reference://lan-builder/ux/39) — top-center responsive preview controls and cascading styles.
40. [Reference record 40](reference://lan-builder/ux/40) — synchronized layer/canvas selection, nesting, search, and reordering.
41. [Reference record 41](reference://lan-builder/ux/41) — data bindings, events, state, API data, and code grouping.
42. [Reference record 42](reference://lan-builder/ux/42) — block-specific settings and advanced properties.
43. [Reference record 43](reference://lan-builder/ux/43) — explicit workspace modes and code-sync actions.
44. [Reference record 44](reference://lan-builder/ux/44) — style controls, design tokens, and strict-mode governance.
45. [Reference record 45](reference://lan-builder/ux/45) — codebase component registration and categorized insert menus.
46. [Reference record 46](reference://lan-builder/ux/46) — editor extensions, tokens, fields, plugins, and components-only mode.
47. [Reference record 47](reference://lan-builder/ux/47) — role-aware component availability and insert-tab contracts.
48. [Reference record 48](reference://lan-builder/ux/48) — isolated code/data controls and state binding.

### Responsive builder references

49. [Reference record 49](reference://lan-builder/ux/49) — center canvas, top breakpoint controls, left panels, right inspector, and bottom breadcrumbs.
50. [Reference record 50](reference://lan-builder/ux/50) — cascading responsive overrides and overlap troubleshooting.
51. [Reference record 51](reference://lan-builder/ux/51) — hierarchical layers, visibility, selection, and breakpoint ordering.
52. [Reference record 52](reference://lan-builder/ux/52) — official index for inspector, layers, breakpoints, preview, accessibility, and CSS editing.

### Component and scale references

53. [Reference record 53](reference://lan-builder/ux/53) — reusable building blocks and component/template separation.
54. [Reference record 54](reference://lan-builder/ux/54) — primary breakpoint first, CMS organization, and scalable project conventions.
55. [Reference record 55](reference://lan-builder/ux/55) — sensible canvas sizing, responsive variants, and maintainability.
56. [Reference record 56](reference://lan-builder/ux/56) — canvas-authored components embedded in CMS content with responsive variants.

## SYSTEMX-specific adaptations

SYSTEMX LAN is not a hosted clone of any reviewed product. Its shell adds
repository status, local-only source editing, backup/diff/confirmation gates,
Firebase and Google Cloud preflight, agent coordination, MCP routing, and
production-leakage protection. The vendor research informs layout behavior only;
SYSTEMX authority, data, and deployment boundaries remain defined by this
repository.
