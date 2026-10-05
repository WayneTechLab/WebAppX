# 14 — Editor Kernel, Command Model, Transactions, Undo, and Evidence

## 1. Command envelope

```ts
type DesignerCommand<T extends JsonValue = JsonValue> = {
  schemaVersion: 1
  commandId: string
  commandType: string
  issuedAt: string
  actor: {
    userId: string
    sessionId: string
    roleIds: string[]
    missionId?: string
    waveId?: string
  }
  context: {
    documentId: string
    expectedRevision: number
    pageId?: string
    localeId?: string
    breakpointId?: string
    environment: 'local' | 'emulator' | 'staging' | 'production'
  }
  targets: ObjectRef[]
  payload: T
  approval?: ApprovalReference
  idempotencyKey: string
}
```

## 2. Handler lifecycle

```text
parse
 -> schema validate
 -> session and origin validate
 -> capability authorize
 -> target/revision validate
 -> domain invariant validate
 -> build change plan
 -> calculate impact and risk
 -> require/verify approval when needed
 -> begin transaction
 -> apply domain changes
 -> update indexes
 -> plan/apply source or provider effects
 -> verify effects
 -> commit revision
 -> append journal/evidence
 -> publish UI event
```

A failure before commit produces no document mutation. External side effects require idempotency and compensating/rollback behavior.

## 3. Command categories

### Document

- create/rename/archive document;
- change site settings;
- migrate schema.

### Pages

- create/duplicate/move/delete page;
- update route/settings/layout/access/status;
- create locale override.

### Nodes

- insert/move/wrap/unwrap/duplicate/delete;
- set semantic tag/name/props;
- set conditional/binding;
- convert element type;
- create component from selection.

### Styles and variables

- create/rename/delete selector/style;
- set/remove declaration;
- set state/breakpoint declaration;
- create/rename/delete variable;
- set mode value/alias;
- migrate usages.

### Components

- create/update definition;
- set prop/slot/variant;
- insert/detach/upgrade instance;
- publish/update library.

### CMS/forms/interactions

- change schema/item/query/binding;
- change form contract;
- change trigger/timeline;
- locale operations.

### Source/provider/release

- import/refresh mapping;
- plan/apply source changes;
- create preview snapshot;
- run gates;
- create release candidate;
- publish/restore.

## 4. Transactions

A transaction groups related commands atomically. Examples:

- inserting a card creates nodes, styles, tokens, and a component instance;
- renaming a variable updates usages and generated source;
- changing a route creates redirects and updates links;
- deleting a CMS field migrates or blocks bindings;
- publishing creates a snapshot, manifests, and gate evidence.

```ts
type TransactionRecord = {
  transactionId: string
  baseRevision: number
  committedRevision: number
  commandIds: string[]
  objectChanges: ObjectChange[]
  sourceChangePlan?: SourceChangePlan
  externalEffects?: ExternalEffectRecord[]
  inverse: InversePlan | RestoreReference
}
```

## 5. Undo and redo

### Preferred strategy

- domain commands implement inverse commands when safe;
- complex or external commands use restore references/compensating commands;
- undo creates a new transaction; it does not delete journal history;
- redo re-applies only if preconditions remain valid;
- UI shows why an operation cannot be undone.

Examples:

- `SetNodeText` inverse stores prior structured text value;
- `MoveNode` inverse stores prior parent/index;
- `DeleteNode` inverse stores a serialized subtree/reference snapshot;
- `PublishRelease` is not undone by deleting history; use a restore/rollback release.

## 6. Semantic diff

A useful diff reports meaning:

```text
Page /pricing
- route changed from /plans to /pricing
- redirect /plans -> /pricing will be created
- 4 internal links updated
- SEO canonical changed

Component Button
- added variant axis size: sm | md | lg
- 19 instances default to md
- 2 instances need review because of local padding overrides
```

Source line diffs remain available as evidence but are not the primary review format.

## 7. Journal

Append one sanitized event per state transition:

```json
{
  "eventType": "command.committed",
  "commandId": "cmd_...",
  "transactionId": "txn_...",
  "documentId": "doc_...",
  "revisionBefore": 41,
  "revisionAfter": 42,
  "actorId": "user_...",
  "commandType": "node.move",
  "targets": ["node_..."],
  "evidence": ["evidence/txn_.../report.json"],
  "createdAt": "..."
}
```

Do not log source contents, secret values, raw form submissions, or provider tokens.

## 8. Approval tokens

High-risk approval is bound to:

- command/transaction plan hash;
- actor and role;
- document revision;
- provider/environment target;
- diff and gate report hashes;
- expiry and one-time nonce.

Changing the plan invalidates approval.

## 9. Query projections

The kernel publishes events; query projections update:

- Navigator tree;
- inspector state;
- command history;
- source map;
- style trace;
- diagnostics;
- component/CMS usage;
- release status.

The UI does not manually synchronize five independent copies of the same object.

## 10. Required invariants

- no cycles in node tree, variable aliases, component dependencies, or locale fallback;
- page routes unique per locale/environment policy;
- nodes have exactly one structural parent except roots;
- component instances reference compatible definitions/versions;
- bindings type-check;
- source-owned objects cannot be structurally written by unsupported adapters;
- every committed revision can be replayed or restored;
- every external effect is linked to an idempotency key and evidence.
