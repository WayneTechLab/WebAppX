# Proposed tenant membership contract

Status: **proposed for optional operator-approved adoption**. This document
addresses WX-0503. Source review: **2026-10-15**, using the working source from
integration baseline `aae465ae033f3191a69ed7d40056b0c6e2159e17`.

The proposal defines the membership record an adopted app would require before
granting organization access. It does not provision memberships, change rules,
add revision enforcement, activate an adapter or establish provider access.
The current account-free portals continue to use fictional preview identities.

## Current reference and proposed additions

The [optional Gusto schema inventory](../integrations/gusto/schema.json)
places membership at `organizations/{orgId}/hr_memberships/{uid}`. Its existing
field inventory is `uid`, `orgId`, `status`, `roles`, `personId`,
`gustoEmployeeUuid` and `gustoContractorUuid`. The inventory's top-level
`schemaVersion: 1` describes that inventory document; it is not a membership
revision.

Current [membership checks](../integrations/gusto/functions/src/security.mjs)
require a verified UID, matching UID and organization, `status: "active"`, and
a nonempty array of recognized HR roles. The
[backend](../integrations/gusto/functions/src/backend.mjs) reloads membership
for each implemented operation; the
[Functions adapter](../integrations/gusto/functions/src/index.mjs) reads the
record using the verified UID under the selected organization. The optional
[Firestore rules](../integrations/gusto/firestore.rules) deny browser access to
the membership registry and check membership for their permitted HR reads and
time-off requests. These optional rules are separate from root Firebase setup.

**Membership revision, stale-revision refusal and the administration workflow
below are proposed additions.** Neither the current security helper, rules nor
field inventory implements them. Existing checks also do not enforce every
proposed record-shape constraint below, such as unique stored roles or refusal
of extra membership fields.

## Proposed required record

Each tuple `(orgId, uid)` has one server-managed record. The parent organization
ID is the tenant boundary; an email address, billing customer ID or provider
company UUID cannot replace it. The document key is the verified Firebase UID.

| Required field | Proposed type and constraint | Binding and admission meaning | Current baseline |
| --- | --- | --- | --- |
| `orgId` | String, 1–96 characters, matching `^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$` | Must equal the organization path segment and the organization selected for the operation. Resource ownership is checked in the same organization. It is immutable for this membership. | The security helper validates this identifier and compares membership/request organization. |
| `uid` | String with the same identifier constraint | Must equal the membership document key and the UID supplied by verified server authentication. It is immutable for this membership. Caller-submitted identity cannot substitute for authentication. | The adapter keys the lookup by verified UID; the security helper validates and compares it. |
| `roles` | Array of 1–7 distinct strings from the allowlist below | Grants only the adopted action/resource policy associated with each assigned role. The server assigns roles; the client cannot add or select authority. | The helper requires recognized roles and deduplicates its returned actor; it does not require unique stored entries. |
| `status` | String enum: `active` or `inactive` | Only `active` is eligible for authorization, subject to role/resource checks. `inactive` denies access while retaining the record and its revision history. Missing or other values deny access. | Only `active` passes current membership checks. The existing guide uses `inactive` for revocation. |
| `revision` | Integer from 1 through 9,007,199,254,740,991, without coercion | Monotonic server-owned version of this membership's authority and bindings. Required for proposed concurrency checks. It is distinct from inventory, backup and provider schema versions. | **Absent from the current inventory and enforcement.** |

The proposed role allowlist reuses the current `HR_ROLES` values:
`employer-owner`, `payroll-admin`, `hr-admin`, `manager`, `employee`,
`contractor`, and `auditor`. Role names alone do not grant every HR operation.
Use the [server permission matrix](GUSTO-FIREBASE.md#server-permission-matrix)
and the [portal capability boundary](PORTAL-CAPABILITIES.md) to distinguish
resource-specific policy from visible demo controls. Provider writes and
payroll execution remain disabled in the current reference for every role.

The 96-character identifier limit intentionally matches the current optional
reference helper. An adopter needing other Firebase UID shapes must review and
change both validation and its evidence before using those identities.

Optional `personId`, `gustoEmployeeUuid` and `gustoContractorUuid` remain
server-owned mappings with the same identifier constraint when present. The
proposed canonical record omits an absent mapping. A `personId` must resolve to
an application person in the same organization. A provider mapping additionally
requires an independently accepted company and resource-ownership binding;
knowing an email address or UUID is insufficient. An unmapped user may have
only the actions their assigned role permits without that mapping. Self-service
actions requiring a person/provider binding must deny when it is absent.

For this proposed membership payload, only the five required fields and the
three named optional mappings are accepted. Audit metadata belongs in a
separate protected audit record. Do not put account tiers, secret values, tax
answers, bank data or provider tokens in membership records. The schema
inventory's existing [classification boundaries](GUSTO-FIREBASE.md#data-model-and-source-of-truth)
remain applicable.

This fictional example illustrates the proposed shape, including the new field:

```json
{
  "orgId": "example-org",
  "uid": "uid-example",
  "roles": ["employee"],
  "status": "active",
  "revision": 2,
  "personId": "person-example"
}
```

## Proposed revision and concurrency behavior

A separately adopted membership administration service creates a record at
revision **1**. Initially inactive intake is appropriate until its tenant,
verified user, role assignment and optional mappings are accepted. Activation
is an authority change and advances the revision.

Every accepted change to roles, status or person/provider mappings increments
the existing revision by exactly one in the same transaction as that change.
A request with identical accepted authority and mappings is a no-op and keeps
the revision. Reaching the maximum integer refuses another change and requires
a reviewed migration; it never wraps, truncates or resets the number. Moving a
user to another tenant creates that separate tenant's membership after
independent review. It cannot rewrite this record's UID or organization.

The proposed administration request carries an `expectedMembershipRevision`.
The server reads the authoritative membership inside its transaction, compares
that value with the stored integer, and refuses a mismatch or missing/invalid
revision before mutation. Two changes based on revision 2 cannot both become
revision 3. After one commits, the other must reload, re-evaluate the requested
change and receive a deliberate retry decision. A database transaction retry
must retain this comparison rather than silently rebase the operator's intent.

Proposed business operations likewise bind their authorization decision to the
current membership revision. Database mutations read membership, status,
roles, required mappings and affected resources in the same transaction and
refuse stale or inactive authority. Long-running work and queued jobs must
revalidate immediately before each consequential step; a previously admitted
request or cached token is insufficient after revocation. A provider request
cannot share an atomic transaction with a local membership update: an adopted
adapter must separately define dispatch, idempotency, revocation and partial
operation recovery. This proposal supplies no such external execution guarantee.

Revocation changes the server record to `inactive` and advances the revision.
Reactivation or relinking requires reviewed authority and another increment.
Keep a protected tombstone/history if the adopted retention policy permits
record removal, so deleting and recreating the same membership cannot reuse an
old revision. No hard-delete/recreate shortcut is part of this proposal.

## Proposed identity allowed to advance the revision

Only a trusted server membership-administration service may write the record
or advance its revision. The adopter must name that service identity, its
organization scope and its authorization policy before enabling it. Each
change must record the separately authenticated requesting operator, the
reviewed organization authority, the old/new revision and a redacted reason in
the protected audit trail. The execution service identity and human approving
authority are separate facts.

The service must establish an existing operator's membership-administration
authority, or a separately approved initial-tenant bootstrap authority. A
global staff claim, account tier, browser role selector, possession of a
Firebase Admin credential or the role label `employer-owner` alone does not
define this administration policy. Current code exposes no accepted membership
administration endpoint. Admin SDK access bypasses client rules, so the adopted
service must enforce the proposed policy itself.

## Account tier and organization membership

| Fact | Purpose | HR organization authority |
| --- | --- | --- |
| Account tier, subscription or billing entitlement | Product packaging and account presentation | Supplies no tenant membership, role, person binding or provider scope. |
| Global `admin: true` or staff claim | An adopted app may use it for its separately defined account operations | Supplies no HR membership or automatic access to another organization's records. |
| Native preview role/employee selection | Changes fictional demo controls and projections | Supplies no authenticated backend or provider authority. |
| Verified UID plus active server-managed membership | Identifies the user within one organization | Still requires the relevant role, resource ownership and accepted mappings for each action. |

The existing [Gusto identity guide](GUSTO-FIREBASE.md#canonical-organization-and-person-identities)
and [backend tests](../tests/hr/gusto-backend.test.mjs) already cover missing
identity/membership, wrong UID/organization, inactive status and unknown-role
denials despite account-level `level: 5` or `admin: true` data. Those authored
checks support the current boundary; they do not test the proposed revision
workflow.

Before optional adoption, the operator must accept the record/migration policy,
identify the administration service and approving authority, implement the
transaction/revocation behavior, and retain adopted allow/deny and concurrent
change evidence. Deploying rules, provisioning identities or accepting real
provider access requires its own selected target and authorization. This local
contract review leaves those adoption steps unperformed.
