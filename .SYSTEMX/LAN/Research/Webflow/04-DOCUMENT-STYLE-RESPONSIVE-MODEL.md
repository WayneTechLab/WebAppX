# 04 — Document, Style, and Responsive Model

## 1. Canonical document graph

Use stable IDs and normalized records rather than deeply nested mutable JSON as the only form of truth.

```ts
type DesignerDocument = {
  schemaVersion: number
  documentId: string
  revision: number
  site: SiteRecord
  pages: Record<PageId, PageRecord>
  nodes: Record<NodeId, NodeRecord>
  childOrder: Record<NodeId, NodeId[]>
  styles: Record<StyleId, StyleRecord>
  variables: Record<VariableId, VariableRecord>
  components: Record<ComponentId, ComponentDefinition>
  collections: Record<CollectionId, CollectionSchema>
  interactions: Record<InteractionId, InteractionDefinition>
  assets: Record<AssetId, AssetRecord>
  indexes: DerivedIndexes
  ownership: Record<ObjectId, OwnershipRecord>
}
```

Normalized records make moves, references, patches, comments, analytics, source maps, and migrations more reliable.

## 2. Node semantics

A node is not arbitrary HTML. It has a known editor type and a renderer/source adapter:

```ts
type NodeRecord = {
  id: NodeId
  type: 'element' | 'text' | 'image' | 'link' | 'form' | 'component-instance' |
        'collection-list' | 'slot-content' | 'code-embed' | 'outlet'
  semanticTag?: string
  name?: string
  props: Record<string, JsonValue>
  styleRefs: StyleRef[]
  bindings: BindingRef[]
  conditional?: ConditionExpr
  interactionRefs?: InteractionId[]
  metadata: NodeMetadata
}
```

Adapters validate which semantic tags and props are legal, which children are accepted, and how the node maps to React/DOM/source.

## 3. Style graph

A Webflow-class style model needs more than inline property bags. Separate:

- selector identity;
- declaration blocks;
- selector combinations/states;
- breakpoint layers;
- variable/token references;
- generated class names/source ownership;
- computed result/provenance.

```ts
type StyleRule = {
  id: StyleRuleId
  selector: SelectorAst
  breakpointId: BreakpointId
  state: 'base' | 'hover' | 'focus' | 'focus-visible' | 'active' | 'visited' |
         'before' | 'after'
  declarations: Record<CssProperty, CssValueOrVariableRef>
  order: number
  source?: SourceSpan
}
```

Use the browser standards as the semantic source of truth: cascade, CSSOM, values/units, media queries, custom properties, containment, Grid, Flexbox, selectors, HTML, and DOM. [STD-001–STD-011]

## 4. Breakpoint cascade

Webflow documents breakpoint inheritance rather than independent layouts. LAN should make this explicit.

Recommended ordered model:

```text
base desktop
├── descending overrides: tablet -> mobile landscape -> mobile portrait
└── ascending overrides: large -> x-large -> 2x-large
```

For each declaration, show:

- effective value;
- origin breakpoint;
- whether current breakpoint overrides it;
- affected descendant/ancestor breakpoint ranges;
- reset-to-inherit;
- conflicts with source media queries.

Custom breakpoints can be supported after base semantics are stable. A breakpoint is a policy object, not just a canvas width.

## 5. Variables, aliases, and modes

```ts
type VariableRecord = {
  id: VariableId
  collectionId: VariableCollectionId
  name: string
  type: 'color' | 'length' | 'number' | 'font-family' | 'font-weight' |
        'duration' | 'cubic-bezier' | 'string'
  valuesByMode: Record<ModeId, VariableValue | VariableAlias>
  description?: string
  status: 'active' | 'deprecated'
}
```

Required safeguards:

- no alias cycles;
- compatible types only;
- preview before rename/delete;
- usage index across styles, components, interactions, and content;
- fallback rules;
- mode inheritance;
- source mapping to CSS custom properties or typed constants.

Modes support themes, brands, locales, or other contexts. Keep mode axes explicit so `dark`, `client-a`, and `mobile` do not become an untestable string soup.

## 6. Layout primitives

The inspector should support standards-complete Grid, Flexbox, block/inline, positioning, sizing, overflow, typography, backgrounds, borders, filters, transforms, transitions, and container-aware behavior. But the command engine should work on typed CSS values, not arbitrary strings.

Example:

```ts
type LengthValue =
  | { kind: 'number'; value: number; unit: 'px' | 'rem' | 'em' | '%' | 'vw' | 'vh' }
  | { kind: 'keyword'; value: 'auto' | 'min-content' | 'max-content' | 'fit-content' }
  | { kind: 'variable'; variableId: string }
  | { kind: 'function'; ast: CssFunctionAst }
```

Keep an advanced raw CSS lane only after parsing and validation. Never inject raw CSS or script directly into public output without policy.

## 7. Computed style and provenance

The kernel should return a property trace:

```json
{
  "property": "padding-inline",
  "effective": "var(--space-6)",
  "resolved": "24px",
  "origin": {
    "styleId": "style-card",
    "breakpointId": "desktop",
    "state": "base",
    "source": "src/styles/components.css:42"
  },
  "overriddenCandidates": [],
  "affectedBreakpoints": ["desktop", "tablet", "mobile-landscape", "mobile"]
}
```

This trace powers inspector explanations, semantic diffs, diagnostics, and safe reset.

## 8. Source output strategy

The first adapters should be:

1. PostCSS AST for authored CSS files;
2. Tailwind class parsing/generation for supported utility patterns;
3. React/TSX AST for `className`, props, and component structure;
4. design-token JSON/TS/CSS-variable generation.

Do not promise perfect round-trip support for every existing pattern. The importer should classify each object as:

- `roundtrip-safe`;
- `read-only-mapped`;
- `generated-owned`;
- `needs-review`;
- `unsupported`.

## 9. Tests

- cascade conformance fixtures;
- property parser tests;
- breakpoint inheritance tests;
- variable alias and cycle tests;
- parse-print-parse equivalence;
- source-map stability;
- semantic diff snapshots;
- browser computed-style comparison at representative widths;
- Grid/Flex visual regression;
- no-control-plane-leak build assertion.
