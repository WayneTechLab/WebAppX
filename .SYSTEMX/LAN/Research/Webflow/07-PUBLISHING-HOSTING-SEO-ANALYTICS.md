# 07 — Publishing, Hosting, SEO/AEO, Search, Forms, Analytics, and Operations

## 1. Draft is not deployment

Webflow's backups, staging, publishing, advanced publishing, custom staging domains, and domain workflows demonstrate separate lifecycle controls. [WF-051–WF-058]

SYSTEMX should formalize:

| State | Artifact | Mutable? | Public? |
| --- | --- | ---: | ---: |
| Working document | document + command journal | yes | no |
| Preview snapshot | resolved document + generated source/build | no | loopback/emulator |
| Review snapshot | preview + semantic diff + findings | no | approved reviewers |
| Staging release | signed/hashed artifact manifest | no | restricted or staging |
| Production release | immutable release record | no | yes |
| Backup/restore point | document/source/provider references | no | no |

## 2. Publish manifest

```ts
type PublishManifest = {
  schemaVersion: number
  releaseId: string
  sourceCommit: string
  documentRevision: number
  environment: string
  generatedAt: string
  builderVersion: string
  target: ProviderTarget
  artifacts: ArtifactHash[]
  routeManifest: RouteRecord[]
  assetManifest: AssetRecord[]
  migrationIds: string[]
  gateResults: GateResult[]
  rollback: RollbackReference
  approvals: ApprovalRecord[]
}
```

A publish command can only reference an immutable preview snapshot that passed policy. Rebuilding the same snapshot under the same toolchain should produce equivalent artifacts or an explained nondeterminism report.

## 3. Environment and target safety

Every provider operation must display and record:

- local/emulator/staging/production mode;
- authenticated identity or redacted account reference;
- project/site/domain target;
- selected source commit and document revision;
- dirty-tree state;
- exact generated invocation or API action;
- required capabilities;
- dry-run/preflight output;
- rollback information.

The LAN browser can request preflight or create a release candidate. Production deployment remains controlled by `.SYSTEMX/scripts/deploy.sh` or a future shared release service with equivalent friction.

## 4. Backups and restore

Backups need more than copied source files:

- document snapshot;
- command journal range;
- source commit/diff;
- generated artifacts and hashes;
- CMS schema/item export references;
- provider configuration metadata without secrets;
- release manifest;
- restore compatibility/migration report.

Restore should generate a new command/release event; it should never erase history.

## 5. Pages, routing, redirects, and domains

Page records include:

- path and folder;
- static/dynamic/utility type;
- layout/outlet;
- locale path/domain policy;
- canonical URL;
- access policy;
- draft/publish state;
- SEO/AEO metadata;
- redirects and previous slugs;
- search/indexing policy.

Before changing a path, show impacted links, CMS references, locale routes, redirects, canonical tags, and analytics continuity.

## 6. SEO and AEO

Webflow supports page titles/descriptions, structured schema, audits/health scans, and publishing-driven activation. [WF-145–WF-147]

LAN should validate:

- unique titles and descriptions;
- canonical/robots/indexing;
- social metadata;
- sitemap and route inclusion;
- heading structure;
- alt text and link text;
- structured data against schema rules;
- locale-specific metadata;
- dynamic field availability;
- redirects and broken internal links;
- performance budgets.

AI-generated metadata or schema remains a proposal and must pass validation.

## 7. Site search

Webflow site search demonstrates that search is a published-site service with locale, inclusion/exclusion, and indexing rules. [WF-148]

SYSTEMX should define a `SearchManifest` that can target:

- generated client index for small static sites;
- Firestore/SQL search adapter;
- third-party hosted search;
- provider-native search.

Index generation consumes publish snapshots, not the mutable canvas. Each page/node/field has explicit indexability and sensitivity policy.

## 8. Forms and submissions

Form publication must generate:

- accessible markup;
- client and server validators;
- CSRF/origin strategy where applicable;
- anti-spam policy;
- destination adapters;
- success/failure behavior;
- retention and deletion rules;
- redaction in logs;
- consent/privacy notices;
- rate limits and abuse telemetry.

Never treat a visual form as complete because it renders.

## 9. Analyze and Optimize operations

Analytics and experiments should be enabled per environment with consent and data classification. Runtime code must obey the published consent choice and must not expose editor capabilities. [WF-087–WF-091, WF-140–WF-143]

Required records:

- analytics provider configuration names, not secrets;
- event schema and stable element mapping;
- consent categories;
- experiment hypothesis, variation snapshots, goals, segments, start/end;
- results source, confidence assumptions, and decision log;
- rollback/stop controls.

## 10. Operational evidence

A release is complete only when the system records:

- source/document revisions;
- quality, accessibility, security, performance, and provider preflights;
- target and approval;
- deployment result;
- post-deploy smoke evidence;
- monitoring links;
- rollback procedure;
- unresolved accepted risks with owner and expiry.
