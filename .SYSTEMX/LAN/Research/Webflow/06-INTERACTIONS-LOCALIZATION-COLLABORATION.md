# 06 — Interactions, Localization, Collaboration, and Insight Modes

## 1. Interaction graph

Webflow's GSAP-based interaction system documents actions, timelines, triggers, targets, variable animation, management, and FOUC prevention. [WF-036–WF-042]

Represent motion as data:

```ts
type InteractionDefinition = {
  id: InteractionId
  name: string
  trigger: TriggerDefinition
  target: TargetSelector
  timeline: TimelineStep[]
  playback: {
    loop?: boolean
    reverseOnExit?: boolean
    initialStatePolicy?: 'apply-before-paint' | 'none'
  }
  reducedMotion: ReducedMotionPolicy
}
```

Timeline steps can include parallel groups, delays, keyframes, easing, transforms, opacity, filters, dimensions, variables, class/state changes, and named actions. Scripts are an advanced escape hatch, not the normal motion model.

## 2. Target resolution

Targets can be:

- selected node;
- child/descendant with a stable relationship selector;
- class/style usage;
- component instance or slot;
- collection item scope;
- page/site event target;
- runtime data selector.

The editor must preview the resolved target set and warn if an interaction becomes ambiguous after structure changes.

## 3. Reduced motion and accessibility

Every interaction should declare one of:

- skip;
- simplify;
- reduce distance/duration;
- use an alternate timeline;
- essential and justified.

Preview must support `prefers-reduced-motion`. Keyboard and screen-reader behavior cannot depend on animation completing.

## 4. Localization model

Webflow's localization surface covers locales, content/style overrides, switchers, language codes, and locale-specific access. [WF-043–WF-047]

Recommended records:

```ts
type LocaleRecord = {
  id: string
  tag: string
  displayName: string
  direction: 'ltr' | 'rtl'
  fallbackLocaleId?: string
  subdirectory?: string
  domain?: string
  publishingEnabled: boolean
}

type LocalizedOverride = {
  objectId: string
  fieldPath: string
  localeId: string
  value: JsonValue
  inheritedFrom?: string
}
```

Do not clone entire page trees for each locale. Store sparse overrides over a primary structure unless a page is explicitly forked.

## 5. Locale-aware surfaces

Localization affects:

- static and CMS content;
- asset alt text and captions;
- slugs and route generation;
- page title/meta/schema;
- component prop values;
- variable/style modes where permitted;
- custom code and tracking configuration;
- search indexes;
- redirects/domains;
- publication and access.

The editor needs a visible locale context and inheritance indicators so a user never unknowingly edits the primary locale.

## 6. Collaboration primitives

Webflow's roles, comments, branching, activity log, backups, and content-editor interface show distinct collaboration layers. [WF-048–WF-051, WF-138–WF-139]

### Comments

```ts
type CommentThread = {
  id: string
  anchor: ObjectAnchor
  pageRevision: number
  status: 'open' | 'resolved'
  messages: CommentMessage[]
}
```

Anchors use stable object IDs plus optional source/canvas coordinates. When an object moves, the thread remains attached; when deleted, the thread becomes orphaned with recovery context.

### Page branches

A page branch can be implemented first as:

- base document revision;
- branch command journal;
- branch-derived document projection;
- semantic diff;
- validation result;
- merge transaction or rejection.

Do not begin with full-site CRDT collaboration. Page-scoped journals are a smaller, reviewable first step.

### Activity

Audit events should record actor, capability, command, object IDs, status, revision before/after, evidence links, and redacted provider target—not raw secrets or giant source dumps.

## 7. Presence and concurrent editing

Reserve a presence channel separate from durable audit truth:

```ts
type PresenceState = {
  sessionId: string
  userId: string
  pageId: string
  selection?: NodeRef[]
  mode: string
  lastSeenAt: string
}
```

Presence may use memory or Realtime Database; it is ephemeral. Durable commands remain in the journal. For G1 concurrent writes, use optimistic revision checks and object locks before adopting CRDT/OT.

## 8. Content editor projection

A content editor should receive:

- allowed pages and Collections;
- editable node fields and component props;
- asset picker;
- CMS item workflow;
- comments;
- preview and optional publish request;
- no structural, style, source, provider, or shell authority.

This is a projection over the same document, not a second CMS application.

## 9. Analyze and Optimize overlays

Webflow Analyze and Optimize place page metrics, clickmaps, folds, scroll depth, variations, goals, audiences, and results into the authoring environment. [WF-140–WF-143]

Reserve a read-only overlay contract:

```ts
type InsightOverlay = {
  pageId: string
  snapshotId: string
  dateRange: DateRange
  segment?: SegmentExpr
  metricsByNodeId: Record<NodeId, MetricSet>
  pageMetrics: MetricSet
}
```

Analytics IDs must survive source generation and publication without exposing editor metadata. Use a separate safe runtime identifier, mapped back to node IDs through the publish manifest.

Experiments should produce variation definitions and publish snapshots, not mutate production source invisibly.

## 10. AI participation

Webflow documents workspace/role control over AI features. [WF-144]

SYSTEMX AI should operate through proposals:

```text
agent request -> context query -> proposed commands -> preview/diff
              -> policy checks -> operator accept/reject -> journal
```

AI may draft content, layouts, schemas, fixes, or interactions. It does not receive generic filesystem, shell, provider, or publish authority from the Designer.
