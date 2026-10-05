# 27 — Comparator Architecture Lessons

The comparator sources are not used to rank products or copy interfaces. They expose alternative solutions to the same editor problems.

## Component-oriented reference builders

Public documentation shows iframe-oriented editing, data binding, and registered custom code components. [CMP-001–CMP-003]

**Lessons for LAN:**

- a visual canvas can be an adapter over an existing application runtime;
- custom components need registration metadata and controlled props;
- data bindings should be typed editor objects;
- preview/canvas messaging needs a stable protocol;
- source/application ownership must be explicit.

**SYSTEMX difference:** repository writes remain plan/diff/approval operations with local evidence rather than an opaque remote content payload.

## Responsive reference builders

Public responsive-builder documentation emphasizes breakpoint-aware design and inspector-driven controls. [CMP-004–CMP-007]

**Lessons for LAN:**

- responsive behavior must be visible as a system, not a set of screenshots;
- inspector grouping and breakpoint-specific feedback determine usability;
- complex layout controls need both visual handles and exact values;
- a professional editor needs clear inheritance/override cues.

## Canvas-native reference builders

Public canvas-builder documentation shows a canvas-native model combining CMS, reusable content components, site preview, layout grids, and text styles. [CMP-008–CMP-013]

**Lessons for LAN:**

- speed and direct manipulation are strategic, not cosmetic;
- CMS content and components should feel native to the canvas;
- preview should be one action away;
- grid and typography systems need first-class visual affordances;
- the editor can remain approachable while retaining reusable systems.

## Design-system references

Public plugin documentation exposes stable nodes, component APIs, variables, and a mature extension model. [CMP-014–CMP-017]

**Lessons for LAN:**

- stable object IDs are the foundation for plugins, comments, history, and selection;
- plugin objects should be API contracts, not raw internals;
- variables need collections, modes, scope, aliasing, and usage;
- capabilities and editor state should be explicit;
- API evolution and compatibility matter from the first public extension.

## Open component references

Open documentation separates components, style management, and storage management. [CMP-018–CMP-020]

**Lessons for LAN:**

- document components, style UI, and persistence should be modular;
- storage is an adapter concern;
- model/view boundaries reduce editor coupling;
- plugin-friendly architecture benefits from well-defined module APIs.

## Synthesis

| Problem | Strongest combined lesson | LAN action |
| --- | --- | --- |
| Existing app canvas | runtime bridge + stable protocol | formalize canvas adapter and overlay protocol |
| Components | manifest + stable definition/instance model | build typed component registry and code adapter |
| Responsive design | cascade-aware visual inspector | implement provenance, affected breakpoints, exact controls |
| CMS | native canvas bindings | compile typed binding context and fixtures |
| Plugins | stable object API + capabilities | sandbox over query/command services |
| Storage/source | pluggable but explicit ownership | hybrid source/document ownership and adapters |
| Speed | direct manipulation over shared kernel | optimistic UI with transactional server commit |

The right architecture is not a blend of visual appearances. It is a set of independent primitives that make multiple interface styles possible.
