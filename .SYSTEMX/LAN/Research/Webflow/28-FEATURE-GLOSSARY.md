# 28 — Webflow and LAN Feature Glossary

| Term | Meaning in this plan |
| --- | --- |
| Add panel | Searchable catalog of insertable elements, components, sections, and domain modules |
| Navigator | Hierarchical projection of the canonical document graph |
| Canvas | Rendered interactive projection used for selection, direct manipulation, and previews |
| Inspector | Contextual settings/style/binding/interaction/source projection for selection |
| Breakpoint | Ordered media/container context that participates in style inheritance and overrides |
| Selector | Parsed style targeting identity with specificity and state semantics |
| Style rule | Declarations attached to selector + breakpoint + state + order/layer |
| Variable/token | Typed reusable value that may alias another value and vary by mode |
| Mode | Named value context such as theme or brand, distinct from editor mode/breakpoint |
| Component definition | Reusable node graph plus props, slots, variants, version, and dependencies |
| Component instance | Node referencing a definition/version with prop, slot, variant, and override values |
| Prop | Typed instance-configurable value |
| Slot | Declared location accepting instance-owned child content |
| Variant | Named selection across one or more component axes |
| Library | Versioned reusable component/token package with ownership and update rules |
| Collection | Versioned CMS schema |
| Collection item | Revisioned record conforming to a Collection schema |
| Reference | Typed relationship from one item to another collection/item |
| Collection list | Query-driven repeated template subtree |
| Binding | Typed reference from node/property/metadata to a data context path |
| Interaction | Trigger/target/timeline definition that generates runtime behavior |
| Locale override | Sparse locale-specific value over primary structure/content/settings |
| Comment anchor | Stable object/source/selection reference used by a review thread |
| Page branch | Page-scoped command journal based on a known document revision |
| Activity log | Durable redacted record of commands, reviews, releases, and provider effects |
| Preview snapshot | Immutable document/source/toolchain/build state for review |
| Publish manifest | Release record with hashes, target, routes, gates, approvals, and rollback |
| Designer API | Typed authoring object API; LAN equivalent is the query/command kernel surface |
| Data API | Authenticated remote resource API; LAN equivalent is scoped provider adapters |
| Browser API | Published-runtime API separated from editor authority |
| Code component | External React component registered through a governed visual manifest |
| DevLink | Design/code interoperability workflow; LAN equivalent is source/component adapters |
| Plugin | Sandboxed extension with manifest and capabilities |
| MCP client | AI/tool client using structured queries and approved command proposals |
| Source-owned | Existing source remains truth; LAN writes only through supported semantic adapter |
| Generated-owned | LAN document is truth for designated generated artifacts |
| Hybrid controlled | Ownership is explicit per object and ambiguous round trips are blocked |
| Command | Versioned typed mutation request |
| Transaction | Atomic group of validated commands/effects producing one document revision |
| Journal | Append-only command/event record used for replay, audit, undo/redo, and branches |
| Semantic diff | Object-level explanation of meaning, separate from text line diff |
| Evidence | Sanitized report/artifact proving what was planned, checked, changed, and verified |
| Capability | Server-enforced permission to query or execute a bounded operation in a scope |
| Entitlement | Commercial/configuration grant of a capability or quota; not authorization by itself |
