# Gusto HR: Firebase model, permissions and optional Functions

WebAppX's synthetic HR portals run without a Gusto account or Firebase HR
deployment. The optional host module in [`integrations/gusto`](../integrations/gusto/README.md)
provides a Firebase reference and a small tested backend. The portable
[Gusto standard](../.SYSTEMX/GUSTO/README.md) describes domain capabilities and
provider boundaries. The root Firebase configuration and existing account level
system do not activate or authorize this module.

## What is implemented

| Layer | Current implementation | Acceptance still required |
| --- | --- | --- |
| React HR demo | Synthetic browser records and explicit demo identity | Connect the adopted app to its server trusted HR identities |
| Actual Gusto SDK | Selected component through the development mock adapter | Real Demo company, provider scopes and contract tests |
| Native backend | Trusted membership gate, safe synthetic directory, own time off request | Adopted app persistence, App Check setup and operator acceptance |
| Provider security | Curated read endpoint policy, independent company/person/payroll binding | Reviewed token broker and a real forwarding adapter |
| Webhook | Raw byte SHA256 HMAC helper, company binding, atomic deduplication and durable inbox | Verify signature wire encoding in Gusto Demo; explicitly approve ingestion |
| Sync | Inbox schema and minimal status projections | Reconciliation worker, dead letter handling, version and ordering acceptance |
| Payroll, tax, bank, benefits | Provider authority and disabled operation contracts | Individual scope, workflow, provider and operator gates |

Changing `GUSTO_MODE` to `demo` or `production` does not make a provider
connection. `gustoProxy` continues to reject every request. No browser token,
generic URL forwarding, production account creation or cloud deployment is
included in this template.

## Canonical organization and person identities

Every HR document belongs below `organizations/{orgId}`. Use application IDs for
organizations and people. Keep Gusto company, employee, contractor and payroll
UUIDs as mappings, rather than primary app identity or Stripe customer identity.
Membership is a server managed record keyed by the verified Firebase UID:

```json
{
  "uid": "uid-alex",
  "orgId": "demo-systemx-hr",
  "status": "active",
  "roles": ["employee"],
  "personId": "person-alex",
  "gustoEmployeeUuid": "00000000-0000-4000-8000-000000000002"
}
```

This is a synthetic example. Bootstrap memberships through a separately reviewed
server admin workflow. The browser cannot read, create, edit, delete or list the
membership registry. A staff account level, `admin: true` claim or role submitted
in a request grants no HR permission. Claims may help the interface choose
navigation; each server operation loads active membership again.

Revoke a membership by setting its server record to `inactive`. Role changes,
employee linking and manager relationships require an audited server operation
and independent organization ownership verification. Avoid letting someone link
their Firebase account by merely knowing a work email or employee UUID.

## Data model and source of truth

The complete field inventory is [`schema.json`](../integrations/gusto/schema.json).
These are collection contracts, not seeded live records. Collections whose
adapters are incomplete remain denied by the reference rules.

| Domain / collections | Canonical authority | Access / persistence rule |
| --- | --- | --- |
| Organization / `hr_memberships`, `integrations`, `hr_external_ids` | Application server | Backend only; browser cannot read or change authority and provider mappings |
| Directory / `hr_people` | Minimal provider projection plus native manager/department links | Own person, HR/payroll roles, auditor, or direct report directory |
| Employee lifecycle / `hr_employment`, `hr_onboarding` | Provider employment state, native checklist | Separate employment instance for rehire; do not recycle a terminated instance |
| Contractor / `hr_contractors` | Gusto | Minimal status projection; approved provider dashboard handles sensitive details |
| Restricted profile / `hr_restricted_profiles`, `hr_compensation` | Gusto | Separate from directory; own person and assigned restricted HR roles |
| Structure / `hr_departments`, `hr_locations`, `hr_jobs`, `hr_pay_schedules` | Native departments; mapped Gusto locations/jobs/pay schedules | Organization scoped references; no banking payloads |
| Time / `hr_time_entries`, `hr_time_off_policies`, `hr_time_off_requests` | Native workflow or explicit time provider | Own submissions; server validated approvals; export accepted hours only |
| Payroll / `hr_payroll_runs`, `hr_contractor_payments` | Gusto | Minimal status and period projection; no local calculation of tax or authoritative net pay |
| Benefits / `hr_benefit_catalog`, `hr_benefit_enrollments` | Chosen benefits provider / Gusto supported capability | Enrollment summary separately restricted; no dependent medical data by default |
| Documents / `hr_documents`, `hr_information_requests` | Native metadata or Gusto live retrieval | No full paystub, tax form, bank statement or reusable signed PDF URL in Firestore |
| Native policy / `hr_policies`, `hr_policy_acknowledgements` | Application | Versioned published policy and per person acknowledgement |
| Native assets / `hr_assets`, `hr_asset_assignments` | Application | Scoped assignments and return records |
| Native training / `hr_training`, `hr_certifications` | Application | Published catalog; per person completion/expiry |
| Native performance / `hr_performance_cycles`, `hr_reviews` | Application | Employee visible published summary separated from private manager notes |
| Reporting / `hr_reports` | Derived app data | Reviewed aggregates, restricted exports, no payroll secrets |
| Operations / `hr_sync_state`, `hr_webhook_inbox`, `hr_idempotency`, `hr_audit_events` | Application server | Backend only; redacted audit and provider event metadata |

Do not copy SSNs, routing/account numbers, tax withholding answers, client secrets,
access tokens, refresh tokens, garnishment detail, full paystubs or signed tax
forms into these collections. A projection helper selects named safe fields; it
never spreads an entire provider response. Restricted directory detail belongs in
a different document because Firestore rules cannot hide individual fields after
a document read. Firebase's [rules conditions guide](https://firebase.google.com/docs/firestore/security/rules-conditions)
also distinguishes client rule checks from privileged server SDK access.

For native uploaded files, use an adopted app's organization/person scoped private
Storage namespace with matching authorization and retention policy. This module
does not ship a Storage grant or upload function. Document metadata access alone
must not imply access to the binary. Return short lived access after checking the
viewer on the server; enforce the same rule for reports and downloads.

## Server permission matrix

Roles are additive only after trusted server assignment. Sensitive provider
operations remain unavailable for every role in the template.

| Role | Directory | Restricted HR / compensation | Native time off | Payroll authority |
| --- | --- | --- | --- | --- |
| Employer owner | Organization | Assigned HR access | Own request; future reviewed decision function | Potential future payroll admin; current execution disabled |
| Payroll admin | Organization | Assigned HR access | Own request if linked to employee | Potential future payroll scopes; current execution disabled |
| HR admin | Organization | Assigned HR access | Own request; future reviewed decision function | No payroll execution grant |
| Manager | Own person and direct report directory | Own person only; no report compensation | Own request; future decisions for direct reports, never own approval | None |
| Employee | Own person | Own person | Own validated request | No payroll execution |
| Contractor | Own person | Own mapped contractor data when adapter accepted | No employee time off request | No company payroll or other contractor payment access |
| Auditor | Organization directory | Explicitly assigned read access | Read only via adopted reporting policy | Read only summaries; no secrets or money movement |

The reference rules give managers no direct report time off reads or decision
writes yet. A future decision function must recheck the current manager link,
organization, pending state and actor/person separation inside its transaction.
Every approval and cancellation creates a redacted audit event. Managers cannot
approve their own requests by switching a portal selector.

## Callable operations and planned Functions

All implemented callables enforce Firebase authentication and App Check, load
trusted organization membership, reject unexpected request fields and return safe
errors. Every service that uses Admin SDK must enforce authorization itself;
Admin SDK access bypasses client Firestore rules.

| Operation | Status / behavior |
| --- | --- |
| `gustoIntegrationStatus({orgId})` | Implemented; no secrets; reports disabled, synthetic only or not configured |
| `gustoReadDirectory({orgId})` | Implemented in mock mode for `demo-systemx-hr`; safe scoped synthetic projection |
| `gustoRequestTimeOff({orgId, request})` | Implemented in mock mode; checks employee/policy, binds UID/person, creates request plus audit transaction |
| `gustoProxy({orgId, method, path})` | Implemented refusal; never forwards a real API request |
| `gustoWebhook` | Optional signed ingestion after the separate configuration gate; durable metadata inbox, no synchronous provider call |
| `hrMembershipGrant`, `hrMembershipRevoke` | Planned; owner authority, verification and audit; no browser registry write |
| `hrInviteEmployee`, `hrLinkIdentity` | Planned; one use invitation, verified identity linking, tenant safe mapping |
| `hrLifecycleTransition` | Planned; onboarding, active, leave, termination and rehire per employment instance |
| `hrTimeSubmit`, `hrTimeApprove`, `hrTimeOffDecide` | Planned; native validators, current relationship checks, state/version conflict checks |
| `hrPolicyPublish`, `hrPolicyAcknowledge` | Planned; immutable policy version and actor bound acknowledgement |
| `hrAssetAssign`, `hrAssetReturn`, `hrTrainingComplete` | Planned; native transactional records and redacted audit |
| `hrReviewPublish`, `hrBenefitEnrollment` | Planned; distinct confidential/published records and provider supported scope |
| `gustoConnect`, `gustoDisconnect`, `gustoTokenRefresh` | Planned; server token vault, OAuth state binding, connection acceptance and refresh lock |
| `gustoReconcileResource`, `gustoReconcileOrganization`, `gustoReplayEvent` | Planned; trusted resource lookup, current provider read, version checks, retry/dead letter state |
| `gustoPayrollPreview`, `gustoPayrollSubmit`, `gustoContractorPay` | Planned and disabled; individual provider/role/scope/review/operator gates |
| `hrReportGenerate`, `hrReportDownload`, `hrDocumentAccess` | Planned; approved fields, aggregation, retention and short lived authorization |

The callable time off request accepts only `policyId`, `startDate`, `endDate`,
`hours` and optional `note`. Dates must be real Gregorian dates, ordered, within
30 calendar days; hours must be positive and at most 240. Do not put medical or
other sensitive explanation in the free text note. The server returns ISO values
and persists `startAt`, `endAt`, `createdAt` as Firestore timestamps.

The optional rules also allow a direct own request create with the same trusted
organization/person/UID, timestamp bounds, active policy and exact field list.
The client cannot set approvals or update/delete the record. Prefer the callable
for its atomic audit write. If an adopted app enables direct client creation,
add an accepted create trigger or disable the direct grant so every request has
the required audit event.

## SDK endpoint inventory is a review input

The security helper traverses the pinned SDK inventory's blocks, flows and hooks
with a visited set, so recursive flows terminate. The returned endpoint inventory
does not authorize anything. A second, deliberately small curated policy decides
which role may call which canonical `GET` resource, with trusted ownership for
company, employee, contractor and payroll identifiers.

Query strings, percent encoding, traversal, duplicate separators, absolute URLs,
arbitrary request headers/body and all non `GET` methods are denied. Browser input
cannot choose a bearer token, host, API version, caller IP or company mapping.
Secret endpoints and payroll/payment writes are absent from the policy. This
policy is tested but is not an implemented live proxy.

Before an adopted provider adapter becomes usable, select supported SDK
components, pin and hash their inventory, intersect it with approved role scopes,
and verify ownership of every nested resource. A document, job, pay schedule,
information request or bank object needs its own trusted tenant/person mapping;
checking only the first company UUID in a path is insufficient. Sensitive
self-service routes must substitute the employee/contractor ID from trusted
membership rather than accept an unrelated UUID.

## Webhooks, ordering and idempotency

Gusto's [webhook guide](https://docs.gusto.com/embedded-payroll/docs/webhooks)
specifies SHA256 HMAC using the subscription verification token and the
`X-Gusto-Signature` header. It describes prompt acknowledgement, retries spanning
three days and event UUIDs. The documented sample binds the event to a Company
through `resource_type`/`resource_uuid`; the changed resource is
`entity_type`/`entity_uuid`.

That guide does not specify signature wire encoding. The testable helper uses a
64 character hexadecimal mock contract over the original raw bytes and constant
time comparison. Real ingestion stays disabled until a Demo capture establishes
that contract and an operator explicitly sets both approval flags. Never infer
signature encoding from a generated fixture or reserialize JSON before hashing.
Keep the verification token in Secret Manager. Handle the initial subscription
verification challenge through a reviewed setup procedure; the normal receiver
does not accept unauthenticated `verification_token` setup payloads.

The receiver rejects malformed, unsigned, cross company, future and stale new
events. Its four day admission window permits the documented retry period. A
transaction keyed by event UUID makes duplicate authenticated deliveries a no op
and refuses reuse of a UUID with different signed content. The inbox stores only
event metadata and a raw body SHA256 fingerprint, never full source payloads or
the verification token. Events older than the admission window need an authorized
Events API reconciliation/replay procedure, not a public bypass flag.

After acceptance, the inbox is durable work for a future reconciliation worker.
That worker must get the latest authoritative resource rather than apply event
order as business state. Check provider resource version, maintain a safe cursor,
retry transient failures, and move repeated failures to a reviewed dead letter
state. A duplicate event, provider exit, queued job or `202` response does not prove
reconciliation or payroll acceptance.

For future outbound writes, keep one idempotency record per actor/org/action and
payload hash, serialize conflicting edits, bind the provider resource version and
handle a conflict by refetching and asking for an intentional retry. Do not
automatically repeat payroll submission after an uncertain timeout. Confirm the
provider's observed state before retrying money movement.

## Optional local adoption

The root `firebase.json`, root Firestore rules and cloud project selection are
unchanged. The supplied [`firebase.example.json`](../integrations/gusto/firebase.example.json)
is a standalone reference using loopback emulator endpoints and a demo project.
Its example ports must be checked against live process ownership before use.
Select free ports if another project's emulator is listening. Never stop that
project's process to claim a default port.

1. Adopt the module in your app and install its isolated lockfile with Node 22.
2. Read and merge the HR rules into the app's reviewed rules. Do not replace app
   rules with this standalone HR rules file. Merged broader grants can defeat
   restrictive HR rules because overlapping allow rules are additive.
3. Use a temporary Firebase config with your chosen free loopback ports and
   `--project demo-systemx-hr`. Run only local emulators; leave mode disabled
   while verifying default refusal.
4. Create synthetic organization, employee memberships and time off policies
   through a local emulator admin fixture. For mock callables set `GUSTO_MODE=mock`
   in ignored local runtime configuration and use valid local App Check test
   setup. No production user or Gusto credential is needed.
5. Verify no access without membership, inactive/cross tenant rejection, manager
   compensation denial, own identity binding, forbidden fields and client denial
   for provider mappings, audit, event inbox and secrets.
6. Connect the adopted UI to its callable adapter. Keep the public synthetic
   demo clearly marked and separate from real employee routes.

The optional Functions package declares the supported
[Node 22 Firebase runtime](https://firebase.google.com/docs/functions/manage-functions#set_nodejs_version)
and pins `firebase-admin` 14.5.0 / `firebase-functions` 7.4.0. Use its own
`npm ci`, syntax checks, tests and audit. Credentials, local paths, `node_modules`,
build output, `.env` files and runtime state remain ignored. Cloud credentials,
deployment and initial authority provisioning are separate operator actions.

## Gates for real Demo and production

Gusto Demo requires the adopted app's own developer application and credentials.
No public universal test key is included. First implement and review the token
broker: the OAuth client secret lives in Secret Manager, access/refresh pairs live
in a server token vault, refresh is locked and rotated tokens are committed
atomically. This reference contains no OAuth, token refresh or provider HTTP call.
Firebase [secret parameters](https://firebase.google.com/docs/functions/config-env#secret_parameters)
must be explicitly bound to the function that uses them.

Webhook ingestion alone requires all of the following explicit runtime values:
`GUSTO_MODE=demo` or `production`, `GUSTO_WEBHOOK_APPROVED=true`,
`GUSTO_WEBHOOK_HEX_VERIFIED=true`, and an organization ID in
`GUSTO_WEBHOOK_ORG_ID`. The backend-only `integrations/gusto` record must match
that organization and mode, include the verified company UUID, and have
`status: demo-accepted` or `production-accepted`. The named Secret Manager value
is `GUSTO_WEBHOOK_VERIFICATION_TOKEN`. None of those records is shipped active.
Even after these ingestion conditions, real proxy forwarding remains disabled.

Before any real provider workflow: verify OAuth/app scopes against production
requirements, trusted membership/resource mapping, token vault concurrency,
endpoint coverage and drift, CSP/document origins, request rate/backoff,
provider conflict behavior, masked logs and audit retention. Obtain acceptance
for each onboarding, benefit, time and payroll workflow in Demo. Production
deployment and money movement need explicit operator authorization plus the
provider's own readiness and role requirements.

Passing local synthetic tests, client rules tests or cloud function syntax checks
does not establish Gusto Demo compatibility, production scopes, employee consent,
payroll accuracy, provider approval or a deployed cloud service.

## Repeatable backend verification

Run `node --test tests/hr/gusto-backend.test.mjs` for the pure membership, tenant,
self-service, path, projection, mode refusal, time off, raw HMAC and replay tests.
Run `npm --prefix integrations/gusto/functions run test:rules` for the isolated
Auth/Firestore emulator rules suite. It creates only synthetic users and records,
selects five unused loopback ports and refuses non demo project or remote
endpoints. It verifies staff claims alone grant no HR access, cross tenant and
manager compensation denials, protected registry/provider operations, own valid
time off creation and forbidden edits. The runner shuts down only the emulator
processes it started.

An installed Firebase CLI and supported Java runtime are prerequisites. On
Windows set `FIREBASE_CLI_JS` to your installed
`firebase-tools/lib/bin/firebase.js` path in the local environment; it remains
outside tracked files. The runner passes subprocess arguments as arrays. Local
macOS checks are not Windows x64/ARM64 runtime acceptance.
