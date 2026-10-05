# 15 — Source Round-Trip and Framework Adapter Plan

## Problem

SYSTEMX must edit existing code, not only a proprietary document format. Naive string replacement is insufficient for structural visual editing.

## Adapter phases

### Phase A — inventory and provenance

Read source without mutation and produce:

- routes/pages/layouts;
- component definitions/import graph;
- JSX element tree for supported files;
- style/class/token references;
- CMS/provider/config references;
- source spans and stable fingerprints;
- capability classification.

### Phase B — constrained semantic writes

Support a deliberately narrow set:

- literal text/attribute/prop values;
- page metadata/config entries;
- class additions/removals;
- style declaration changes in owned stylesheets;
- insertion of generated-owned components/sections;
- safe route table entries.

### Phase C — structural round trip

Support moving/inserting/wrapping/deleting JSX subtrees, component extraction, imports, and generated style/token dependencies.

### Phase D — multi-framework packs

Add Next/Astro/Vue/Svelte only through separate tested adapters after React/Vite is production-capable.

## React/TypeScript adapter

Recommended toolchain evaluation:

- TypeScript compiler API or `ts-morph` for project/symbol/type context;
- Babel/SWC parsers for syntax coverage/performance where needed;
- Recast or controlled TypeScript printer for formatting-preserving transforms;
- ESLint/TypeScript/build verification after writes.

No library choice is final until spike tests measure formatting preservation, comments, JSX expressions, imports, generics, decorators, and source-map quality.

## Stable source mapping

A source mapping record:

```ts
type SourceOwnership = {
  objectId: string
  mode: 'source-owned' | 'document-owned' | 'hybrid-controlled'
  adapterId: string
  path: string
  symbol?: string
  span?: { start: number; end: number }
  fingerprint: string
  sourceRevision: string
  writeCapability: 'none' | 'literal' | 'style' | 'structure' | 'generated'
}
```

Fingerprints combine syntax kind, symbol ancestry, local structure, and surrounding stable identifiers. Line numbers alone are not identity.

## Import classification

| Classification | Meaning | Allowed action |
| --- | --- | --- |
| `roundtrip-safe` | supported syntax and unique mapping | typed visual/source writes |
| `generated-owned` | LAN owns designated generated region/file | full generated replacement with diff |
| `read-only-mapped` | can inspect/render but not safely write | open source/manual edit |
| `needs-review` | ambiguous route/component/style ownership | mapping workflow required |
| `unsupported` | parser/framework/pattern not supported | no mutation |

## Generated-owned regions

Prefer whole generated files or explicit generated directories over magic comments inside complex hand-authored files. If marker regions are used, they must be uniquely identified, checksum-protected, syntactically validated, and never nest.

## Source change plan

Before write:

```ts
type SourceChangePlan = {
  planId: string
  baseCommit: string
  baseHashes: Record<string, string>
  operations: SourceOperation[]
  semanticSummary: string[]
  textDiffs: FileDiff[]
  impactedCommands: string[]
  requiredChecks: string[]
  risk: 'low' | 'medium' | 'high'
}
```

Apply only if base hashes and document revision still match.

## CSS adapter

Use PostCSS AST to preserve comments/order and provide selector/declaration source spans. Separate authored styles from computed style. Support:

- create/update/delete rule/declaration;
- media-query mapping;
- CSS custom properties;
- safe selector rename with usage scan;
- formatting pass;
- browser computed-style verification.

## Tailwind adapter

Tailwind utility strings require parsing, conflict resolution, variants, arbitrary values, and configuration awareness. Define supported utility groups and preserve unknown classes. Do not reorder classes unless the formatter is deterministic and approved.

A style command may choose:

- existing utility;
- generated utility/class;
- owned CSS module/class;
- inline style only when policy allows.

## Router adapter

Replace hard-coded `routeByPage` with adapter detection:

- current template router AST;
- React Router route objects/JSX when enabled;
- file-based routes for future frameworks;
- dynamic segments, layouts, redirects, fallback;
- route source map and collision validation.

## Verification pipeline

For every source write:

1. backup;
2. apply to temporary copy/worktree when practical;
3. parse changed files;
4. format;
5. typecheck;
6. lint;
7. targeted tests;
8. build;
9. production-isolation scan;
10. compare imported document projection to intended transaction;
11. record hashes and evidence;
12. atomically promote or restore.

## Parse-print equivalence gates

A supported file must satisfy:

- parse -> print -> parse preserves semantic AST for unchanged input;
- comments/imports/source hints stay where expected;
- repeated application is idempotent;
- generated output builds;
- importer maps generated output back to the same object IDs;
- unsupported expressions remain unchanged and are not silently flattened.
