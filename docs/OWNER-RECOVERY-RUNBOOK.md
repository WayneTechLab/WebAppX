# Design optional owner recovery procedures

**Artifact design reviewed; unadopted — 2026-10-15.** Agent 0 reviewed the proposed policy after independent source/artifact review. Original WX-0517 catalog acceptance remains separate. The original temporary draft was prepared against the supplied source basis `42818dd7baf3d335f27c401c37d048bd842617fa` while mandatory CI was in progress; it recorded no CI outcome, execution or acceptance. Historical file hashes below remain unchanged. No service, identity/provider operation, incident collection or runtime setup is performed by this guide. A later source re-review after the CRM integration freeze is pending. See the [adoption index](ADOPTION-CONTRACTS.md) and [source-review record](evidence/adoption-contract-source-review.json).

- Original source: `docs/RUNBOOK.md`.
- Original gate: `operator`; priority `P1`; declared dependencies: `[]`.
- **Original acceptance:** For optional operator-approved adoption: A runbook identifies owner recovery prerequisites, evidence and independent approval before any real identity is restored or elevated.

All policy numbers below are proposed finite defaults for review, not current implemented controls or owner-approved production policy. Fictional examples are design cases, not observed events or actual approvals.

## 1. Current foundation and scope

`integrations/gusto/functions/src/security.mjs::requireMember` requires a verified UID, matching organization, active server-managed membership and valid HR roles. Account tier, a browser role selector and possession of an Admin credential do not establish membership-administration authority. `docs/TENANT-MEMBERSHIP-PROPOSAL.md` explicitly leaves the trusted administration service identity and approving authority to the adopter; the reference supplies no accepted owner-recovery endpoint. `src/auth/firebaseAuth.ts` consumes configured sign-in methods; it does not implement this recovery procedure. The existing runbook covers local workspace/dependency recovery, which cannot restore or elevate real accounts.

This procedure governs a future explicitly adopted **one-realm, one-tenant, one-principal** identity recovery. Repository ownership, Firebase Auth identity, tenant membership and provider-account ownership are separate realms. Approval for one never authorizes another. There is no recovery command to run in the current reusable template.

## 2. Authority and prerequisites

Before a real action, fill a protected downstream record with:

| Required fact | Evidence / stop condition |
| --- | --- |
| Target | Exact adopted app, environment, identity realm, tenant, principal and intended previous privilege; no wildcard tenant or group-wide elevation. Missing or ambiguous target stops. |
| Requester identity | Trusted existing operator identity and out-of-band verification under the adopted policy. Email possession, an editable screenshot, a demo role or account tier alone fails. |
| Prior authority | Server-owned historical membership/ownership evidence plus its source/time. Unknown or conflicting prior ownership stops; recovery cannot manufacture a first owner. Initial bootstrap is a separate approved procedure. |
| Executor | Named adopted administration service and authenticated operator allowed to invoke it. The reference template has neither selected for recovery. |
| Independent approval | A separately authenticated approver with demonstrated authority for this target, distinct from beneficiary, requester and executor. No self-approval, shared credential, proxy assertion or automatic approval. |
| Access and preservation | Approved protected evidence store/custodian, pre-change snapshot, redacted review copy, rollback/containment reference and audit write/readback capability. If evidence/audit cannot be preserved, stop. |
| Scope and time | Exact proposed operation, expected prior record revision and expiry. Approval is bound to those facts and the reviewed plan digest. Any drift requires a new decision. |

Proposed bounds: one target principal and one tenant per request; at most **5 prerequisite evidence references**, **10 verification checks** and **1 exact role/status restoration**; review summary at most **16 KiB UTF-8** without secrets; request expires after **60 minutes** and approved execution window after **15 minutes**, whichever is sooner. No privilege broader than independently proven prior authority. A request cannot disable MFA or remove another owner implicitly. Separate credential/session containment or revocation actions require their own recorded approval.

## 3. Procedure before, during and after an authorized action

1. **Open and preserve.** Assign a request ID. Record UTC request/observation times, full reviewed source revision, actual deployed release if known, environment and realm separately. Capture the exact old authority record/version and relevant trusted audit references in the protected store. Never treat a starting source base as the observed deployed revision.
2. **Verify identity and prior ownership.** Follow the adopted out-of-band verification path. Record which evidence establishes each prerequisite. Refuse missing, stale, tenant-mismatched or contradictory evidence. Keep the current authority record intact while investigating.
3. **Prepare the exact change.** List old → proposed status/role, bound target/version, executor, verification steps, separate credential containment, rollback/stop decision and expiry. Show a read-only preview through the adopted trusted service; the reusable app currently supplies no such service. No real recovery can proceed until it exists and is independently accepted.
4. **Obtain independent approval.** The approver verifies the evidence, authority, scope and plan digest and records approve/refuse with UTC time and expiry. A generic operational incident approval or a repository maintainer role is insufficient. **No real identity restoration or elevation occurs before this independent approval.**
5. **Recheck immediately before execution.** Reauthenticate under the adopted policy; reload current membership/version, operator/approver authority and approval expiry. Refuse changed scope/version, revoked authority, expired approval or unreadable audit storage. A previous preview is not permission to skip these checks.
6. **Execute once through the adopted authority.** Apply only the approved target operation with stale/version refusal and an idempotent request ID. Preserve the audit/readback. Do not replay automatically after timeout; classify the outcome unknown and inspect the target before any new approval.
7. **Verify and contain.** A distinct observer checks the exact authority result and required denial cases. Verify unauthenticated/wrong-tenant/caller-role attempts still fail and no unrelated principal changed. Record actual results, not expected values. Unknown verification prevents closure and further privilege changes; invoke only separately approved containment/recovery steps.
8. **Close or stop.** Keep request, preview, approval, audit, before/after digests and verification linked. Mark `restored-and-verified`, `refused`, `expired` or `uncertain`; only actual observed results may use the first state. Retain old evidence under the selected custody policy. Never delete evidence to retry.

## 4. Literal fictional worked case — permitted path, no action performed

The following is a **fictional design simulation**. Times, identities, revision and approval labels are invented solely for this example and are not WebAppX execution evidence.

| Field | Literal example |
| --- | --- |
| Request | `fictional-recovery-001` |
| Realm / environment / tenant | `tenant-membership` / `fictional-preview` / `fictional-org-harbor` |
| Beneficiary | `fictional-user-007` |
| Prior/proposed record | revision `12`, status `inactive`, roles `['employer-owner']` → revision `13`, status `active`, same roles |
| Identity evidence | `fictional-evidence-01`: independently verified prior ownership; `fictional-evidence-02`: protected old record revision 12 |
| Requester / executor / independent approver | `fictional-requester-1` / `fictional-executor-2` / `fictional-approver-3`; all distinct; example authority evidence recorded separately |
| Plan binding | `fictional-plan-001`; exact one-principal revision-12 restoration; no MFA disable or unrelated owner changes |
| Timeline | request `2030-01-15T10:00:00.000Z`; simulated approval `10:08:00.000Z`; execute permitted only before `10:23:00.000Z` and while revision remains 12 |
| Expected verification | principal 007 alone becomes active at revision 13; same role set; unrelated principal 008 stays byte-identical; wrong-tenant and caller-role probes denied |
| Simulated disposition | `eligible-after-independent-approval`; **not a real recovery result** |

A future exercise must replace expected verification with actual observations in its own authorized environment. This example neither supplies a real approver nor proves an administration endpoint.

## 5. Literal denied cases

| Case | Input fact | Required result |
| --- | --- | --- |
| `fictional-recovery-deny-01` | Requester and approver both `fictional-requester-1` | Refuse `independent-approval-missing`; no identity/membership write. |
| `fictional-recovery-deny-02` | Expected revision 12, current trusted record revision 14 | Refuse `stale-authority-record`; preserve evidence and request a fresh plan/approval. |
| `fictional-recovery-deny-03` | Applicant supplies `level:5` plus an owner screenshot, but no trusted prior tenant authority | Refuse `prior-authority-unverified`; no bootstrap shortcut. |
| `fictional-recovery-deny-04` | Approval at 10:08, attempted action at 10:23 or later | Refuse `approval-expired`; no automatic extension/retry. |
| `fictional-recovery-deny-05` | Audit write/readback unavailable or timeout leaves result unknown | Stop as `uncertain`; inspect target under separate authority, preserve all evidence, do not replay. |

## 6. Artifact mapping and downstream adoption inputs

| Original requirement | Concrete draft coverage |
| --- | --- |
| Owner recovery prerequisites | Sections 1–2 define realm/target, identity, prior ownership, service, custody and finite scope. |
| Evidence | Sections 2–3 preserve source/deployed revision distinction, exact old version, approvals and before/after verification. |
| Independent approval before real restoration/elevation | Sections 2–3 make it a prerequisite and bind it to exact scope/digest/expiry; section 5 refuses self-approval and drift. |

Agent 0 reviewed the proposed bounds, independence rule and role/realm coverage for this artifact design. Actual adopter service identity, approving authority, custody/retention and rollback implementation remain **unassigned/unadopted**. A local runbook decision cannot fill those operational facts or accept a real restoration.

## Historical public source bindings

Paths are relative to the repository root. These are the original supplied-42818dd drafting observations, not refreshed current-source bindings. Original dated evidence retains its own revision and observation scope.

- `docs/RUNBOOK.md` — SHA-256 `50a2d961865600d63c98a17a317c898e662893e004a523419e9746232c5a4b7e`.
- `docs/TENANT-MEMBERSHIP-PROPOSAL.md` — SHA-256 `0a71c4c3a738059dbf367c3521f1b67ebb941a4206c101761405a8568a79e267`.
- `integrations/gusto/functions/src/security.mjs` — SHA-256 `48c86c7be0c53c47b0c520a6b2d2162e1d1f151423b9d7f04413dc3159b518f5`.
- `src/auth/firebaseAuth.ts` — SHA-256 `b8672f40e1bab47fd77f7f60407d864af96df4d3efd12b548d3a157749dcf867`.
- `.SYSTEMX/deploy/mfa-policy.md` — SHA-256 `b85bcb49a380284b58c585b2b9a35142bc228a56d5a20daadba21d1621beeb09`.
