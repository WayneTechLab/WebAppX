# 05 — Components, CMS, Data Binding, Forms, and Commerce

## 1. Components are definitions plus instances

Webflow's current component surface includes definitions, component-focused editing, properties, slots, variants, and libraries. [WF-021–WF-026]

LAN should model these separately:

```ts
type ComponentDefinition = {
  id: ComponentId
  name: string
  rootNodeId: NodeId
  propSchema: PropDefinition[]
  slotSchema: SlotDefinition[]
  variantAxes: VariantAxis[]
  defaultVariant: VariantSelection
  version: string
  dependencies: ComponentDependency[]
  ownership: OwnershipRecord
  migrationIds: string[]
}

type ComponentInstance = {
  nodeId: NodeId
  componentId: ComponentId
  componentVersion: string
  variant: VariantSelection
  propValues: Record<PropId, JsonValue | BindingRef>
  slotContent: Record<SlotId, NodeId[]>
  localStyleOverrides?: StyleRef[]
}
```

### Required commands

- create component from selection;
- insert instance;
- edit definition in focus mode;
- set/reset prop;
- add/remove/reorder slot content;
- create/rename/remove variant axis/value;
- detach instance with an explicit loss-of-link warning;
- upgrade instance version;
- run component migration;
- locate all instances/usages;
- publish to or update a library;
- resolve library conflicts.

## 2. Props, slots, variants, and ownership

Each editable value must have one owner:

- **definition content:** global for all instances;
- **prop:** configurable per instance;
- **slot content:** owned by the instance or parent composition;
- **variant:** selects a known configuration axis;
- **local override:** exceptional instance-only style/value, visible as drift.

Ambiguous ownership is the most common cause of surprise. The inspector must state the target before mutation.

## 3. Code component adapter

Webflow Code Components and DevLink document a bridge where external React components become configurable design objects and native components can be exported to code. [WF-092–WF-096, WF-102–WF-105, WF-157]

For SYSTEMX:

```ts
type CodeComponentManifest = {
  package: string
  exportName: string
  sourcePath: string
  framework: 'react'
  propSchema: JsonSchema
  slots: SlotDefinition[]
  previewEntry: string
  serverSafe: boolean
  dependencies: DependencyPolicy[]
  capabilities: string[]
  sourceHash: string
}
```

Required safeguards:

- compile and render in an isolated preview boundary;
- allowlisted packages and versions;
- no implicit secrets/environment access;
- deterministic prop extraction or explicit manifest;
- error boundary and timeout;
- SSR/client-only declaration;
- generated source map and ownership;
- visual and interaction tests;
- upgrade review before changing component schema.

## 4. CMS schema model

Webflow treats CMS as typed Collections, fields, items, references, lists/templates, imports, and limits. [WF-027–WF-035]

```ts
type CollectionSchema = {
  id: CollectionId
  name: string
  slug: string
  providerId: string
  fields: FieldDefinition[]
  indexes: IndexDefinition[]
  workflow: WorkflowDefinition
  localePolicy: LocalePolicy
  accessPolicy: AccessPolicy
  version: number
}
```

Field types should include:

- text, rich text, number, boolean, date/time;
- color, option, URL, email, phone;
- image, multi-image, video, file;
- reference and multi-reference;
- location/structured object when supported by provider;
- computed/read-only fields;
- system fields: ID, slug, created/updated, status, locale, revision.

## 5. Collection items and workflow

```ts
type ContentStatus =
  | 'draft'
  | 'in-review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived'
```

Items require:

- schema validation;
- relationship integrity;
- unique slug and index rules;
- optimistic revision checks;
- locale inheritance/override records;
- author/reviewer/approver history;
- scheduled publication timestamps;
- provider sync status and remote IDs;
- safe import/export reports;
- asset reference validation.

## 6. Query and binding model

Do not embed provider-specific query strings directly in page nodes.

```ts
type QueryContract = {
  collectionId: string
  filters: FilterExpr[]
  sort: SortExpr[]
  limit?: number
  offset?: number
  cursor?: string
  projection?: string[]
  locale?: LocaleExpr
}

type BindingRef = {
  source: 'page' | 'collection-item' | 'query-item' | 'component-prop' |
          'locale' | 'site-setting' | 'runtime-context'
  path: string
  transform?: TransformExpr[]
  fallback?: JsonValue
}
```

Bindings must be statically checked against schemas and previewed with representative fixture records.

## 7. Collection lists and dynamic templates

A collection list is a data-bound repeater, not copied content. It needs:

- query contract;
- empty/loading/error states;
- item template subtree;
- pagination or cursor behavior;
- conditional visibility;
- per-item interaction scoping;
- nested-query limits and performance warnings;
- accessible list semantics;
- server/client rendering policy.

A dynamic page template combines route parameters, one primary item, optional related queries, SEO/schema bindings, locale, and publication state.

## 8. Forms

Webflow's form surface combines visual elements, settings, destinations, submissions, limits, and anti-spam controls. [WF-060, WF-151–WF-152]

LAN should generate a `FormContract`:

```ts
type FormContract = {
  id: string
  fields: FormField[]
  validation: ValidationRule[]
  destinations: SubmissionDestination[]
  success: FormOutcome
  failure: FormOutcome
  retention: RetentionPolicy
  abuseControls: AbuseControl[]
  authRequirement?: string
}
```

Client validation improves UX; server validation is authoritative. Provider destinations must be allowlisted, scoped, testable, and redact sensitive values from logs.

## 9. Ecommerce as an optional domain pack

Webflow Ecommerce adds specialized Collections, products, categories, SKUs/variants, inventory, cart, checkout, payment providers, shipping, tax, orders, and lifecycle emails. [WF-131–WF-134]

SYSTEMX should not hard-wire commerce into the generic document kernel. Add an optional pack:

```text
CMS schemas
  -> product/category/SKU specialization
  -> cart and checkout runtime components
  -> payment/shipping/tax provider adapters
  -> order state machine
  -> inventory and fulfillment events
  -> audit, privacy, and reconciliation reports
```

All payment secrets and live mutations remain server-side and owner-gated. Start with Stripe test mode only when the project enables commerce.

## 10. Acceptance tests

- component definition/instance identity survives moves and source regeneration;
- prop/slot/variant mutations round-trip and undo correctly;
- component upgrade migration is deterministic;
- schema changes produce impact reports before application;
- references reject invalid targets and detect delete impact;
- query/binding validation catches missing fields before preview;
- locale fallbacks are deterministic;
- form server validation matches generated client constraints;
- commerce state changes are idempotent and audit-linked.
