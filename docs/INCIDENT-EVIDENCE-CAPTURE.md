# Prepare optional incident evidence capture guidance

**Artifact design reviewed; unadopted — 2026-10-15.** Agent 0 reviewed the proposed policy after independent source/artifact review. Original WX-0635 catalog acceptance remains separate. The original temporary draft was prepared against the supplied source basis `42818dd7baf3d335f27c401c37d048bd842617fa` while mandatory CI was in progress; it recorded no CI outcome, execution or acceptance. Historical file hashes below remain unchanged. No service, identity/provider operation, incident collection or runtime setup is performed by this guide. A later source re-review after the CRM integration freeze is pending. See the [adoption index](ADOPTION-CONTRACTS.md) and [source-review record](evidence/adoption-contract-source-review.json).

- Original source: `docs/RUNBOOK.md`.
- Original gate: `operator`; priority `P1`; declared dependencies: `[]`.
- **Original acceptance:** For optional operator-approved adoption: The runbook specifies revision, time, affected synthetic scope and redacted logs to preserve before any approved production incident changes.

All policy numbers below are proposed finite defaults for review, not current implemented controls or owner-approved production policy. Fictional examples are design cases, not observed events or actual approvals.

## 1. Capture before changing an approved incident scope

`docs/MONITORING.md` already separates source, browser, process/startup, provider and deployed health. A live PID, local preflight or a source SHA alone is not an authenticated production observation. The existing local workspace drill supplies synthetic recovery evidence; it is not a production incident or permission to read private data.

Use this proposed procedure **before an already approved production incident change**. It preserves revision, time, affected synthetic reproduction scope and redacted logs. It does not authorize the change, expand its dataset or permit collection of real user records. If no operator-approved target/scope exists, prepare only a fictional/local record and stop before production access.

## 2. Proposed capture record and finite limits

| Field | Required value / bound |
| --- | --- |
| `captureId`, `incidentRef` | Opaque downstream references, 1–64 safe characters; no person name or secret. |
| Source / deployed revision | Full reviewed source SHA and separately observed deployed artifact/release ID, or literal `unknown` with reason. Never substitute one for the other. |
| Times | `firstObservedAt`, `captureStartedAt`, `captureCompletedAt` as explicit UTC milliseconds; record clock source/skew uncertainty. Event occurrence time and collection time remain separate. |
| Environment and authority | Approved target reference, request/approval reference, exact read scope, proposed change reference; private operator identities remain in protected records. Missing scope stops production collection. |
| Synthetic scope | Fixed module list from HR/CMS/CRM/shell, named fictional fixture/reproduction ID, affected operation and bounded record counts/IDs where approved; no raw workspace/export body. |
| Evidence manifest | At most **20 artifacts**, each at most **2 MiB**, combined at most **20 MiB**; relative artifact ID/path, bytes, SHA-256, observation time, collector and custody class. Public/redacted summary at most **24 KiB**. |
| Observation window | Default **10 minutes before / 5 minutes after** the first observed signal, where approved existing logs permit; widen only with explicit new scope. Initial capture budget **15 minutes**; record partial/unavailable evidence honestly. |
| Custody | Named approved store/custodian and access log, original vs derivative linkage, retention/hold decision. Proposed raw-capture maximum **7 days** only if the adopter approves; no deletion schedule or legal hold is invented/enforced here. |

An over-bound capture records `partial-scope-stop` and the omission reason. Do not silently truncate a log and label it complete. A digest demonstrates byte identity, not trustworthy origin or correctness.

## 3. Procedure and custody

1. **Bind scope and approval.** Record incident/change references and the approved environment/read boundaries. Confirm which operations are already authorized. Use a synthetic reproduction when sufficient; no credentials, real payroll record or broad provider export is needed to author this procedure.
2. **Record immutable identifiers first.** Capture exact reviewed source, observed release/target if available, first-observed time and collector clock. Preserve original timestamps and earlier receipts. Do not wait until after a change to reconstruct the baseline from memory.
3. **Preserve approved originals.** Read only approved existing sources into a protected incident store. Keep original bytes immutable with a manifest and restricted custody. Never paste raw logs into an LLM/chat, public issue, reusable repository or a public report. Missing authorization means no raw collection.
4. **Create a redacted derivative.** Process content as data, never execute a log line or expand shell text. Remove entire disallowed fields and unsafe message/body values. Keep a derivative-to-original reference in protected custody; the public summary contains only safe artifact IDs and review outcomes.
5. **Independent redaction review.** A second authorized reviewer checks the derivative and manifest before broader sharing. If a secret/person field remains or the reviewer is unavailable, mark `not-shareable` and keep the material protected. Hash the approved derivative separately; never overwrite the original.
6. **Freeze the pre-change receipt.** Record completed/partial/unavailable fields and their reasons, collection window and manifest hashes. Only then may the separately authorized incident change proceed under its own authority. A capture receipt is not approval to mutate services.
7. **Observe after the approved change.** Make a separate post-change observation with its own time/release/result. Preserve failed and uncertain outcomes. Link to the pre-change capture; do not rewrite it to match the new state.
8. **Close custody deliberately.** Record actual access, permitted recipients, retention/hold decision and approved disposal evidence when later authorized. This draft starts no collection, retention timer or deletion job.

## 4. Redaction contract

Permitted redacted facts: reviewed revision/release identifier; UTC times; health vocabulary state; fixed module/operation/error code; status class; duration/count; safe synthetic fixture ID; relative evidence ID/hash/byte count; omitted/unavailable reason code. All fields require a purpose and approved scope.

Disallowed in a shareable record: authorization/cookie headers; access/refresh/custom tokens; private keys or service-account JSON; passwords/MFA recovery material; `.env` values; bank/tax/compensation details; real names/emails/phone numbers; raw request/response/export bodies; provider payloads; unrestricted stack traces; query strings/fragments; machine usernames/absolute paths; unreviewed free-text error messages. A recognizable field name is not enough to sanitize its nested values. Unknown fields or uncertain redaction stop sharing instead of being reflected in diagnostics.

## 5. Literal fictional worked case

**Design example only:** no incident, log collection, approval or production change occurred. The all-`a` source revision below is explicitly fictional and was not looked up as a Git object.

```json
{
  "example": true,
  "captureId": "fictional-capture-001",
  "incidentRef": "fictional-incident-001",
  "sourceRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "observedRelease": "unknown",
  "observedReleaseReason": "no-production-observation-in-design-case",
  "firstObservedAt": "2030-01-15T10:00:00.000Z",
  "captureStartedAt": "2030-01-15T10:01:00.000Z",
  "captureCompletedAt": "2030-01-15T10:04:00.000Z",
  "authorityRef": "fictional-read-scope-001",
  "proposedChangeRef": "fictional-change-001-not-executed",
  "syntheticScope": {
    "modules": ["cms"],
    "fixture": "portal-smoke-v1",
    "operation": "individual-import-refusal",
    "recordsChanged": 0
  },
  "redactedEvent": {
    "code": "backup-schema-refused",
    "result": "refused",
    "inputBytes": 128,
    "workspaceSavedBytesChanged": false
  },
  "custodyClass": "fictional-protected-example",
  "sharingDecision": "example-redaction-reviewed-no-real-approval",
  "captureDisposition": "design-case-only"
}
```

Expected pre-change record: source revision and observation uncertainty retained, three distinct UTC times, CMS-only synthetic scope, safe fixed refusal code and zero record change; no raw imported file, personal data or environment value. Expected post-change record, if any real action is later authorized, must be separate and actual.

## 6. Literal denied cases

| Case | Proposed input | Required result |
| --- | --- | --- |
| `fictional-capture-deny-01` | No approved environment/read scope | Stop before production access; retain only the local proposed request. |
| `fictional-capture-deny-02` | Raw log contains `authorization: FAKE-DO-NOT-SHARE` or a real-person field | Entire derivative stays `not-shareable`; diagnostics expose the fixed rejection code, never the value. |
| `fictional-capture-deny-03` | 21st artifact or total greater than 20 MiB | Record `partial-scope-stop` and exact omission count; no silent successful truncation. |
| `fictional-capture-deny-04` | Collector knows source SHA but not deployed release | Keep `observedRelease: unknown`; do not assert that production ran the source. |
| `fictional-capture-deny-05` | Change happened before baseline capture | Record the timing gap explicitly; a reconstructed post-change log is not pre-change evidence. |

## 7. Artifact mapping and downstream adoption inputs

| Original requirement | Concrete draft coverage |
| --- | --- |
| Revision and time | Sections 2–3 distinguish source/deployed identifiers and occurrence/collection times. |
| Affected synthetic scope | Sections 2 and 5 bind module, fixture, operation and zero-change expectation without raw records. |
| Redacted logs preserved before approved changes | Sections 3–4 require originals/derivatives, independent sharing review and frozen pre-change receipt before separate authorized mutation. |

Agent 0 reviewed the finite bounds, redaction/custody defaults and worked/denied cases for this artifact design. Actual target, incident operator, evidence store, custodian, retention/hold and change approval remain unassigned. This artifact can be reviewed locally; actual incident capture and production-change evidence require their own authorization and observations.

## Historical public source bindings

Paths are relative to the repository root. These are the original supplied-42818dd drafting observations, not refreshed current-source bindings. Original dated evidence retains its own revision and observation scope.

- `docs/RUNBOOK.md` — SHA-256 `50a2d961865600d63c98a17a317c898e662893e004a523419e9746232c5a4b7e`.
- `docs/MONITORING.md` — SHA-256 `6b654892a4cd29deceaf89ce58204162e6a99e3b8a1c8f28dc470b949c18f4dd`.
- `docs/SECRETS.md` — SHA-256 `a3060d87cb9bb85f27d0d55155816ceb582742a47f4a16149104740acd73fc23`.
- `docs/OPERATIONS-READINESS.md` — SHA-256 `49c48b9c74e5b608b5c98d17111cdd7b9b6e56ead4b998e884d9cd1dc8978bd9`.
