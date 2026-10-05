# 17 — CMS, Component, Binding, Form, and Commerce Implementation Plan

## Objective

Create one provider-neutral content/domain model that can power static content, CMS-driven pages, component props, forms, CRM records, and optional commerce without turning Firebase, SQL Connect, or a specific API into the editor's internal schema.

## Schema service

Responsibilities:

- create/version collections;
- validate field types and constraints;
- build relationship/index impact reports;
- generate TypeScript/JSON Schema types;
- map provider capabilities and limitations;
- produce migration plans;
- validate fixtures/imports;
- expose field/collection usage indexes.

## Provider mapping

| Domain need | Initial provider | Adapter rule |
| --- | --- | --- |
| Draft content and builder metadata | Local document store / Firestore emulator | provider IDs remain adapter metadata |
| Production document content | Firestore | Security Rules and typed converter required |
| Presence/ephemeral coordination | Realtime Database or local memory | never durable audit truth |
| Relational CRM/reporting | SQL Connect / PostgreSQL | explicit schema/query/mutation pack |
| Public media | Cloud Storage for Firebase | asset policy, metadata, transforms, signed access |
| Staff packets/documents | Drive/Shared Drive | operator document lane, not public runtime CMS |
| Archive | GCS or approved local archive | retention and restore manifest |

## Field definition

```ts
type FieldDefinition = {
  id: string
  key: string
  label: string
  type: FieldType
  required: boolean
  localized: boolean
  unique?: boolean
  defaultValue?: JsonValue
  validation?: ValidationRule[]
  reference?: { collectionId: string; cardinality: 'one' | 'many' }
  access?: AccessPolicy
  status: 'active' | 'deprecated'
}
```

Field IDs stay stable when labels/keys change. Deletes are migrations, not array removal.

## Schema migration workflow

1. draft schema change;
2. analyze affected items, bindings, queries, pages, components, indexes, provider rules, exports, and APIs;
3. classify additive, compatible, breaking, destructive;
4. create transformation/backfill plan;
5. run against fixtures/emulator;
6. review sample before/after records;
7. approve and apply with backup;
8. verify counts/integrity;
9. update generated types and source;
10. record migration and rollback/forward-fix plan.

## Binding compiler

A binding compiler resolves editor expressions against context schemas.

```text
page context
  + route parameters
  + primary CMS item
  + collection-list item
  + component props
  + locale/site settings
  + runtime user/session context
  -> typed binding environment
```

It validates paths, transforms, nullability, fallbacks, visibility conditions, and serialization target (text, URL, attribute, image, style, schema markup, embed).

## Binding security

- no arbitrary JavaScript expressions in normal bindings;
- functions come from an allowlisted pure transform registry;
- secrets and restricted fields cannot bind to public output;
- HTML/rich text is sanitized by policy;
- URLs are scheme/domain validated;
- style bindings are type-compatible;
- runtime user fields require auth/access declarations;
- editor preview uses synthetic or approved fixture data, not live restricted records by default.

## Component/CMS integration

Component props can accept:

- literal values;
- CMS bindings;
- page/site/locale values;
- slot content;
- formulas from pure transforms;
- asset references.

Prop schemas determine which binding types are legal. Components declare whether a prop affects structure, style, content, SEO, or runtime behavior.

## Forms and CRM

A form submission pipeline:

```text
browser form
 -> client validation
 -> protected endpoint/function
 -> server schema validation
 -> abuse/rate/consent checks
 -> idempotency
 -> destination adapters
 -> redacted evidence
 -> user outcome
```

Possible destinations: Firestore lead, SQL CRM record, email notification, webhook, Stripe/commerce workflow, third-party connector. The form contract and destination adapters are versioned separately.

## Commerce domain pack

Entities:

- product;
- category/collection;
- option and variant/SKU;
- price/currency;
- inventory location/quantity;
- cart/session;
- customer reference;
- checkout/payment intent reference;
- order/line item;
- fulfillment/shipment;
- tax/shipping policy;
- refund/return event.

The editor only configures schemas, visual components, and provider references. Payment and order writes occur server-side through audited adapters.

## Testing fixtures

- empty/min/max records;
- broken/missing references;
- locale fallbacks;
- large rich text and asset sets;
- unique constraint collisions;
- schema rename/delete migrations;
- pagination/filter/sort combinations;
- unauthorized/restricted fields;
- spam/replay/duplicate form submissions;
- payment webhook retries and out-of-order events.
