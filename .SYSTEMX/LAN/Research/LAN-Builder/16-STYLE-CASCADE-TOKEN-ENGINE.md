# 16 — Style Cascade, Token, Responsive, and Layout Engine Plan

## Goals

- faithfully represent browser CSS semantics for the supported subset;
- explain where every effective value comes from;
- make responsive inheritance visible and reversible;
- allow design-system constraints without blocking standards-compliant advanced use;
- generate deterministic CSS/Tailwind output.

## Domain model

```text
StyleSelector
  -> StyleRule at breakpoint/state/layer
     -> typed declarations
        -> literal values or variable aliases
           -> variable collection/mode values
```

### Selector AST

Support in stages:

1. class selectors and tag presets;
2. combo classes/compound selectors;
3. pseudo-classes and pseudo-elements;
4. component/instance scoping;
5. advanced selectors as parsed read-only, then controlled editing.

### Cascade dimensions

- origin/layer;
- importance;
- selector specificity;
- source order;
- breakpoint/media applicability;
- state;
- inheritance;
- variable resolution;
- inline/generated overrides.

## Breakpoint model

```ts
type Breakpoint = {
  id: string
  name: string
  kind: 'base' | 'max-width' | 'min-width' | 'container'
  value?: number
  unit?: 'px' | 'rem'
  cascadeDirection: 'base' | 'down' | 'up' | 'scoped'
  order: number
}
```

The inspector computes affected ranges before a write. A command can:

- set current-only override;
- set base and propagate;
- clear override;
- promote repeated overrides to base/token;
- compare values across breakpoints;
- detect contradictory source queries.

## Style provenance UI

For each property:

```text
Padding inline: 24px
  authored as: var(--space-6)
  selector: .card
  origin: desktop/base
  inherited by: tablet, mobile landscape, mobile
  source: src/styles/components.css:42
  variable: spacing/6 -> default mode -> 24px
```

A user can jump to selector, token, source, usages, or history.

## Token collections and modes

Recommended initial collections:

- color;
- typography;
- spacing/sizing;
- radius/border;
- shadow/elevation;
- motion;
- z-index;
- breakpoint/layout;
- brand/theme.

Modes can represent light/dark or brand/client variants. Keep breakpoint overrides in the style dimension unless a token intentionally varies by breakpoint.

## Design-system policies

Policies are configurable rules, not hard-coded restrictions:

- allowed variable collections;
- spacing scale;
- allowed font sizes/weights;
- accessible contrast thresholds;
- maximum z-index bands;
- disallowed arbitrary values;
- component-local style ownership;
- naming conventions;
- deprecation warnings.

Violations can warn or block based on project edition and release policy.

## Layout inspector

### Flexbox

- direction, wrap, alignment, distribution, gap;
- child grow/shrink/basis/order/alignment;
- overflow and min-size warnings;
- visual axis controls plus exact fields.

### Grid

- explicit/implicit tracks;
- repeat/minmax/fr units;
- named lines/areas;
- auto-flow;
- item placement/span;
- breakpoint diffs;
- overlay controls synchronized with numeric fields.

### Positioning and sizing

- normal flow, relative, absolute, fixed, sticky;
- containing-block explanation;
- inset controls;
- min/max/intrinsic sizes;
- aspect ratio;
- overflow/scroll container;
- container query context in later wave.

## Typography and accessibility

- semantic heading/tag separate from visual typography;
- relative units and text zoom testing;
- line height/measure/readability diagnostics;
- variable font axes where supported;
- contrast checker and state comparison;
- link/focus/visited states;
- no removal of focus outline without replacement.

## Performance

- cache computed traces by revision/selection/breakpoint/state;
- invalidate only affected selectors/variables/usages;
- virtualize style usage lists;
- perform browser-computed verification in a worker/browser harness;
- cap arbitrary selector complexity for editable mode;
- benchmark 10k nodes, 5k rules, 2k variables, and 100 breakpoints/modes combinations in synthetic stress fixtures.

## Acceptance criteria

- computed values match browser fixtures for supported CSS;
- reset always returns to the displayed inherited value;
- variable aliases resolve deterministically and cycles are blocked;
- responsive changes show affected breakpoints before commit;
- source output is idempotent;
- style history can be semantically diffed and undone;
- audit identifies inaccessible contrast and invalid/unsupported values.
