# 26 — Core Data Objects and Event Catalog

## Core objects

| Object | Stable identity | Key relationships |
| --- | --- | --- |
| Workspace | workspaceId | users, sites, entitlements, libraries |
| Site | siteId | documents, environments, domains, providers |
| DesignerDocument | documentId + revision | pages, nodes, styles, components, CMS |
| Page | pageId | root node, route, layout, locales, SEO |
| Node | nodeId | parent/children, styles, bindings, component, interactions |
| Style | styleId | selectors, declarations, usages, source spans |
| Variable | variableId | collection, modes, aliases, usages |
| ComponentDefinition | componentId + version | root node, props, slots, variants, dependencies |
| ComponentInstance | nodeId | definition/version, props, slots, overrides |
| CollectionSchema | collectionId + version | fields, indexes, items, bindings |
| CollectionItem | itemId + revision | schema, locale, status, references |
| Query | queryId | collection, filter/sort/page/projection |
| Binding | bindingId | target object/property, source path, transform |
| Asset | assetId | provider, file hash, metadata, usages |
| Interaction | interactionId | trigger, target, timeline |
| Locale | localeId | fallback, routes/domains, overrides |
| CommentThread | threadId | object anchor, messages, status |
| Branch | branchId | base revision, command journal, review state |
| Snapshot | snapshotId | document/source/toolchain/build hashes |
| Release | releaseId | snapshot, environment, target, approvals, rollback |
| Plugin | pluginId + version | manifest, capabilities, integrity |
| EvidenceArtifact | evidenceId | command/transaction/release, path/hash/type |

## Domain events

### Document and page

- `document.created`
- `document.migrated`
- `page.created`
- `page.route_changed`
- `page.archived`

### Nodes/styles/components

- `node.inserted`
- `node.moved`
- `node.deleted`
- `style.declaration_changed`
- `variable.value_changed`
- `component.definition_changed`
- `component.instance_upgraded`

### CMS/forms/assets

- `collection.schema_changed`
- `collection.item_changed`
- `binding.changed`
- `form.contract_changed`
- `form.submission_received` (redacted metadata only)
- `asset.added`
- `asset.replaced`

### Interaction/localization

- `interaction.changed`
- `locale.created`
- `locale.override_changed`

### Source and provider

- `source.import_completed`
- `source.plan_created`
- `source.apply_completed`
- `source.apply_failed`
- `provider.preflight_completed`
- `provider.operation_completed`

### Collaboration/release

- `comment.created`
- `branch.created`
- `branch.merge_conflict`
- `branch.merged`
- `snapshot.created`
- `gate.completed`
- `approval.granted`
- `release.published`
- `release.rolled_back`

## Event requirements

Each durable event includes:

- event and schema version;
- event ID/time;
- actor/session/mission/wave;
- command/transaction ID;
- document revision before/after;
- object references;
- risk and status;
- redacted summary;
- evidence references;
- causation/correlation IDs;
- integrity checkpoint field where enabled.

Events are facts after commit. Proposed commands and validation failures are recorded as operation evidence but do not masquerade as committed domain events.
