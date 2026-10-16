# Proposed webhook retention adoption — WX-0617

Prepared 2026-10-15. **Artifact design reviewed; disabled and unadopted.** Agent 0 reviewed this proposed policy after independent source/artifact review. No catalog acceptance, Hosting/configuration change, collection, receiver, rule, secret or provider setup is recorded. Historical source basis supplied by Agent 0: `42818dd7baf3d335f27c401c37d048bd842617fa`; original fingerprints are preserved in the [source-review record](evidence/adoption-contract-source-review.json). References to original drafting or proposed implementation below preserve that observation scope. A later source re-review after the CRM integration freeze is pending. See the [adoption index](ADOPTION-CONTRACTS.md).

## Original criterion and mapping

**WX-0617** — P1 / security / production-readiness / operator; source `integrations/gusto/functions/src/webhooks.mjs`; no dependencies; the original draft recorded TODO; current status comes from the [canonical catalog](backlog/webappx-1000-todo.json).

> For optional operator-approved adoption: An adoption design bounds stored webhook payload duration, redacts unnecessary provider fields and requires operator selection before collection.

| Criterion part | Proposed evidence in this artifact |
| --- | --- |
| Bound stored payload duration | Raw-body persistence prohibited; finite envelope, dedup and audit expiry/deletion rules below |
| Redact unnecessary fields | Exact persisted allowlist, excluded-field examples and sanitation fixtures |
| Operator selection before collection | Disabled configuration and mandatory scope/owner/policy selection gate |

## Examined foundation

`webhooks.mjs:4–14` bounds the request body to 262,144 bytes and checks a hex SHA256 HMAC mock contract. Lines 17–38 validate the company/event and return a small envelope/body hash, rather than returning the raw provider body. Lines 42–51 transact inbox creation and duplicate checks. `index.mjs:66–88` additionally gates mode, approved/verified flags and a trusted company mapping, then writes `organizations/{orgId}/hr_webhook_inbox/{eventId}`. Its accepted inbox is a queue, with no reconciliation worker activated by this proposal.

The source's four-day event admission window is **not stored-data TTL**. Gusto's current [webhook guide](https://docs.gusto.com/embedded-payroll/docs/webhooks) describes signature verification and delivery retries over three days; it supplies no retention mandate adopted here. Hex wire representation still needs the source's separately required authorized evidence. This draft does not resolve that provider gate.

## Proposed selection gate

The following is an inert design shape, not a real environment/configuration file:

```json
{
  "enabled": false,
  "orgId": null,
  "environment": null,
  "providerCompanyId": null,
  "acceptedEventTypes": [],
  "policyVersion": null,
  "retentionProfile": null,
  "collectionOwner": null,
  "deletionMonitorOwner": null,
  "approvalReference": null
}
```

An adopted receiver must refuse collection before its first inbox read/write unless every selection is valid, mutually consistent, active and independently reviewed for that exact organization/environment. A preexisting `GUSTO_WEBHOOK_APPROVED=true` alone would not satisfy this new retention gate. Unknown event types, absent deletion capability or an unreviewed policy version fail closed. No browser-supplied tenant, role, company, retention duration or approval value can select policy. Native mocks remain account-free and independent.

## Proposed finite profile for root review

These numbers are **product policy recommendations**, not provider or legal requirements. Agent 0 reviewed them for this artifact design; downstream implementation and operators still require an explicit selected profile before collecting.

| Data | Proposed bound and use |
| --- | --- |
| Raw bytes, parsed unprojected payload, signatures and verification secret | **Zero persisted duration.** Used only during one bounded verification/projection request; never placed in application logs, failed-message stores, inbox or retry jobs. Process/runtime capture settings also need review. |
| Minimal inbox envelope | Logically expires at `receivedAt + 7 days`, regardless of pending/succeeded/failed reconciliation state. No retry or duplicate extends it. |
| Compact dedup tombstone | May replace a completed envelope early; retains only policy version, organization/event keyed digest, body digest and original expiry. No second retention clock. Same seven-day logical expiry. |
| Redacted processing audit | Fixed action/result categories, policy version, coarse timestamp and pseudonymous event reference; same seven-day logical expiry. No raw error/provider response. |
| Physical deletion | Proposed target within 24 hours of logical expiry; proposed maximum stored envelope/tombstone/audit age **8 days**. A breach is a retention incident, never reported as successful deletion. |

All reads, reconciliations and duplicate decisions must enforce logical expiry themselves. Firestore [TTL deletion is asynchronous](https://firebase.google.com/docs/firestore/ttl), and deleting a document does not delete its subcollections. A future design therefore needs an owned deletion worker/monitor and exact collection inventory; TTL can assist but cannot alone prove the physical deadline. Before the eight-day bound, an unhealthy cleanup monitor disables new collection and notifies the selected operator. Existing over-bound data still requires approved removal and a recorded incident; disabling collection does not repair it.

No indefinite legal hold or retry extension is implicit. If a downstream obligation requires a different retained business record, select a separately reviewed bounded record/purpose and access policy before collection. Do not preserve raw webhooks by relabeling them audit. Reconciliation alerts on unresolved events at 24 hours; at expiry it stops and hands off a redacted failure category. Authorized later reconciliation must fetch current accepted resources through its own scope, rather than replaying an expired body. No fetch is performed here.

The seven-day dedup horizon exceeds the current source's four-day admission horizon. After tombstone deletion, the unchanged old timestamp is outside that admission horizon. A changed timestamp/body reusing an old ID would require the separately adopted provider event-identity contract; this draft does not claim indefinite replay proof after deletion.

## Persisted field policy

Allowed projected envelope fields only: `orgId`, `eventId`, `bodyHash`, `companyUuid`, `entityUuid`, allowlisted `entityType`, allowlisted `eventType`, `occurredAtSeconds`, `receivedAtSeconds`, finite reconciliation `state`, bounded `attempts`, `policyVersion`, `expiresAtSeconds`. IDs and hashes remain sensitive pseudonymous metadata, not anonymous data. Initial attempts is zero; retries are bounded to eight and never exceed expiry. An unknown entity type is refused or omitted by the selected event schema, not copied as arbitrary text.

Exclude names, addresses, emails, phone numbers, SSNs/EINs, birth dates, banking, wages, benefits, tax data, entire nested resources, request headers, authorization/state/cookie values, verification tokens, raw signatures, query strings and arbitrary provider error strings. Derive a small result category instead of truncating an error body. Existing `entityType` slicing is not sufficient to establish this stronger allowlist; any future implementation must change the projection under separate authorization.

### Literal fictional projection fixture

```json
{
  "verifiedInput": {
    "orgId": "org-fiction-a",
    "eventId": "event-fiction-001",
    "bodyHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "companyUuid": "company-fiction-a",
    "entityUuid": "person-fiction-001",
    "entityType": "Employee",
    "eventType": "employee.updated",
    "occurredAtSeconds": 1792065600,
    "receivedAtSeconds": 1792065600,
    "unneeded": { "workEmail": "person@example.test", "ssn": "FICTIONAL-DO-NOT-PERSIST" }
  },
  "expectedStored": {
    "orgId": "org-fiction-a",
    "eventId": "event-fiction-001",
    "bodyHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "companyUuid": "company-fiction-a",
    "entityUuid": "person-fiction-001",
    "entityType": "Employee",
    "eventType": "employee.updated",
    "occurredAtSeconds": 1792065600,
    "receivedAtSeconds": 1792065600,
    "state": "pending-reconciliation",
    "attempts": 0,
    "policyVersion": "fictional-retention-v1",
    "expiresAtSeconds": 1792670400
  }
}
```

The all-`a` digest is an explicit policy-layer fixture, **not a claim about a computed or verified provider body**. The fixture begins after an independently stubbed verification boundary. `employee.updated` is a fictional selected schema example; provider subscription support remains unselected.

## Required allow/deny test contract

Tests must compare complete projected records and logs, not only status strings. Tests below are specified, not run.

| ID | Literal variation | Expected outcome |
| --- | --- | --- |
| WR-01 | All default selections above | `not-configured`; zero inbox/audit writes, zero raw capture |
| WR-02 | Selected fictional profile, active `org-fiction-a` / `company-fiction-a`, verified input above | Create exactly `expectedStored`; forbidden markers absent from all persistence/log sinks |
| WR-03 | Body company `company-fiction-b` or URL tenant `org-fiction-b` | Refuse before inbox access; no cross-tenant lookup or payload log |
| WR-04 | Invalid HMAC, oversize body, unknown event or unreviewed policy version | Refuse; no body/dead-letter persistence |
| WR-05 | Same event ID and digest at +60 seconds | Duplicate; original record and expiry unchanged; no second reconciliation job |
| WR-06 | Same ID, digest ending `b` | Conflict; original byte record unchanged |
| WR-07 | Read at `1792670400`, record still physically present | Expired; no reconciliation/read DTO, no deadline extension |
| WR-08 | Cleanup confirms deletion before `1792756800` | Envelope/tombstone/audit absent; retain only separately approved aggregate count, if selected |
| WR-09 | Physical record still exists at `1792756800` | Retention breach; collection disabled and selected operator alerted, with no false deletion receipt |
| WR-10 | Pending reconciliation reaches expiry or retry 8 | Stop retry; redacted terminal category; original expiry retained |
| WR-11 | Duplicate, failure or server restart attempts to set a fresh received time | Refuse refresh of retention clocks; original timing remains authoritative |
| WR-12 | New raw field, secret-like payload or unsafe entity type | Projection drops/refuses it; complete stores and diagnostics contain no marker |

## Adoption exit conditions

Agent 0 has reviewed this artifact scope, timing and projection policy; that review enables no collection. A downstream operator separately names organization/environment, approved event schemas, collection/deletion owners and evidence destination. Future implementation needs exact concurrency, expiry, cleanup outage, privacy/logging and bounded deletion tests on an authorized owned fixture before collection is enabled. Provider signature/identity evidence, actual subscription, reconciliation authorization and production deployment retain their separate gates. No such selection or operation occurred in preparing this draft.
