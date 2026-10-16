# Proposed attachment download authorization — WX-0627

Prepared 2026-10-15. **V2 artifact design reviewed; adoption unselected and disabled.** Agent 0 reviewed the amended policy after independent source/artifact recheck. The reviewed v2 specifies a shared atomic authority/consumption fence and its race outcomes. Original v1 draft hashes and historical supplied source basis `42818dd7baf3d335f27c401c37d048bd842617fa` remain in the [source-review record](evidence/adoption-contract-source-review.json); its later catalog-metadata observation is separately qualified. The original pending-review wording is drafting history. This specifies future tests and records no protocol execution, provider setup or canonical acceptance. A later source re-review after the CRM integration freeze is pending. See the [adoption index](ADOPTION-CONTRACTS.md).

## Original criterion and mapping

**WX-0627** — P1 / security / production-readiness / operator; source `storage.rules`; no dependencies; the original draft recorded TODO; current status comes from the [canonical catalog](backlog/webappx-1000-todo.json).

> For optional operator-approved adoption: A future attachment design binds each download to tenant, resource and expiry rather than trusting a displayed URL or demo role.

Tenant, authenticated actor, resource/version, action and expiry are bound in one server record below. Literal wrong-tenant/resource/expiry/replay/URL-only cases define refusal. The operator must select a real attachment class, storage mapping and enforcing backend before any issuance.

## Current boundary

`storage.rules:11–20` currently protects per-user upload paths by UID/admin claims and private admin paths by admin claims; line 24 defaults other paths to deny. It supplies no new tenant/resource/expiry contract. `security.mjs:15–27` provides an optional backend foundation using verified UID plus server-managed organization membership; account tier/caller-selected roles are explicitly excluded as HR authority. Native demo selectors and complete local backup downloads are separate fictional tools, not attachment grants.

Google Cloud [signed URLs](https://docs.cloud.google.com/storage/docs/access-control/signed-urls) are time-limited bearer capabilities usable by a holder during their active period. A URL alone therefore cannot satisfy this proposal's same-user, current-membership and one-use requirements. Firebase's [web download guide](https://firebase.google.com/docs/storage/web/download-files) separately documents URL and direct SDK downloads. This proposal chooses an authenticated backend stream, without issuing a persistent provider URL to the browser. It does not claim that the existing Storage rules implement that stream.

## Unselected adoption shape

```json
{
  "enabled": false,
  "orgId": null,
  "attachmentClasses": [],
  "storageProject": null,
  "storageBucket": null,
  "trustedMembershipService": null,
  "downloadServiceIdentity": null,
  "policyVersion": null,
  "approvalReference": null
}
```

Missing/unknown/mismatched selections refuse issuance and redemption. A real operator must select classification, audience, role/resource relation, exact object-generation mapping, maximum size, logging/retention and revocation owner. Public static images remain ordinary separately reviewed public resources; no private attachment becomes public through CMS publication or a URL copied into content.

## Proposed flow and policy

1. The backend verifies the authenticated user and current server-managed membership, selected tenant and attachment purpose. It ignores caller role, account tier, arbitrary bucket/path/URL and claimed ownership. Client input identifies only a bounded opaque resource and expected version in the selected context.
2. It resolves resource metadata to one tenant, immutable version/object generation, classification, current access relation and active status. Unknown, deleted, quarantined, cross-tenant and stale versions refuse before object content access.
3. It creates a cryptographically unpredictable opaque ticket with a server-side digest. Proposed TTL: **60 seconds**, maximum one successful redemption. These are root-review product choices, not Cloud Storage mandates.
4. Redemption is an authenticated same-origin **POST**, not a prefetchable GET. **In one authoritative-store transaction**, read the pending ticket and current server session/revocation version, membership/role-resource relation, tenant, resource status/version/generation, policy version and deadline, then consume the ticket and create an immutable private authorization fence only if all match. The authority/resource reads participate in the same atomic boundary as consumption; prior independent reads are insufficient. Revocation and resource/policy changes must update this shared authority store and its revisions, so a concurrent change conflicts with or is observed by that transaction. One ticket authorizes one exact immutable object, never a prefix/list operation.
5. Stream through the trusted backend with an approved size bound, inert filename, content type, `Content-Disposition: attachment`, `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. The object location/signing credentials never enter a browser response or portable workspace. Apply a reviewed request/stream timeout and cancel object reads on client disconnect.

### Atomic authority and stream-start boundary

The selected adoption must put ticket state, current session/membership authority, resource authorization/version metadata and selected policy revisions within one transactional authorization boundary. A verified inbound identity is bound to the UID/session records read there. A cached membership object or a remote revocation check followed by an unrelated ticket compare-and-swap does not satisfy this rule. If authority is split across services, a separately reviewed linearizable revision/fence protocol covering every mutable authority input is required; until established, issuance/redemption remain disabled. No assumption that Firebase Auth, an arbitrary database and object storage form one transaction is permitted.

The consumed record binds ticket ID, UID, organization, session version, membership version, resource authorization version, immutable resource/object generation, policy revision and deadline to a private single-stream fence. Transaction retries perform no object read, stream send or other external side effect. Exactly one successful consume commits; stale/conflicting authority refuses with zero bytes.

If there is any queued wait after consumption, a **final atomic stream-start transition** re-reads those same authoritative records and checks the unstarted private fence and server deadline. Only a matching fence may transition once to stream-authorized. A changed record/expiry refuses before stream start; the ticket stays consumed. No prior successful consume or cached approval bypasses this final boundary. Even without a queue, the implementation must define one final transactional authorization point immediately before starting the exact immutable stream.

Revocation ordering is explicit: a revocation/resource change committed **before** the final authorization transaction must win/refuse that stream, including an interleaving after preliminary validation. A revocation committed **after** that transaction cannot retroactively invalidate bytes already authorized/sent; it blocks later grants and requests an active-stream abort under the selected transport policy. The contract promises zero bytes for a losing/pre-authorization request, not impossible atomicity between a database commit and physical network delivery. A future adoption must prove this boundary with barriers and independent full-store assertions.

No service worker, CDN or shared cache may retain a private response. The backend/storage IAM path is a separate privileged trust boundary; Firebase client rules cannot be assumed to constrain an administrative SDK. A future adoption must deny alternative public/tokenized/bearer paths to the same private bytes, with explicit direct-access tests. No such rule/IAM change is proposed for automatic activation here.

### Trusted capabilities to select

Select exact attachment policies separately. Suggested examples for review are own HR document read bound to a server person mapping; HR administration read for an explicitly approved document class; CRM attachment read bound to current account/resource access; CMS private editorial attachment read bound to selected editorial membership. Manager status, an account payment tier or a demo role by itself grants none. Payroll/tax/bank documents need their own explicit classification and scope; do not inherit them from directory access. Current optional HR role policy is a foundation, not acceptance of these new scopes.

## Literal fictional ticket and expectations

```json
{
  "ticketId": "ticket-fiction-001",
  "ticketDigest": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "orgId": "org-fiction-a",
  "uid": "uid-fiction-alex",
  "sessionBinding": "session-fiction-7",
  "sessionVersion": "session-revision-2",
  "resourceId": "attachment-fiction-003",
  "resourceVersion": "version-2",
  "resourceAuthorizationVersion": "resource-auth-9",
  "objectGeneration": "123456789",
  "purpose": "hr.document.read.self",
  "policyVersion": "fictional-download-v1",
  "policyRevision": "policy-3",
  "membershipVersion": "membership-4",
  "issuedAtSeconds": 1792065600,
  "expiresAtSeconds": 1792065660,
  "state": "pending"
}
```

The matching authoritative-store fixture is deliberately separate from the ticket:

```json
{
  "session": { "binding": "session-fiction-7", "version": "session-revision-2", "uid": "uid-fiction-alex", "active": true },
  "membership": { "orgId": "org-fiction-a", "uid": "uid-fiction-alex", "personId": "person-fiction-alex", "version": "membership-4", "status": "active", "scopes": ["hr.document.read.self"] },
  "resource": { "orgId": "org-fiction-a", "id": "attachment-fiction-003", "ownerPersonId": "person-fiction-alex", "version": "version-2", "authorizationVersion": "resource-auth-9", "objectGeneration": "123456789", "classification": "fictional-own-hr-document", "status": "active" },
  "policy": { "orgId": "org-fiction-a", "version": "fictional-download-v1", "revision": "policy-3", "status": "active" }
}
```

These records model an explicitly selected owned test policy, not actual collection or a current Storage rule. A successful consume captures all listed versions and a private unstarted fence. The tests must derive that expected capture from these literals, independently of the implementation being tested.

This is a deterministic private-store fixture, not a generated usable ticket or a real provider object. The presented wire secret is never this record ID or digest. A selected test issuer stub supplies a distinct fictional opaque handle. No raw handle, URL, document body, token or private filename may appear in audit output. Proposed audit fields are action/result category, policy version, actor/resource pseudonymous references and time; retention remains a separately selected adoption policy.

| ID | Fictional input at redemption | Expected outcome and complete preservation |
| --- | --- | --- |
| DA-01 | Default disabled selection | Refuse; zero tickets, object reads or bytes |
| DA-02 | Matching verified Alex/session/tenant/resource/version/purpose at `1792065630`; membership active | One atomic consume and one exact version stream; all unrelated tickets/resources unchanged |
| DA-03 | Same handle, authenticated `uid-fiction-riley` | Deny; zero bytes, pending legitimate ticket unchanged |
| DA-04 | Same UID but `org-fiction-b` or resource `attachment-fiction-004` | Deny without cross-tenant content lookup; pending ticket unchanged |
| DA-05 | Only displayed URL or demo role/paid tier, without valid authentication and handle | Deny; no object lookup or credential disclosure |
| DA-06 | Clock `1792065660` or later | Expired; zero bytes even if cleanup has not deleted the ticket |
| DA-07 | First matching redemption succeeded, then same request again | Replay denied; exactly one consume/stream total |
| DA-08 | Two matching requests simultaneously | Exactly one wins the atomic pending transition; loser gets no bytes, no duplicate receipt |
| DA-09 | Membership revoked/version changed after issue and committed before final atomic stream-start authorization, including while queued | Deny; zero bytes and no authority from old snapshot; an already consumed ticket stays consumed |
| DA-10 | Attachment revoked, generation becomes `123456790`, tenant relinked or quarantined | Deny stale binding; no fallback to latest generation |
| DA-11 | HEAD/GET/prefetch instead of selected POST, invalid CSRF/session binding or range/method change | Deny without consuming a valid POST ticket; no bytes |
| DA-12 | Winner disconnects after consumption or object service fails | Ticket stays consumed; no automatic reuse; a fresh authorization/issue is required for retry |
| DA-13 | Transaction unavailable/conflict cannot be resolved | Fail closed before bytes; no optimistic streaming |
| DA-14 | Object size exceeds selected limit or classification unsupported | Refuse; no partial content or ticket broadening |
| DA-15 | Direct bucket/download-token URL attempts for the selected private object | Future adoption test must prove denial; absence of that proof blocks activation |
| DA-16 | Pause after preliminary membership validation; commit membership `revoked` / version `membership-5`; resume ticket-consume transaction | Transaction observes change/conflicts and refuses; ticket remains pending, no fence/stream, zero bytes; unrelated records unchanged |
| DA-17 | Pause after preliminary resource validation; commit `resource-auth-10` / generation `123456790`; resume consume | Refuse in shared atomic boundary; no consume/fence/stream or fallback generation |
| DA-18 | Consume succeeds, then queued session revocation commits before final stream-start transaction | Final transition refuses; ticket remains consumed, fence unstarted/refused, zero bytes and zero reusable ticket |
| DA-19 | Session/authority/resource checks use an external cache with no shared transactional revision/fence protocol | Adoption/redemption unavailable; no ticket consume or stream; independent prechecks cannot substitute |

Public errors use one bounded unavailable message for authenticated denials and do not reveal another tenant's object existence. Internal test expectations may assert exact refusal categories; production audit remains redacted. A partially sent stream cannot be revoked retroactively; short lifetime, no cache and final atomic stream-start authorization limit exposure. Revocation stops future issuance/redemption and aborts active streams when the adopted transport supports it, without claiming bytes already received disappear. A separate post-authorization revocation fixture must preserve this truthful limitation rather than expect a retroactive zero-byte result.

## Recovery and activation review

Consumed/expired/revoked tickets never return to pending. Proposed ticket cleanup after 24 hours preserves only a bounded redacted outcome if selected; server expiry checks remain authoritative before physical deletion. Private tickets and object addresses stay outside native mock exports/imports/restore points. Restoring an app record cannot revive a ticket, old membership version or revoked object generation.

Agent 0 reviewed this artifact policy. Before activation, an operator separately selects the exact tenant, classes, backend/issuer identity, IAM/direct-access closure, expiry, audit retention and revocation procedure. A future owned fixture must verify the complete allow/deny/concurrency and no-bytes cases. This draft supplies no storage issuance, cloud-rule enforcement, emulator proof, account connection or deployed download acceptance.
